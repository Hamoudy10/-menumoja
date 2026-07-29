import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, requireRole, validate, auditLog } from '../../middleware';
import { AppError, NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginationMeta, asyncHandler } from '../../utils/helpers';
import logger from '../../utils/logger';
import * as africasTalking from '../../integrations/africasTalking';
import { AuthenticatedRequest } from '../../types';

const router = Router();

async function sendEmailHelper(payload: { to: string; subject: string; html: string; text: string; from: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('Resend API key not configured, skipping email');
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: payload.from, to: [payload.to], subject: payload.subject, html: payload.html, text: payload.text }),
  });
  if (!response.ok) {
    const body = await response.text();
    logger.error('Failed to send admin email', { status: response.status, body });
  }
}

router.use(authenticate, requireRole('SUPER_ADMIN'));

const suspendSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  sendSms: z.boolean().default(false),
  sendEmail: z.boolean().default(false),
});

const replyTicketSchema = z.object({
  message: z.string().min(1).max(2000),
});

// ==================== RESTAURANTS ====================

router.get('/restaurants', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, perPage } = parsePagination(req.query as any);
  const city = req.query.city as string | undefined;
  const plan = req.query.plan as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const where: any = {};

  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (plan) where.planId = plan;
  if (status === 'suspended') where.isSuspended = true;
  else if (status === 'active') where.isSuspended = false;
  else if (status) where.subscriptionStatus = status;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { owner: { fullName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        plan: { select: { id: true, name: true, priceMonthlyKes: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.restaurant.count({ where }),
  ]);

  const data = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    city: r.city,
    isSuspended: r.isSuspended,
    subscriptionStatus: r.subscriptionStatus,
    owner: r.owner,
    plan: r.plan,
    orderCount: r._count.orders,
    createdAt: r.createdAt,
  }));

  res.json({ success: true, data, meta: buildPaginationMeta(total, page, perPage) });
}));

router.get('/restaurants/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.params.id;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      owner: { select: { id: true, fullName: true, email: true, phone: true, isVerified: true, createdAt: true } },
      plan: true,
      settings: true,
      _count: {
        select: {
          orders: true,
          menuItems: true,
          staff: true,
          cameras: true,
        },
      },
    },
  });

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
  }

  const recentOrders = await prisma.order.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
  });

  res.json({
    success: true,
    data: {
      ...restaurant,
      recentOrders,
    },
  });
}));

router.put('/restaurants/:id/suspend', validate(suspendSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.params.id;
  const { reason } = req.body as z.infer<typeof suspendSchema>;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { fullName: true, phone: true, email: true } } },
  });

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
  }

  if (restaurant.isSuspended) {
    throw new AppError(400, 'ALREADY_SUSPENDED', 'Restaurant is already suspended', 'Mgahawa tayari umesimamishwa');
  }

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      isSuspended: true,
      suspensionReason: reason,
      subscriptionStatus: 'SUSPENDED',
    },
  });

  try {
    const smsMsg = `Hello ${restaurant.owner.fullName}, your MenuMoja restaurant "${restaurant.name}" has been suspended. Reason: ${reason}. Contact support@menumoja.co.ke for assistance.`;
    await africasTalking.sendSMS(restaurant.owner.phone, smsMsg);

    if (restaurant.owner.email) {
      await sendEmailHelper({
        to: restaurant.owner.email,
        subject: 'Restaurant Suspended - MenuMoja',
        html: `<h2>Restaurant Suspended</h2><p>Dear ${restaurant.owner.fullName},</p><p>Your restaurant "${restaurant.name}" has been suspended.</p><p><strong>Reason:</strong> ${reason}</p><p>Please contact support@menumoja.co.ke for assistance.</p>`,
        text: `Dear ${restaurant.owner.fullName}, your restaurant "${restaurant.name}" has been suspended. Reason: ${reason}. Contact support@menumoja.co.ke for assistance.`,
        from: process.env.EMAIL_FROM || 'MenuMoja <noreply@menumoja.co.ke>',
      });
    }
  } catch (notifyErr) {
    logger.error('Failed to notify owner about suspension', { restaurantId, error: notifyErr });
  }

  logger.info('Restaurant suspended', { restaurantId, reason, adminId: req.user?.userId });

  res.json({ success: true, data: { message: 'Restaurant suspended', reason } });
}));

