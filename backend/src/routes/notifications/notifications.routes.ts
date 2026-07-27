import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware';
import { NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginationMeta, asyncHandler } from '../../utils/helpers';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../types';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { page, perPage } = parsePagination(req.query as any);
  const type = req.query.type as string | undefined;
  const isRead = req.query.is_read as string | undefined;

  const where: any = {};
  if (user.restaurantId) where.restaurantId = user.restaurantId;

  if (user.role === 'super_admin') {
    where.recipientType = 'PLATFORM_ADMIN';
    where.recipientId = user.userId;
  } else if (user.role === 'owner') {
    where.recipientType = 'OWNER';
    where.recipientId = user.userId;
  } else {
    where.recipientType = 'STAFF';
    where.recipientId = user.userId;
  }

  if (type) where.type = type;
  if (isRead === 'true') where.isRead = true;
  else if (isRead === 'false') where.isRead = false;

  try {
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: notifications,
      meta: buildPaginationMeta(total, page, perPage),
    });
  } catch {
    logger.warn('Failed to fetch notifications (table may not exist)');
    res.json({ success: true, data: [], meta: buildPaginationMeta(0, page, perPage) });
  }
}));

router.get('/unread-count', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  const where: any = { isRead: false };
  if (user.restaurantId) where.restaurantId = user.restaurantId;

  if (user.role === 'super_admin') {
    where.recipientType = 'PLATFORM_ADMIN';
    where.recipientId = user.userId;
  } else if (user.role === 'owner') {
    where.recipientType = 'OWNER';
    where.recipientId = user.userId;
  } else {
    where.recipientType = 'STAFF';
    where.recipientId = user.userId;
  }

  const count = await prisma.notification.count({ where });

  res.json({ success: true, data: { count } });
}));

router.put('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const notificationId = req.params.id;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

  if (!notification) {
    throw new NotFoundError('Notification not found', 'Arifa haikupatikana');
  }

  const isOwner = notification.recipientId === user.userId;
  const isSuperAdmin = user.role === 'super_admin' && notification.recipientType === 'PLATFORM_ADMIN';
  const isSameRestaurant = user.restaurantId && notification.restaurantId === user.restaurantId;

  if (!isOwner && !isSuperAdmin && !isSameRestaurant) {
    throw new NotFoundError('Notification not found', 'Arifa haikupatikana');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });

  res.json({ success: true, data: updated });
}));

router.put('/read-all', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  const where: any = { isRead: false };
  if (user.restaurantId) where.restaurantId = user.restaurantId;

  if (user.role === 'super_admin') {
    where.recipientType = 'PLATFORM_ADMIN';
    where.recipientId = user.userId;
  } else if (user.role === 'owner') {
    where.recipientType = 'OWNER';
    where.recipientId = user.userId;
  } else {
    where.recipientType = 'STAFF';
    where.recipientId = user.userId;
  }

  await prisma.notification.updateMany({
    where,
    data: { isRead: true, readAt: new Date() },
  });

  res.json({ success: true, data: { message: 'All notifications marked as read' } });
}));

router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const notificationId = req.params.id;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });

  if (!notification) {
    throw new NotFoundError('Notification not found', 'Arifa haikupatikana');
  }

  const isOwner = notification.recipientId === user.userId;
  const isSuperAdmin = user.role === 'super_admin' && notification.recipientType === 'PLATFORM_ADMIN';
  const isSameRestaurant = user.restaurantId && notification.restaurantId === user.restaurantId;

  if (!isOwner && !isSuperAdmin && !isSameRestaurant) {
    throw new NotFoundError('Notification not found', 'Arifa haikupatikana');
  }

  await prisma.notification.delete({ where: { id: notificationId } });

  res.json({ success: true, data: { message: 'Notification deleted' } });
}));

export default router;
