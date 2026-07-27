import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, optionalAuth, enforceRestaurantScope, validate, validateQuery, validateParams, generalLimiter, auditLog, asyncHandler } from '@/middleware';
import { AppError, NotFoundError, ValidationError } from '@/utils/errors';
import { generateOrderNumber, calculateTotals, buildPaginationMeta } from '@/utils/helpers';
import { updateOrderStatusSchema } from '@/utils/validation';
import { mpesaService } from '@/services';
import { io } from '@/hooks/socket';
import logger from '@/utils/logger';

const router = Router();

const orderIdParamSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid order ID'),
});

const orderListQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tableNumber: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const historyQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const exportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const assignWaiterSchema = z.object({
  waiterId: z.string().uuid('Invalid waiter ID'),
}).strict();

const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
}).strict();

const customerCreateOrderSchema = z.object({
  restaurantId: z.string().uuid('Invalid restaurant ID').optional(),
  restaurantSlug: z.string().optional(),
  tableId: z.string().uuid('Invalid table ID').optional(),
  sessionId: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid('Invalid menu item ID'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    specialInstructions: z.string().max(500).optional(),
  })).min(1, 'At least one item is required'),
  specialNotes: z.string().max(1000).optional(),
  paymentMethod: z.enum(['mpesa', 'cash', 'card']).default('cash'),
  customerPhone: z.string().optional(),
});

const TRANSITION_MAP: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
};

const STATUS_PRIORITY: Record<string, number> = {
  CONFIRMED: 1,
  PREPARING: 2,
  READY: 3,
  PENDING: 4,
};

// ── Customer Facing Routes ──

