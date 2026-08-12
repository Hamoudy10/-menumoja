import { Router, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { authenticate, enforceRestaurantScope, validate, auditLog } from '../../middleware';
import { AppError, NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginationMeta, asyncHandler } from '../../utils/helpers';
import { encrypt, decrypt } from '../../utils/encryption';
import logger from '../../utils/logger';
import * as cloudinaryIntegration from '../../integrations/cloudinary';
import { AuthenticatedRequest } from '../../types';

const router = Router();

// Stream proxy — no auth middleware (img tags can't send headers).
// Uses signed JWT token from /cameras/:id/stream-token as query param.
router.get('/:id/stream', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cameraId = String(req.params.id);
  const token = (req.query.token as string) || '';

  try {
    const payload = jwt.verify(token, getAccessSecret()) as any;
    if (payload.type !== 'stream' || payload.cameraId !== cameraId) {
      res.status(403).json({ success: false, message: 'Invalid stream token' });
      return;
    }
  } catch {
    res.status(403).json({ success: false, message: 'Invalid or expired stream token' });
    return;
  }

  const camera = await prisma.camera.findFirst({ where: { id: cameraId } });
  if (!camera) {
    res.status(404).json({ success: false, message: 'Camera not found' });
    return;
  }

  const url = camera.streamUrl;
  if (!url || !url.startsWith('http')) {
    res.status(400).json({ success: false, message: 'Camera has no HTTP stream URL' });
    return;
  }

  try {
    const controller = new AbortController();
    req.on('close', () => controller.abort());

    const upstream = await fetch(url, { signal: controller.signal });
    if (!upstream.ok && upstream.status !== 200) {
      res.status(502).json({ success: false, message: 'Camera stream unreachable' });
      return;
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const reader = upstream.body?.getReader();
    if (!reader) {
      res.status(502).json({ success: false, message: 'No response body' });
      return;
    }

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.destroyed) res.write(value);
        }
      } catch { /* ignore */ }
      if (!res.destroyed) res.end();
    };
    pump();
  } catch (err: any) {
    if (!res.destroyed) {
      res.status(502).json({ success: false, message: err.message || 'Stream proxy failed' });
    }
  }
}));

router.use(authenticate, enforceRestaurantScope);

const addCameraSchema = z.object({
  name: z.string().min(1).max(100),
  ipAddress: z.string().min(1).max(45),
  port: z.number().int().min(1).max(65535).default(554),
  username: z.string().max(100).optional(),
  password: z.string().max(255).optional(),
  location: z.string().max(200).optional(),
  streamUrl: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

const updateCameraSchema = addCameraSchema.partial();

function maskCredential(val: string | null | undefined): string | null {
  if (!val) return null;
  if (val.length <= 4) return '****';
  return val.slice(0, 2) + '****' + val.slice(-2);
}

function getAccessSecret(): string {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret-not-for-production';
}

async function testRtspConnection(streamUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(streamUrl.replace('rtsp://', 'http://').replace(/:\d+\//, '/'), {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

// ==================== CAMERAS ====================

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;

  const cameras = await prisma.camera.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { alerts: true } },
    },
  });

  const masked = cameras.map((c) => ({
    ...c,
    username: maskCredential(c.username),
    passwordEncrypted: c.passwordEncrypted ? maskCredential('[encrypted]') : null,
    _count: undefined,
    alertCount: c._count.alerts,
  }));

  res.json({ success: true, data: masked });
}));