router.put('/restaurants/:id/activate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.params.id;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { fullName: true, phone: true, email: true } } },
  });

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
  }

  if (!restaurant.isSuspended) {
    throw new AppError(400, 'NOT_SUSPENDED', 'Restaurant is not suspended', 'Mgahawa haujasimamishwa');
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: restaurant.planId } });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      isSuspended: false,
      suspensionReason: null,
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  try {
    const smsMsg = `Hello ${restaurant.owner.fullName}, your MenuMoja restaurant "${restaurant.name}" has been reactivated. You can now access all features. Welcome back!`;
    await africasTalking.sendSMS(restaurant.owner.phone, smsMsg);

    if (restaurant.owner.email) {
      await sendEmailHelper({
        to: restaurant.owner.email,
        subject: 'Restaurant Reactivated - MenuMoja',
        html: `<h2>Restaurant Reactivated</h2><p>Dear ${restaurant.owner.fullName},</p><p>Your restaurant "${restaurant.name}" has been reactivated.</p><p>You can now access all MenuMoja features.</p>`,
        text: `Dear ${restaurant.owner.fullName}, your restaurant "${restaurant.name}" has been reactivated. Welcome back!`,
        from: process.env.EMAIL_FROM || 'MenuMoja <noreply@menumoja.co.ke>',
      });
    }
  } catch (notifyErr) {
    logger.error('Failed to notify owner about reactivation', { restaurantId, error: notifyErr });
  }

  logger.info('Restaurant activated', { restaurantId, adminId: req.user?.userId });

  res.json({ success: true, data: { message: 'Restaurant activated' } });
}));

// ==================== OWNERS ====================

router.get('/owners', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, perPage, sortBy, sortOrder } = parsePagination(req.query as any);
  const search = req.query.search as string | undefined;

  const where: any = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  const [owners, total] = await Promise.all([
    prisma.owner.findMany({
      where,
      include: {
        _count: { select: { restaurants: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.owner.count({ where }),
  ]);

  const data = owners.map((o) => ({
    id: o.id,
    fullName: o.fullName,
    email: o.email,
    phone: o.phone,
    isVerified: o.isVerified,
    restaurantCount: o._count.restaurants,
    createdAt: o.createdAt,
  }));

  res.json({ success: true, data, meta: buildPaginationMeta(total, page, perPage) });
}));

router.get('/owners/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ownerId = req.params.id;

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: {
      restaurants: {
        include: {
          plan: { select: { id: true, name: true, priceMonthlyKes: true } },
          _count: { select: { orders: true } },
        },
      },
    },
  });

  if (!owner) {
    throw new NotFoundError('Owner not found', 'Mmiliki haikupatikana');
  }

  res.json({ success: true, data: owner });
}));