router.post('/public/create',
  generalLimiter,
  optionalAuth,
  validate(customerCreateOrderSchema),
  asyncHandler(async (req, res) => {
    let { restaurantId, restaurantSlug, tableId, tableNumber, sessionId, items, specialNotes, paymentMethod } = req.body;

    if (!restaurantId && restaurantSlug) {
      const slugRestaurant = await prisma.restaurant.findUnique({
        where: { slug: restaurantSlug },
        select: { id: true },
      });
      if (slugRestaurant) restaurantId = slugRestaurant.id;
    }

    if (!restaurantId) {
      throw new AppError(400, 'RESTAURANT_REQUIRED', 'Restaurant ID or slug is required', 'Kitambulisho cha mgahawa kinahitajika');
    }

    sessionId = sessionId || uuidv4();

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, isActive: true, isSuspended: true },
    });

    if (!restaurant) {
      throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
    }

    if (!restaurant.isActive || restaurant.isSuspended) {
      throw new AppError(403, 'RESTAURANT_UNAVAILABLE', 'Restaurant is not currently accepting orders', 'Mgahawa haupokei agizo kwa sasa');
    }

    const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        preparationTimeMinutes: true,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      const foundIds = new Set(menuItems.map((m) => m.id));
      const missing = menuItemIds.filter((id: string) => !foundIds.has(id));
      throw new ValidationError(
        `Some items are unavailable or do not belong to this restaurant: ${missing.join(', ')}`,
        'Baadhi ya bidhaa hazipatikani au si za mgahawa huu'
      );
    }

    const pricesMap = new Map(menuItems.map((m) => [m.id, Number(m.price)]));
    const orderItems = items.map((i: { menuItemId: string; quantity: number; specialInstructions?: string }) => ({
      menuItemId: i.menuItemId,
      quantity: i.quantity,
      specialInstructions: i.specialInstructions || null,
      price: pricesMap.get(i.menuItemId) || 0,
    }));

    const totals = calculateTotals(orderItems.map((oi: { price: number; quantity: number }) => ({ price: oi.price, quantity: oi.quantity })));

    let tableNumberValue: number | null = null;

    if (tableId) {
      const table = await prisma.restaurantTable.findUnique({
        where: { id: tableId },
        select: { id: true, tableNumber: true, restaurantId: true },
      });

      if (!table || table.restaurantId !== restaurantId) {
        throw new ValidationError('Table not found in this restaurant', 'Meza haikupatikana katika mgahawa huu');
      }

      tableNumberValue = table.tableNumber;

      await prisma.restaurantTable.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED', currentSessionId: sessionId },
      });
    } else if (tableNumber && tableNumber > 0) {
      tableNumberValue = tableNumber;
      const table = await prisma.restaurantTable.findFirst({
        where: { restaurantId, tableNumber },
      });
      if (table) {
        await prisma.restaurantTable.update({
          where: { id: table.id },
          data: { status: 'OCCUPIED', currentSessionId: sessionId },
        });
      }
    }

    const orderNumber = generateOrderNumber(restaurantId);

    const estimatedPrepMinutes = Math.max(
      ...menuItems.map((m) => m.preparationTimeMinutes || 10),
      10
    );

    const order = await prisma.order.create({
      data: {
        orderNumber,
        restaurantId,
        tableId: tableId || null,
        tableNumber: tableNumberValue,
        sessionId,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentMethod: paymentMethod === 'mpesa' ? 'MPESA' : paymentMethod === 'card' ? 'CARD' : 'CASH',
        subtotal: totals.subtotal,
        serviceCharge: totals.serviceCharge,
        taxAmount: totals.tax,
        tipAmount: 0,
        totalAmount: totals.total,
        specialNotes: specialNotes || null,
        estimatedPrepMinutes,
        items: {
          create: orderItems.map((oi: { menuItemId: string; quantity: number; specialInstructions: string | null; price: number }) => {
            const menuItem = menuItems.find((m) => m.id === oi.menuItemId)!;
            return {
              menuItemId: oi.menuItemId,
              itemName: menuItem.name,
              itemPrice: oi.price,
              quantity: oi.quantity,
              specialInstructions: oi.specialInstructions,
              subtotal: oi.price * oi.quantity,
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });

    logger.info('Order created', { orderId: order.id, orderNumber, restaurantId });

    if (paymentMethod === 'mpesa') {
      try {
        const result = await mpesaService.initiatePayment(
          order.id,
          createOrderService(),
          createPaymentService()
        );
        logger.info('M-Pesa payment initiated for order', { orderId: order.id, checkoutRequestId: result.checkoutRequestId });
      } catch (mpesaError) {
        logger.error('Failed to initiate M-Pesa payment', { error: mpesaError, orderId: order.id });
      }
    }

    try {
      io.to(`restaurant:${restaurantId}`).emit('order:new', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        estimatedPrepMinutes: order.estimatedPrepMinutes,
        itemCount: order.items.length,
        createdAt: order.createdAt,
      });
    } catch (socketError) {
      logger.error('Failed to emit order:new socket event', { error: socketError });
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        estimatedPrepMinutes: order.estimatedPrepMinutes,
        totalAmount: Number(order.totalAmount),
      },
    });
  })
);

router.get('/public/:orderId/status',
  validateParams(orderIdParamSchema),
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        estimatedPrepMinutes: true,
        confirmedAt: true,
        preparedAt: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            itemPrice: true,
            subtotal: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    let estimatedTimeRemaining: number | null = null;
    if (order.estimatedPrepMinutes && order.confirmedAt) {
      const elapsed = Math.floor((Date.now() - new Date(order.confirmedAt).getTime()) / 60000);
      estimatedTimeRemaining = Math.max(0, order.estimatedPrepMinutes - elapsed);
    } else if (order.estimatedPrepMinutes) {
      estimatedTimeRemaining = order.estimatedPrepMinutes;
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        estimatedTimeRemaining,
        items: order.items.map((item) => ({
          name: item.itemName,
          quantity: item.quantity,
          price: Number(item.itemPrice),
        })),
      },
    });
  })
);

// ── Owner/Staff Facing Routes ──

