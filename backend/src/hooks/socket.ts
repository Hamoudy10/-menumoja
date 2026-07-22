import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { config } from '../config';

interface JwtSocketPayload {
  userId: string;
  role: string;
  restaurantId?: string;
}

interface SocketAuthData {
  userId?: string;
  role?: string;
  restaurantId?: string;
  sessionId?: string;
}

const ROOMS = {
  RESTAURANT: (id: string) => `restaurant:${id}`,
  ORDER: (id: string) => `order:${id}`,
  ADMIN: 'admin:global',
};

let io: SocketIOServer;

function getAccessSecret(): string {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret-not-for-production';
}

function verifySocketToken(token: string): JwtSocketPayload | null {
  try {
    const secret = getAccessSecret();
    const decoded = jwt.verify(token, secret) as any;
    if (decoded.type !== 'access') return null;
    return {
      userId: decoded.userId,
      role: decoded.role,
      restaurantId: decoded.restaurantId || undefined,
    };
  } catch {
    return null;
  }
}

function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token as string;

  if (token) {
    const payload = verifySocketToken(token);
    if (payload) {
      (socket as any).authData = {
        userId: payload.userId,
        role: payload.role,
        restaurantId: payload.restaurantId,
      };
      return next();
    }
  }

  (socket as any).authData = {};
  next();
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  const frontendUrl = config.frontendUrl;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  io.use(authenticateSocket);

  if (config.nodeEnv !== 'test' && config.redisUrl) {
    setupRedisAdapter().catch((err) => {
      logger.info('Redis adapter not available — running without multi-instance support');
    });
  }

  io.on('connection', (socket: Socket) => {
    const authData: SocketAuthData = (socket as any).authData || {};
    logger.info('Socket connected', {
      id: socket.id,
      userId: authData.userId || 'anonymous',
      role: authData.role || 'guest',
    });

    socket.on('join:restaurant', (data: { restaurantId?: string }, callback?: Function) => {
      const restaurantId = data?.restaurantId || authData.restaurantId;

      if (!restaurantId) {
        const errMsg = 'Restaurant ID is required to join restaurant room';
        if (typeof callback === 'function') return callback({ error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      if (!authData.userId) {
        const errMsg = 'Authentication required to join restaurant room';
        if (typeof callback === 'function') return callback({ error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      const room = ROOMS.RESTAURANT(restaurantId);
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room ${room}`, { userId: authData.userId });

      if (typeof callback === 'function') callback({ success: true, room });
    });

    socket.on('join:order', (data: { orderId?: string; sessionId?: string }, callback?: Function) => {
      const { orderId, sessionId } = data || {};

      if (!orderId) {
        const errMsg = 'Order ID is required';
        if (typeof callback === 'function') return callback({ error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      const room = ROOMS.ORDER(orderId);
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room ${room}`, { sessionId });

      if (typeof callback === 'function') callback({ success: true, room });
    });

    socket.on('order:status-update', (data: { orderId?: string; status?: string }, callback?: Function) => {
      if (!authData.userId) {
        const errMsg = 'Authentication required';
        if (typeof callback === 'function') return callback({ error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      const staffRoles = ['kitchen', 'manager', 'owner', 'super_admin'];
      if (!authData.role || !staffRoles.includes(authData.role)) {
        const errMsg = 'Only kitchen staff and managers can update order status';
        if (typeof callback === 'function') return callback({ error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      const { orderId, status } = data || {};
      if (!orderId || !status) {
        const errMsg = 'Order ID and status are required';
        if (typeof callback === 'function') return callback({ error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      logger.info('Order status update via socket', { orderId, status, userId: authData.userId });

      if (typeof callback === 'function') callback({ success: true });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info('Socket disconnected', {
        id: socket.id,
        userId: authData.userId || 'anonymous',
        reason,
      });
    });
  });

  return io;
}

async function setupRedisAdapter(): Promise<void> {
  try {
    const { default: Redis } = await import('ioredis');
    let createAdapter: any;
    try {
      createAdapter = (await new Function('return import("@socket.io/redis-adapter")')()).createAdapter;
    } catch {
      logger.info('Redis adapter not available — running without multi-instance support');
      return;
    }

    const pubClient = new Redis(config.redisUrl);
    const subClient = pubClient.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter attached to Socket.io');
  } catch (error: any) {
    logger.info('Redis adapter not available — running without multi-instance support');
  }
}

export function emitOrderNew(restaurantId: string, orderData: Record<string, unknown>): void {
  if (!io) return;
  try {
    io.to(ROOMS.RESTAURANT(restaurantId)).emit('order:new', orderData);
    logger.debug('Emitted order:new', { restaurantId, orderId: orderData.orderId });
  } catch (error) {
    logger.error('Failed to emit order:new', { error, restaurantId });
  }
}

export function emitOrderStatusChanged(orderId: string, status: string, timestamp: string): void {
  if (!io) return;
  try {
    const data = { orderId, status, timestamp };
    io.to(ROOMS.ORDER(orderId)).emit('order:status-changed', data);
    logger.debug('Emitted order:status-changed to order room', { orderId, status });
  } catch (error) {
    logger.error('Failed to emit order:status-changed', { error, orderId });
  }
}

export function emitPaymentConfirmed(restaurantId: string, paymentData: Record<string, unknown>): void {
  if (!io) return;
  try {
    io.to(ROOMS.RESTAURANT(restaurantId)).emit('payment:confirmed', paymentData);
    logger.debug('Emitted payment:confirmed', { restaurantId });
  } catch (error) {
    logger.error('Failed to emit payment:confirmed', { error, restaurantId });
  }
}

export function emitTableStatusChanged(restaurantId: string, tableId: string, status: string): void {
  if (!io) return;
  try {
    io.to(ROOMS.RESTAURANT(restaurantId)).emit('table:status-changed', { tableId, status });
  } catch (error) {
    logger.error('Failed to emit table:status-changed', { error, restaurantId, tableId });
  }
}

export function emitCameraAlert(restaurantId: string, alertData: Record<string, unknown>): void {
  if (!io) return;
  try {
    io.to(ROOMS.RESTAURANT(restaurantId)).emit('camera:alert', alertData);
    io.to(ROOMS.ADMIN).emit('camera:alert', { restaurantId, ...alertData });
    logger.warn('Emitted camera:alert', { restaurantId, alertType: alertData.alertType });
  } catch (error) {
    logger.error('Failed to emit camera:alert', { error, restaurantId });
  }
}

export function emitNotification(ownerId: string, notification: Record<string, unknown>): void {
  if (!io) return;
  try {
    io.emit('notification:new', { ownerId, ...notification });
  } catch (error) {
    logger.error('Failed to emit notification:new', { error, ownerId });
  }
}

export function setIO(instance: SocketIOServer): void {
  io = instance;
}

export { io };
export default io!;
