import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';
import { config } from './config';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { initSocket } from './hooks/socket';
import { initializeScheduler } from './jobs/scheduler';
import { prisma } from './config/database';
import { redis } from './config/redis';

import {
  authRoutes,
  restaurantRoutes,
  menuRoutes,
  publicRoutes,
  qrRoutes,
  orderRoutes,
  paymentRoutes,
  aiRoutes,
  marketingRoutes,
  cameraRoutes,
  analyticsRoutes,
  adminRoutes,
  ussdRoutes,
  smsRoutes,
  notificationRoutes,
} from './routes';

if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 0,
  });
}

const app = express();

app.set('trust proxy', 1);

if (config.sentryDsn) {
  app.use(Sentry.Handlers.requestHandler());
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-qr-code-id', 'x-staff-pin'],
}));

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).requestId = uuidv4();
  next();
});

app.use(generalLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/restaurant', restaurantRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/menu/public', publicRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/marketing', marketingRoutes);
app.use('/api/v1/cameras', cameraRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ussd', ussdRoutes);
app.use('/api/v1/sms', smsRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      messageSwahili: 'Rasilimali iliyoombwa haikupatikana',
    },
  });
});

if (config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use(errorHandler);

const httpServer = createServer(app);

let isShuttingDown = false;

function startServer(): void {
  const socketIO = initSocket(httpServer);
  logger.info('Socket.io initialized');

  const port = config.port;

  httpServer.listen(port, () => {
    logger.info(`MenuMoja backend running on port ${port}`, {
      environment: config.nodeEnv,
      frontendUrl: config.frontendUrl,
    });
  });

  if (config.nodeEnv !== 'test') {
    try {
      initializeScheduler();
      logger.info('Job scheduler initialized');
    } catch (err) {
      logger.warn('Failed to initialize job scheduler', { error: err });
    }
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal}. Starting graceful shutdown...`);

  httpServer.close((err) => {
    if (err) {
      logger.error('Error closing HTTP server', { error: err });
      process.exit(1);
    }

    logger.info('HTTP server closed');

    prisma.$disconnect()
      .then(() => logger.info('Prisma disconnected'))
      .catch((e) => logger.error('Error disconnecting Prisma', { error: e }));

    if (redis) {
      redis.quit()
        .then(() => logger.info('Redis disconnected'))
        .catch((e: Error) => logger.error('Error disconnecting Redis', { error: e }));
    }

    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise,
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });

  if (config.sentryDsn) {
    Sentry.captureException(error);
  }

  gracefulShutdown('uncaughtException');
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, httpServer };
export default app;