router.get('/',
  authenticate,
  enforceRestaurantScope,
  validateQuery(orderListQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { status, paymentStatus, dateFrom, dateTo, tableNumber, page, perPage } = req.query as any;

    const where: any = { restaurantId };

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (tableNumber) where.tableNumber = tableNumber;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePerPage = Math.min(100, Math.max(1, Number(perPage) || 20));
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePerPage,
        take: safePerPage,
        select: {
          id: true,
          orderNumber: true,
          tableNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          totalAmount: true,
          estimatedPrepMinutes: true,
          createdAt: true,
          specialNotes: true,
          items: {
            select: { id: true, itemName: true, quantity: true, itemPrice: true, subtotal: true, specialInstructions: true },
          },
          waiter: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        totalAmount: Number(o.totalAmount),
        estimatedPrepMinutes: o.estimatedPrepMinutes,
        createdAt: o.createdAt,
        items: o.items || [],
        specialNotes: o.specialNotes,
        waiter: o.waiter,
        itemCount: o._count.items,
      })),
      meta: buildPaginationMeta(total, page, perPage),
    });
  })
);

router.get('/live',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        orderNumber: true,
        tableNumber: true,
        status: true,
        totalAmount: true,
        confirmedAt: true,
        createdAt: true,
        updatedAt: true,
        estimatedPrepMinutes: true,
        specialNotes: true,
        items: {
          select: { id: true, itemName: true, quantity: true, itemPrice: true, subtotal: true, specialInstructions: true },
        },
        waiter: { select: { id: true, fullName: true } },
      },
    });

    const now = Date.now();
    const data = orders
      .map((o) => {
        const elapsedMinutes = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
        const confirmedElapsed = o.confirmedAt
          ? Math.floor((now - new Date(o.confirmedAt).getTime()) / 60000)
          : null;

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          tableNumber: o.tableNumber,
          status: o.status,
          totalAmount: Number(o.totalAmount),
          elapsedMinutes,
          confirmedElapsedMinutes: confirmedElapsed,
          estimatedPrepMinutes: o.estimatedPrepMinutes,
          items: o.items,
          waiter: o.waiter,
          createdAt: o.createdAt,
        };
      })
      .sort((a, b) => {
        const aPrio = STATUS_PRIORITY[a.status] || 99;
        const bPrio = STATUS_PRIORITY[b.status] || 99;
        if (aPrio !== bPrio) return aPrio - bPrio;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    res.json({ success: true, data });
  })
);

router.get('/:id',
  authenticate,
  enforceRestaurantScope,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: {
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
                preparationTimeMinutes: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        table: {
          select: { id: true, tableNumber: true, label: true },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        waiter: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    res.json({
      success: true,
      data: {
        ...order,
        subtotal: Number(order.subtotal),
        serviceCharge: Number(order.serviceCharge),
        taxAmount: Number(order.taxAmount),
        tipAmount: Number(order.tipAmount),
        totalAmount: Number(order.totalAmount),
        items: order.items.map((item) => ({
          ...item,
          itemPrice: Number(item.itemPrice),
          subtotal: Number(item.subtotal),
        })),
        payments: order.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
          cashReceived: p.cashReceived ? Number(p.cashReceived) : null,
          changeGiven: p.changeGiven ? Number(p.changeGiven) : null,
        })),
      },
    });
  })
);