router.post('/', validate(addCameraSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const data = req.body as z.infer<typeof addCameraSchema>;

  const streamUrl = data.streamUrl || `rtsp://${data.username ? `${encodeURIComponent(data.username)}:${data.password ? encodeURIComponent(data.password) : ''}@` : ''}${data.ipAddress}:${data.port}/live`;

  let passwordEncrypted: string | null = null;
  if (data.password) {
    passwordEncrypted = encrypt(data.password);
  }

  const camera = await prisma.camera.create({
    data: {
      restaurantId,
      name: data.name,
      ipAddress: data.ipAddress,
      port: data.port,
      username: data.username || null,
      passwordEncrypted,
      streamUrl,
      location: data.location || null,
      isActive: data.isActive ?? true,
    },
  });

  testRtspConnection(streamUrl).then((connected) => {
    if (!connected) {
      logger.warn('Camera connection test failed in background', { cameraId: camera.id, ip: data.ipAddress });
    } else {
      prisma.camera.update({ where: { id: camera.id }, data: { lastSeen: new Date() } }).catch(() => {});
    }
  }).catch((err) => {
    logger.warn('Background camera test error', { cameraId: camera.id, error: err });
  });

  res.json({
    success: true,
    data: {
      ...camera,
      passwordEncrypted: passwordEncrypted ? '[ENCRYPTED]' : null,
    },
  });
}));

router.get('/alert', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { page, perPage } = parsePagination(req.query as any);
  const isReviewed = String(req.query.isReviewed ?? "");

  const where: any = { restaurantId };
  if (isReviewed === 'true') where.isReviewed = true;
  else if (isReviewed === 'false') where.isReviewed = false;

  try {
    const [alerts, total] = await Promise.all([
      prisma.cameraAlert.findMany({
        where,
        include: { camera: { select: { name: true } } },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.cameraAlert.count({ where }),
    ]);

    res.json({
      success: true,
      data: alerts.map((a) => ({ ...a, cameraName: a.camera.name })),
      meta: buildPaginationMeta(total, page, perPage),
    });
  } catch (err: any) {
    logger.warn('Failed to fetch camera alerts (table may not exist)', { error: err.message });
    res.json({ success: true, data: [], meta: buildPaginationMeta(0, page, perPage) });
  }
}));

router.put('/alert/:alertId/review', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const alertId = String(req.params.alertId);

  const alert = await prisma.cameraAlert.findFirst({
    where: { id: alertId, restaurantId },
  });

  if (!alert) {
    throw new NotFoundError('Alert not found', 'Tahadhari haikupatikana');
  }

  const updated = await prisma.cameraAlert.update({
    where: { id: alertId },
    data: { isReviewed: true, reviewedAt: new Date() },
  });

  res.json({ success: true, data: updated });
}));

router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const cameraId = String(req.params.id);

  const camera = await prisma.camera.findFirst({
    where: { id: cameraId, restaurantId },
    include: {
      alerts: {
        where: { occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: { occurredAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!camera) {
    throw new NotFoundError('Camera not found', 'Kamera haikupatikana');
  }

  res.json({
    success: true,
    data: {
      ...camera,
      passwordEncrypted: camera.passwordEncrypted ? '[ENCRYPTED]' : null,
    },
  });
}));

router.put('/:id', validate(updateCameraSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const cameraId = String(req.params.id);

  const existing = await prisma.camera.findFirst({
    where: { id: cameraId, restaurantId },
  });

  if (!existing) {
    throw new NotFoundError('Camera not found', 'Kamera haikupatikana');
  }

  const data = req.body as z.infer<typeof updateCameraSchema>;
  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
  if (data.port !== undefined) updateData.port = data.port;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.streamUrl !== undefined) updateData.streamUrl = data.streamUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.password !== undefined) {
    updateData.passwordEncrypted = encrypt(data.password);
  }

  if (!data.streamUrl && (data.ipAddress !== undefined || data.port !== undefined || data.username !== undefined || data.password !== undefined)) {
    const ip = data.ipAddress || existing.ipAddress;
    const port = data.port || existing.port;
    const user = data.username !== undefined ? data.username : existing.username;
    const pass = data.password || (existing.passwordEncrypted ? decrypt(existing.passwordEncrypted) : '');
    updateData.streamUrl = `rtsp://${user ? `${encodeURIComponent(user)}:${pass ? encodeURIComponent(pass) : ''}@` : ''}${ip}:${port}/live`;
  }

  const camera = await prisma.camera.update({
    where: { id: cameraId },
    data: updateData,
  });

  res.json({
    success: true,
    data: {
      ...camera,
      passwordEncrypted: camera.passwordEncrypted ? '[ENCRYPTED]' : null,
    },
  });
}));

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const cameraId = String(req.params.id);

  const camera = await prisma.camera.findFirst({
    where: { id: cameraId, restaurantId },
  });

  if (!camera) {
    throw new NotFoundError('Camera not found', 'Kamera haikupatikana');
  }

  await prisma.cameraAlert.deleteMany({ where: { cameraId } });
  await prisma.camera.delete({ where: { id: cameraId } });

  res.json({ success: true, data: { message: 'Camera removed' } });
}));