// ==================== STATS ====================

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totalRestaurants, activeRestaurants, suspendedCount, totalOrders, totalRevenueResult, newThisMonth, lastMonthNew] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { isSuspended: false } }),
    prisma.restaurant.count({ where: { isSuspended: true } }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.restaurant.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.restaurant.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
  ]);

  const totalRevenue = Number(totalRevenueResult._sum.totalAmount || 0);

  const previousTotal = await prisma.restaurant.count({ where: { createdAt: { lt: startOfMonth } } });
  const churnRate = previousTotal > 0 ? Math.max(0, Math.round(((previousTotal - (totalRestaurants - newThisMonth)) / previousTotal) * 10000) / 100) : 0;

  const subscriptions = await prisma.subscriptionPlan.findMany({
    select: { id: true, name: true, priceMonthlyKes: true },
  });

  const restaurantWithPlans = await prisma.restaurant.groupBy({
    by: ['planId'],
    _count: { id: true },
  });

  const planCountMap: Record<string, number> = {};
  for (const r of restaurantWithPlans) {
    planCountMap[r.planId] = r._count.id;
  }

  let mrr = 0;
  for (const plan of subscriptions) {
    const count = planCountMap[plan.id] || 0;
    mrr += Number(plan.priceMonthlyKes) * count;
  }

  const last12Months: Array<{ month: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = await prisma.restaurant.count({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
    });
    last12Months.push({
      month: monthStart.toISOString().slice(0, 7),
      count,
    });
  }

  res.json({
    success: true,
    data: {
      totalRestaurants,
      activeRestaurants,
      suspendedCount,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      newThisMonth,
      churnRate,
      mrr: Math.round(mrr * 100) / 100,
      growth: last12Months,
    },
  });
}));

// ==================== REVENUE ====================

router.get('/revenue', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const plans = await prisma.subscriptionPlan.findMany({
    select: { id: true, name: true, priceMonthlyKes: true, priceYearlyKes: true },
  });

  const restaurantCountByPlan = await prisma.restaurant.groupBy({
    by: ['planId'],
    _count: { id: true },
  });

  const planCountMap: Record<string, number> = {};
  for (const r of restaurantCountByPlan) {
    planCountMap[r.planId] = r._count.id;
  }

  const revenueByPlan = plans.map((plan) => ({
    planName: plan.name,
    subscriberCount: planCountMap[plan.id] || 0,
    monthlyRevenue: (planCountMap[plan.id] || 0) * Number(plan.priceMonthlyKes),
    yearlyRevenue: (planCountMap[plan.id] || 0) * Number(plan.priceYearlyKes),
  }));

  const now = new Date();
  const mrrChart: Array<{ month: string; mrr: number }> = [];

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const restaurantsInMonth = await prisma.restaurant.findMany({
      where: { createdAt: { lte: monthStart } },
      select: { planId: true },
    });

    let mrr = 0;
    for (const r of restaurantsInMonth) {
      const plan = plans.find((p) => p.id === r.planId);
      if (plan) mrr += Number(plan.priceMonthlyKes);
    }

    mrrChart.push({ month: monthStart.toISOString().slice(0, 7), mrr: Math.round(mrr * 100) / 100 });
  }

  const upcomingRenewals = await prisma.restaurant.findMany({
    where: {
      planExpiresAt: {
        gte: now,
        lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      name: true,
      planExpiresAt: true,
      owner: { select: { fullName: true, email: true, phone: true } },
      plan: { select: { id: true, name: true, priceMonthlyKes: true } },
    },
    orderBy: { planExpiresAt: 'asc' },
  });

  res.json({
    success: true,
    data: {
      revenueByPlan,
      mrrChart,
      upcomingRenewals,
    },
  });
}));

// ==================== SUPPORT TICKETS ====================

router.get('/support-tickets', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, perPage } = parsePagination(req.query as any);
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;

  const where: any = {
    type: 'CAMERA_ALERT',
  };

  if (status === 'open') where.isRead = false;
  else if (status === 'closed') where.isRead = true;

  const [tickets, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        restaurant: {
          select: { id: true, name: true, owner: { select: { fullName: true, email: true, phone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    success: true,
    data: tickets.map((t) => ({
      id: t.id,
      restaurantName: t.restaurant?.name,
      ownerName: t.restaurant?.owner?.fullName,
      ownerEmail: t.restaurant?.owner?.email,
      ownerPhone: t.restaurant?.owner?.phone,
      title: t.title,
      message: t.message,
      status: t.isRead ? 'resolved' : 'open',
      createdAt: t.createdAt,
    })),
    meta: buildPaginationMeta(total, page, perPage),
  });
}));