router.put('/:id/status',
  authenticate,
  enforceRestaurantScope,
  auditLog,
  validateParams(idParamSchema),
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { id } = req.params;
    const { status, reason } = req.body;

    const newStatus = status.toUpperCase();

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: {
        payments: {
          where: { status: 'PAID', paymentMethod: 'MPESA' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    const allowedTransitions = TRANSITION_MAP[order.status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${order.status} to ${newStatus}. Allowed: ${(allowedTransitions || []).join(', ') || 'none'}`,
        `Haiwezi kubadilisha kutoka ${order.status} hadi ${newStatus}. Inaruhusiwa: ${(allowedTransitions || []).join(', ') || 'hakuna'}`
      );
    }

    const updateData: any = { status: newStatus };

    switch (newStatus) {
      case 'CONFIRMED':
        updateData.confirmedAt = new Date();
        break;
      case 'PREPARING':
        if (order.status === 'CONFIRMED') {
          updateData.preparedAt = new Date();
        }
        break;
      case 'READY':
        updateData.preparedAt = order.preparedAt || new Date();
        break;
      case 'SERVED':
        updateData.servedAt = new Date();
        break;
      case 'CANCELLED':
        updateData.cancelledAt = new Date();
        updateData.cancelledReason = reason || null;
        break;
    }

    if (newStatus === 'CANCELLED' && order.payments.length > 0) {
      const mpesaPayment = order.payments[0];
      try {
        await mpesaService.initiateRefund(
          order.id,
          Number(order.totalAmount),
          order.customerPhone || '',
          createOrderService(),
          createPaymentService()
        );
        logger.info('Refund initiated for cancelled order', { orderId: order.id });
      } catch (refundError) {
        logger.error('Failed to initiate refund', { error: refundError, orderId: order.id });
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        confirmedAt: true,
        preparedAt: true,
        servedAt: true,
        cancelledAt: true,
        cancelledReason: true,
      },
    });

    try {
      io.to(`restaurant:${restaurantId}`).emit('order:status-changed', {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
      });
      io.to(`order:${updated.orderNumber}`).emit('order:status-changed', {
        status: updated.status,
      });
    } catch (socketError) {
      logger.error('Failed to emit order:status-changed socket event', { error: socketError });
    }

    logger.info('Order status updated', { orderId: id, from: order.status, to: newStatus, userId: req.user?.userId });

    res.json({ success: true, data: updated });
  })
);

router.put('/:id/assign-waiter',
  authenticate,
  enforceRestaurantScope,
  validateParams(idParamSchema),
  validate(assignWaiterSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { id } = req.params;
    const { waiterId } = req.body;

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    const waiter = await prisma.staff.findFirst({
      where: { id: waiterId, restaurantId, isActive: true },
      select: { id: true, fullName: true },
    });

    if (!waiter) {
      throw new NotFoundError('Waiter not found in this restaurant', 'Mhudumu hajakupatikana katika mgahawa huu');
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { waiterId },
      select: {
        id: true,
        orderNumber: true,
        waiterId: true,
        waiter: { select: { id: true, fullName: true } },
      },
    });

    res.json({ success: true, data: updated });
  })
);

router.post('/:id/complaint',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const orderId = req.params.id;
    const { type, description, evidence } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    logger.info('Complaint submitted', { orderId, type, description, restaurantId });

    res.json({
      success: true,
      data: {
        message: 'Complaint submitted successfully',
        messageSwahili: 'Malalamiko yamewasilishwa kwa mafanikio',
      },
    });
  })
);

router.delete('/:id',
  authenticate,
  enforceRestaurantScope,
  validateParams(idParamSchema),
  validate(cancelOrderSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.findFirst({
      where: { id, restaurantId },
      include: {
        payments: {
          where: { status: 'PAID' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      throw new ValidationError(
        'Only pending or confirmed orders can be cancelled',
        'Agizo linatakiwa kuwa linangoja au limehakikishwa ili kughairi'
      );
    }

    const updateData: any = {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledReason: reason || null,
    };

    if (order.payments.length > 0) {
      try {
        await mpesaService.initiateRefund(
          order.id,
          Number(order.totalAmount),
          order.customerPhone || '',
          createOrderService(),
          createPaymentService()
        );
      } catch (refundError) {
        logger.error('Failed to initiate refund on cancel', { error: refundError, orderId: order.id });
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        cancelledAt: true,
        cancelledReason: true,
      },
    });

    try {
      io.to(`restaurant:${restaurantId}`).emit('order:status-changed', {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
      });
    } catch (socketError) {
      logger.error('Failed to emit order cancelled socket event', { error: socketError });
    }

    res.json({ success: true, data: updated });
  })
);

router.get('/history',
  authenticate,
  enforceRestaurantScope,
  validateQuery(historyQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { dateFrom, dateTo, search, page, perPage } = req.query as any;

    const where: any = {
      restaurantId,
      status: { in: ['SERVED', 'CANCELLED'] },
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { tableNumber: isNaN(Number(search)) ? undefined : Number(search) },
      ].filter(Boolean);
    }

    const hSafePage = Math.max(1, Number(page) || 1);
    const hSafePerPage = Math.min(100, Math.max(1, Number(perPage) || 20));
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (hSafePage - 1) * hSafePerPage,
        take: hSafePerPage,
        select: {
          id: true,
          orderNumber: true,
          tableNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          totalAmount: true,
          createdAt: true,
          servedAt: true,
          cancelledAt: true,
          waiter: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        totalAmount: Number(o.totalAmount),
        createdAt: o.createdAt,
        servedAt: o.servedAt,
        cancelledAt: o.cancelledAt,
        waiter: o.waiter,
        itemCount: o._count.items,
      })),
      meta: buildPaginationMeta(total, page, perPage),
    });
  })
);

router.get('/export',
  authenticate,
  enforceRestaurantScope,
  validateQuery(exportQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { startDate, endDate } = req.query as z.infer<typeof exportQuerySchema>;

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        items: {
          select: { itemName: true, quantity: true },
        },
        payments: {
          select: { paymentMethod: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const headers = [
      'Order#',
      'Table',
      'Items',
      'Total (KES)',
      'Payment Method',
      'Status',
      'Date',
    ];

    const csvRows = orders.map((o) => {
      const itemsStr = o.items.map((i) => `${i.itemName} x${i.quantity}`).join('; ');
      const paymentMethod = o.payments[0]?.paymentMethod || o.paymentMethod;
      return [
        o.orderNumber,
        o.tableNumber || 'N/A',
        `"${itemsStr}"`,
        Number(o.totalAmount).toFixed(2),
        paymentMethod,
        o.status,
        o.createdAt.toISOString(),
      ].join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${startDate.substring(0, 10)}-${endDate.substring(0, 10)}.csv"`);
    res.send(csv);
  })
);

// ── Kitchen Display Routes ──

router.get('/kitchen',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const userRole = req.user?.role;

    if (userRole !== 'kitchen' && userRole !== 'manager' && userRole !== 'super_admin') {
      throw new AppError(403, 'FORBIDDEN', 'Only kitchen staff and managers can view kitchen display', 'Wafanyakazi wa jikoni na wasimamizi pekee wanaweza kuona onyesho la jikoni');
    }

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ['CONFIRMED', 'PREPARING'] },
      },
      orderBy: { confirmedAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        tableNumber: true,
        status: true,
        confirmedAt: true,
        estimatedPrepMinutes: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            itemName: true,
            quantity: true,
            specialInstructions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        waiter: { select: { id: true, fullName: true } },
      },
    });

    const now = Date.now();
    const data = orders.map((o) => {
      const confirmedTime = o.confirmedAt || o.createdAt;
      const elapsedSeconds = Math.floor((now - new Date(confirmedTime).getTime()) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const timer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      const isOverdue = o.estimatedPrepMinutes
        ? minutes > o.estimatedPrepMinutes
        : minutes > 20;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        status: o.status,
        timer,
        elapsedMinutes: minutes,
        estimatedPrepMinutes: o.estimatedPrepMinutes,
        isOverdue,
        items: o.items,
        waiter: o.waiter,
        confirmedAt: o.confirmedAt,
      };
    });

    res.json({ success: true, data });
  })
);