router.post('/:id/test', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const cameraId = String(req.params.id);

  const camera = await prisma.camera.findFirst({
    where: { id: cameraId, restaurantId },
  });

  if (!camera) {
    throw new NotFoundError('Camera not found', 'Kamera haikupatikana');
  }

  let decryptedPassword: string | null = null;
  if (camera.passwordEncrypted) {
    try {
      decryptedPassword = decrypt(camera.passwordEncrypted);
    } catch { /* ignore */ }
  }

  const rtspUrl = `rtsp://${camera.username ? `${encodeURIComponent(camera.username)}:${decryptedPassword ? encodeURIComponent(decryptedPassword) : ''}@` : ''}${camera.ipAddress}:${camera.port}/live`;

  let connected = false;
  try {
    connected = await testRtspConnection(rtspUrl);
  } catch (err) {
    logger.warn('Camera connection test failed', { cameraId, error: err });
  }

  let thumbnailUrl: string | null = null;

  if (connected) {
    try {
      const placeholderImageUrl = `https://placehold.co/640x480/png?text=${encodeURIComponent(camera.name)}`;
      const uploaded = await cloudinaryIntegration.uploadImage(
        placeholderImageUrl,
        `restaurants/${restaurantId}/cameras`
      );
      thumbnailUrl = uploaded.thumbnailUrl;

      await prisma.camera.update({
        where: { id: cameraId },
        data: { lastSeen: new Date() },
      });
    } catch (err) {
      logger.warn('Failed to upload camera thumbnail', { cameraId, error: err });
    }
  }

  res.json({
    success: true,
    data: { connected, thumbnailUrl, message: connected ? 'Connection successful' : 'Could not connect to camera stream' },
  });
}));

router.post('/:id/stream-token', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const cameraId = String(req.params.id);

  const camera = await prisma.camera.findFirst({
    where: { id: cameraId, restaurantId },
  });

  if (!camera) {
    throw new NotFoundError('Camera not found', 'Kamera haikupatikana');
  }

  const token = jwt.sign(
    { cameraId, restaurantId, type: 'stream', iat: Math.floor(Date.now() / 1000) },
    getAccessSecret(),
    { expiresIn: '2h' }
  );

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const streamUrl = `/api/v1/cameras/stream/${token}`;

  res.json({
    success: true,
    data: { token, streamUrl, expiresAt: expiresAt.toISOString() },
  });
}));

router.get('/:id/alerts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const cameraId = String(req.params.id);

  const camera = await prisma.camera.findFirst({
    where: { id: cameraId, restaurantId },
  });

  if (!camera) {
    throw new NotFoundError('Camera not found', 'Kamera haikupatikana');
  }

  const { page, perPage } = parsePagination(req.query as any);

  const [alerts, total] = await Promise.all([
    prisma.cameraAlert.findMany({
      where: { cameraId, restaurantId },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.cameraAlert.count({ where: { cameraId, restaurantId } }),
  ]);

  res.json({
    success: true,
    data: alerts.map((a) => ({ ...a, cameraName: camera.name })),
    meta: buildPaginationMeta(total, page, perPage),
  });
}));

export default router;