router.post('/support-tickets/:id/reply', validate(replyTicketSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = req.params.id;
  const { message } = req.body as z.infer<typeof replyTicketSchema>;

  const ticket = await prisma.notification.findUnique({
    where: { id: ticketId },
    include: { restaurant: { select: { id: true, name: true, owner: { select: { email: true, phone: true } } } } },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'Tiketi haikupatikana');
  }

  await prisma.notification.update({
    where: { id: ticketId },
    data: { isRead: true, readAt: new Date() },
  });

  if (ticket.restaurant?.owner?.email) {
    try {
      await sendEmailHelper({
        to: ticket.restaurant.owner.email,
        subject: `Re: ${ticket.title} - MenuMoja Support`,
        html: `<h3>Support Reply</h3><p>${message}</p><hr/><p>Original: ${ticket.message}</p>`,
        text: `Support Reply: ${message}\n\nOriginal: ${ticket.message}`,
        from: process.env.EMAIL_FROM || 'MenuMoja <noreply@menumoja.co.ke>',
      });
    } catch (err) {
      logger.error('Failed to send support reply email', { ticketId, error: err });
    }
  }

  logger.info('Support ticket replied', { ticketId, adminId: req.user?.userId });

  res.json({ success: true, data: { message: 'Reply sent', ticketId } });
}));

router.put('/support-tickets/:id/close', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = req.params.id;

  const ticket = await prisma.notification.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new NotFoundError('Ticket not found', 'Tiketi haikupatikana');
  }

  await prisma.notification.update({
    where: { id: ticketId },
    data: { isRead: true, readAt: new Date() },
  });

  logger.info('Support ticket closed', { ticketId, adminId: req.user?.userId });

  res.json({ success: true, data: { message: 'Ticket closed' } });
}));

// ==================== BROADCAST ====================

router.post('/broadcast', validate(broadcastSchema), auditLog, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subject, message, sendSms, sendEmail } = req.body as z.infer<typeof broadcastSchema>;

  const owners = await prisma.owner.findMany({
    select: { id: true, fullName: true, email: true, phone: true },
  });

  if (owners.length === 0) {
    throw new AppError(400, 'NO_OWNERS', 'No restaurant owners found', 'Hakuna wamiliki wa migahawa');
  }

  let smsSent = 0;
  let emailSent = 0;

  if (sendSms) {
    const phoneChunks: string[] = [];
    for (const owner of owners) {
      if (owner.phone) phoneChunks.push(owner.phone);
    }

    if (phoneChunks.length > 0) {
      try {
        const smsBody = `${subject}\n\n${message.substring(0, 1500)}`;
        const result = await africasTalking.sendBulkSMS(phoneChunks, smsBody);
        smsSent = result.results.filter((r) => r.status === 'Sent' || r.status === 'Success').length;
      } catch (err) {
        logger.error('Broadcast SMS failed', { error: err });
      }
    }
  }

  if (sendEmail) {
    for (const owner of owners) {
      if (owner.email) {
        try {
          await sendEmailHelper({
            to: owner.email,
            subject: `[MenuMoja] ${subject}`,
            html: `<h3>${subject}</h3><p>Dear ${owner.fullName},</p><p>${message.replace(/\n/g, '<br/>')}</p><hr/><p>MenuMoja Team</p>`,
            text: `Dear ${owner.fullName},\n\n${message}\n\nMenuMoja Team`,
            from: process.env.EMAIL_FROM || 'MenuMoja <noreply@menumoja.co.ke>',
          });
          emailSent++;
        } catch (err) {
          logger.error('Broadcast email failed for owner', { ownerId: owner.id, error: err });
        }
      }
    }
  }

  logger.info('Broadcast sent to all owners', {
    adminId: req.user?.userId,
    totalOwners: owners.length,
    smsSent,
    emailSent,
  });

  res.json({
    success: true,
    data: {
      totalOwners: owners.length,
      smsSent,
      emailSent,
    },
  });
}));

export default router;