// ── Helper Functions ──

function createOrderService() {
  return {
    getOrderById: async (orderId: string) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          restaurant: { select: { name: true } },
          items: { select: { itemName: true, quantity: true, itemPrice: true } },
          payments: { take: 1, select: { id: true } },
        },
      });
      if (!order) return null;
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        amount: Number(order.totalAmount),
        customerPhone: order.customerPhone || '',
        restaurantId: order.restaurantId,
        status: order.status,
        items: order.items.map((i) => ({ name: i.itemName, quantity: i.quantity, price: Number(i.itemPrice) })),
        totalAmount: Number(order.totalAmount),
        restaurantName: order.restaurant.name,
        paymentId: order.payments[0]?.id,
      };
    },
    updateOrderPayment: async (orderId: string, paymentData: { paymentId: string; status: string; mpesaReceipt?: string }) => {
      const updateData: any = {
        paymentStatus: paymentData.status === 'paid' ? 'PAID' : 'UNPAID',
      };
      await prisma.order.update({ where: { id: orderId }, data: updateData });
    },
    updateOrderStatus: async (orderId: string, status: string) => {
      await prisma.order.update({ where: { id: orderId }, data: { status: status as any } });
    },
    getCustomerPhone: async (orderId: string) => {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerPhone: true } });
      return order?.customerPhone || '';
    },
    getRestaurantName: async (orderId: string) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { restaurant: { select: { name: true } } },
      });
      return order?.restaurant.name || '';
    },
    getOwnerPhone: async (orderId: string) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { restaurant: { include: { owner: { select: { phone: true } } } } },
      });
      return order?.restaurant.owner.phone || '';
    },
  };
}

function createPaymentService() {
  return {
    createPayment: async (data: {
      orderId: string;
      amount: number;
      phone: string;
      method: string;
      checkoutRequestId: string;
      status: string;
    }) => {
      const ord = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { restaurantId: true },
      });
      const payment = await prisma.payment.create({
        data: {
          orderId: data.orderId,
          restaurantId: ord?.restaurantId || '',
          amount: data.amount,
          paymentMethod: data.method === 'mpesa' ? 'MPESA' : data.method === 'card' ? 'CARD' : 'CASH',
          status: data.status as any,
          mpesaCheckoutRequestId: data.checkoutRequestId,
          mpesaPhone: data.phone,
        },
      });
      return {
        id: payment.id,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        phone: payment.mpesaPhone || '',
        method: payment.paymentMethod,
        status: payment.status,
        checkoutRequestId: payment.mpesaCheckoutRequestId || '',
        mpesaReceiptNumber: payment.mpesaReceiptNumber || undefined,
        transactionDate: payment.processedAt?.toISOString(),
      };
    },
    updatePayment: async (checkoutRequestId: string, data: Record<string, any>) => {
      await prisma.payment.updateMany({
        where: { mpesaCheckoutRequestId: checkoutRequestId },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.mpesaReceiptNumber ? { mpesaReceiptNumber: data.mpesaReceiptNumber } : {}),
          ...(data.amount ? { amount: data.amount } : {}),
          ...(data.resultCode !== undefined ? { notes: `ResultCode: ${data.resultCode}` } : {}),
          ...(data.transactionDate ? { processedAt: new Date(data.transactionDate) } : {}),
        },
      });
    },
    getPaymentByCheckoutRequestId: async (checkoutRequestId: string) => {
      const payment = await prisma.payment.findFirst({
        where: { mpesaCheckoutRequestId: checkoutRequestId },
      });
      if (!payment) return null;
      return {
        id: payment.id,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        phone: payment.mpesaPhone || '',
        method: payment.paymentMethod,
        status: payment.status,
        checkoutRequestId: payment.mpesaCheckoutRequestId || '',
        mpesaReceiptNumber: payment.mpesaReceiptNumber || undefined,
        transactionDate: payment.processedAt?.toISOString(),
      };
    },
    getPendingPaymentsOlderThan: async (minutes: number) => {
      const cutoff = new Date(Date.now() - minutes * 60000);
      const payments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
          mpesaCheckoutRequestId: { not: null },
          createdAt: { lt: cutoff },
        },
      });
      return payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: Number(p.amount),
        phone: p.mpesaPhone || '',
        method: p.paymentMethod,
        status: p.status,
        checkoutRequestId: p.mpesaCheckoutRequestId || '',
        mpesaReceiptNumber: p.mpesaReceiptNumber || undefined,
        transactionDate: p.processedAt?.toISOString(),
      }));
    },
  };
}

export default router;
