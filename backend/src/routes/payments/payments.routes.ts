import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, enforceRestaurantScope, validate, validateQuery, validateParams, mpesaLimiter, auditLog, asyncHandler } from '@/middleware';
import { AppError, NotFoundError, ValidationError } from '@/utils/errors';
import { formatKES, buildPaginationMeta } from '@/utils/helpers';
import { getIdempotencyKey, findIdempotentPayment, recordPaymentIdempotency, isUniqueViolation } from '@/utils/idempotency';
import { initiateMpesaSchema, recordCashSchema, receiptListQuerySchema } from '@/utils/validation';
import { mpesaService } from '@/services';
import { createReceiptForPayment, getReceiptById } from '@/services/receipt.service';
import { computeReconciliation, runReconciliation, listReconciliations } from '@/services/reconciliation.service';
import { upsertCustomer, recordCustomerSpend } from '@/services/customer.service';
import { processPayment as processLoyaltyPayment } from '@/services/loyalty.service';
import { freeTableIfLastOrder } from '@/services/table.service';
import * as mpesa from '@/integrations/mpesa';
import { io } from '@/hooks/socket';
import logger from '@/utils/logger';

const SAFARICOM_IPS = [
  '196.201.214.200', '196.201.214.206', '196.201.213.200', '196.201.213.206',
  '196.201.214.208', '196.201.213.208', '196.201.214.207', '196.201.213.207',
  '196.202.0.0/15',
];

const isProductionCallback = process.env.NODE_ENV === 'production';

function verifyMpesaCallback(req: any, _res: any, next: any) {
  if (isProductionCallback) {
    const clientIp = req.ip || req.connection?.remoteAddress;
    const isAllowed = SAFARICOM_IPS.some((cidr) => {
      if (cidr.includes('/')) {
        const [range, bits] = cidr.split('/');
        const mask = ~(2 ** (32 - parseInt(bits)) - 1);
        const clientNum = ipToInt(clientIp);
        const rangeNum = ipToInt(range);
        return (clientNum & mask) === (rangeNum & mask);
      }
      return clientIp === cidr;
    });

    if (!isAllowed) {
      logger.warn('M-Pesa callback rejected: IP not whitelisted', { clientIp });
      return _res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
    }
  }

  const callbackBody = req.body;
  if (!callbackBody?.Body?.stkCallback) {
    logger.warn('Invalid M-Pesa callback body structure');
    return _res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid request' });
  }

  next();
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

const checkoutIdParamSchema = z.object({
  checkoutRequestId: z.string().min(1, 'Checkout request ID is required'),
});

const paymentQuerySchema = z.object({
  method: z.enum(['mpesa', 'cash']).optional(),
  status: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const reportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

const taxReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ── M-PESA Routes ──

router.post('/mpesa/initiate',
  mpesaLimiter,
  authenticate,
  enforceRestaurantScope,
  auditLog,
  validate(initiateMpesaSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const idempotencyKey = getIdempotencyKey(req);

    if (idempotencyKey) {
      const existing = await findIdempotentPayment(idempotencyKey, `pay:${restaurantId}`);
      if (existing && existing.mpesaCheckoutRequestId) {
        logger.info('Reusing idempotent M-Pesa initiation', { paymentId: existing.id, restaurantId });
        res.status(201).json({
          success: true,
          data: {
            paymentId: existing.id,
            checkoutRequestId: existing.mpesaCheckoutRequestId,
            status: existing.status,
            idempotentReplay: true,
          },
        });
        return;
      }
    }

    const { orderId, phone } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paymentStatus: true,
        status: true,
        customerPhone: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    if (order.paymentStatus === 'PAID') {
      throw new ValidationError('Order is already paid', 'Agizo tayari limelipwa');
    }

    if (order.status === 'CANCELLED') {
      throw new ValidationError('Order is cancelled', 'Agizo limeghairiwa');
    }

    const existingPending = await prisma.payment.findFirst({
      where: {
        orderId,
        status: 'PENDING',
        paymentMethod: 'MPESA',
        createdAt: { gte: new Date(Date.now() - 5 * 60000) },
      },
    });

    if (existingPending) {
      throw new ValidationError(
        'A pending M-Pesa payment already exists for this order',
        'Malipo ya M-Pesa yanayosubiri tayari yapo kwa agizo hili'
      );
    }

    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      throw new ValidationError(
        'Phone must be a valid Safaricom number (e.g., 2547XXXXXXXX or 2541XXXXXXXX)',
        'Nambari ya simu lazima iwe halali ya Safaricom (mfano 2547XXXXXXXX au 2541XXXXXXXX)'
      );
    }

    logger.info('Initiating M-Pesa STK Push', { orderId: order.id, amount: Number(order.totalAmount), phone: formattedPhone });

    await prisma.order.update({
      where: { id: order.id },
      data: { customerPhone: formattedPhone },
    });

    const result = await mpesaService.initiatePayment(
      order.id,
      createOrderService(),
      createPaymentService(idempotencyKey)
    );

    if (idempotencyKey) {
      try {
        const payment = await createPaymentService().getPaymentByCheckoutRequestId(result.checkoutRequestId);
        if (payment) {
          await recordPaymentIdempotency(idempotencyKey, `pay:${restaurantId}`, payment.id);
        }
      } catch (idemError) {
        logger.error('Failed to record M-Pesa payment idempotency', { error: idemError, restaurantId });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        checkoutRequestId: result.checkoutRequestId,
        merchantRequestId: result.MerchantRequestID,
        responseDescription: result.ResponseDescription,
        amount: Number(order.totalAmount),
      },
    });
  })
);

router.post('/mpesa/callback',
  verifyMpesaCallback,
  asyncHandler(async (req, res) => {
    const callbackBody = req.body;
    const checkoutRequestId = callbackBody.Body.stkCallback.CheckoutRequestID;

    logger.info('M-Pesa callback received', {
      checkoutRequestId,
      resultCode: callbackBody.Body.stkCallback.ResultCode,
    });

    try {
      const idempotencyStatus = await mpesa.checkIdempotency(checkoutRequestId);

      try {
        await prisma.paymentWebhookEvent.create({
          data: {
            checkoutRequestId,
            payload: callbackBody as any,
            ipAddress: req.ip || null,
            isDuplicate: idempotencyStatus === 'completed',
            processed: idempotencyStatus !== 'completed',
            processedAt: new Date(),
          },
        });
      } catch (webhookLogError) {
        logger.error('Failed to persist webhook event', { error: webhookLogError, checkoutRequestId });
      }

      if (idempotencyStatus === 'completed') {
        logger.info('Duplicate M-Pesa callback, already processed', { checkoutRequestId });
        return res.json({ ResultCode: 0, ResultDesc: 'Success' });
      }

      const result = await mpesaService.handleCallback(
        callbackBody,
        createOrderService(),
        createPaymentService(),
        createSocketService()
      );

      if (result.success) {
        try {
          const payment = await createPaymentService().getPaymentByCheckoutRequestId(checkoutRequestId);
          if (payment) {
            await createReceiptForPayment(payment.id);
          }
        } catch (receiptError) {
          logger.error('Receipt generation after M-Pesa callback failed', { error: receiptError });
        }
        logger.info('M-Pesa callback processed successfully', { checkoutRequestId, message: result.message });
        return res.json({ ResultCode: 0, ResultDesc: 'Success' });
      } else {
        logger.warn('M-Pesa callback processing failed', { checkoutRequestId, message: result.message });
        return res.json({ ResultCode: 1, ResultDesc: result.message || 'Processing failed' });
      }
    } catch (error) {
      logger.error('M-Pesa callback processing error', { error, checkoutRequestId });
      return res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal error' });
    }
  })
);

router.get('/mpesa/:checkoutRequestId/status',
  validateParams(checkoutIdParamSchema),
  asyncHandler(async (req, res) => {
    const checkoutRequestId = String(req.params.checkoutRequestId);

    const payment = await prisma.payment.findFirst({
      where: { mpesaCheckoutRequestId: checkoutRequestId },
      select: {
        id: true,
        status: true,
        amount: true,
        mpesaReceiptNumber: true,
        mpesaPhone: true,
        processedAt: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found', 'Malipo hayakupatikana');
    }

    let externalStatus: string | null = null;
    if (payment.status === 'PENDING') {
      try {
        const queryResult = await mpesa.queryStatus(checkoutRequestId);
        externalStatus = queryResult.ResultCode === 0 ? 'completed' : 'failed';
      } catch {
        externalStatus = null;
      }
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        externalStatus,
        amount: Number(payment.amount),
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        mpesaPhone: payment.mpesaPhone,
        processedAt: payment.processedAt,
        createdAt: payment.createdAt,
        order: payment.order,
      },
    });
  })
);

// ── Cash Routes ──

router.post('/cash/record',
  authenticate,
  enforceRestaurantScope,
  auditLog,
  validate(recordCashSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const idempotencyKey = getIdempotencyKey(req);

    if (idempotencyKey) {
      const existing = await findIdempotentPayment(idempotencyKey, `pay:${restaurantId}`);
      if (existing) {
        logger.info('Reusing idempotent cash payment', { paymentId: existing.id, restaurantId });
        res.status(201).json({
          success: true,
          data: {
            paymentId: existing.id,
            orderId: existing.orderId,
            amount: Number(existing.amount),
            amountTendered: Number(existing.cashReceived || existing.amount),
            change: Number(existing.changeGiven || 0),
            processedAt: existing.processedAt,
            idempotentReplay: true,
          },
        });
        return;
      }
    }

    const { orderId, amount, amountTendered, discount, notes } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paymentStatus: true,
        status: true,
        tableId: true,
        customerName: true,
        customerPhone: true,
      },
    });

    if (!order) {
      throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    }

    if (order.paymentStatus === 'PAID') {
      throw new ValidationError('Order is already paid', 'Agizo tayari limelipwa');
    }

    const effectiveTotal = Number(order.totalAmount) - (discount || 0);
    if (amount > effectiveTotal) {
      throw new ValidationError(
        `Payment amount ${formatKES(amount)} exceeds order total ${formatKES(effectiveTotal)}`,
        `Kiasi cha malipo ${formatKES(amount)} kinazidi jumla ya agizo ${formatKES(effectiveTotal)}`
      );
    }

    const change = amountTendered - amount;
    const cashierId = req.user?.userId;

    if (!cashierId) {
      throw new AppError(400, 'CASHIER_REQUIRED', 'Cashier identification is required', 'Kitambulisho cha mweka hazina kinahitajika');
    }

    let payment: any;
    try {
      [payment] = await Promise.all([
        prisma.payment.create({
          data: {
            restaurantId,
            orderId,
            paymentMethod: 'CASH',
            amount,
            status: 'PAID',
            cashReceived: amountTendered,
            changeGiven: change,
            cashierId,
            processedAt: new Date(),
            notes: notes || null,
            idempotencyKey: idempotencyKey || null,
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID' },
        }),
      ]);
    } catch (error) {
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await findIdempotentPayment(idempotencyKey, `pay:${restaurantId}`);
        if (existing) {
          logger.info('Cash payment idempotency race resolved', { paymentId: existing.id, restaurantId });
          res.status(201).json({
            success: true,
            data: {
              paymentId: existing.id,
              orderId: existing.orderId,
              amount: Number(existing.amount),
              amountTendered: Number(existing.cashReceived || existing.amount),
              change: Number(existing.changeGiven || 0),
              processedAt: existing.processedAt,
              idempotentReplay: true,
            },
          });
          return;
        }
      }
      throw error;
    }

    if (idempotencyKey) {
      await recordPaymentIdempotency(idempotencyKey, `pay:${restaurantId}`, payment.id);
    }

    try {
      const openShift = await prisma.cashReconciliation.findFirst({
        where: { restaurantId, cashierId, status: 'OPEN' },
      });

      if (openShift) {
        await prisma.cashReconciliation.update({
          where: { id: openShift.id },
          data: {
            expectedCash: { increment: amount },
          },
        });
      }
    } catch (reconError) {
      logger.error('Failed to update cash reconciliation', { error: reconError, orderId });
    }

    try {
      io.to(`restaurant:${restaurantId}`).emit('payment:recorded', {
        orderId,
        orderNumber: order.orderNumber,
        amount,
        change,
        method: 'CASH',
      });
    } catch (socketError) {
      logger.error('Failed to emit payment socket event', { error: socketError });
    }

    await freeTableIfLastOrder(restaurantId, orderId, order.tableId);

    const receipt = await createReceiptForPayment(payment.id);

    // Customer identity + spend (best-effort)
    if (order.customerPhone) {
      try {
        await upsertCustomer(restaurantId, {
          phone: order.customerPhone,
          name: order.customerName || undefined,
          source: 'POS',
        });
        await recordCustomerSpend(restaurantId, order.customerPhone, Number(payment.amount));
        await processLoyaltyPayment(restaurantId, order.customerPhone, orderId);
      } catch (customerError) {
        logger.error('Customer/loyalty processing failed (cash payment)', { error: customerError, restaurantId });
      }
    }

    logger.info('Cash payment recorded', { orderId, amount, cashierId });

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        amountTendered: Number(payment.cashReceived),
        change: Number(payment.changeGiven),
        processedAt: payment.processedAt,
        receiptId: receipt?.id || null,
        receiptNumber: receipt?.receiptNumber || null,
      },
    });
  })
);

// ── General Payment Routes ──

router.get('/',
  authenticate,
  enforceRestaurantScope,
  validateQuery(paymentQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { method, status, dateFrom, dateTo, page, perPage } = req.query as any;

    const where: any = { restaurantId };

    if (method) where.paymentMethod = method.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePerPage = Math.min(100, Math.max(1, Number(perPage) || 20));
    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePerPage,
        take: safePerPage,
        select: {
          id: true,
          paymentMethod: true,
          amount: true,
          status: true,
          mpesaReceiptNumber: true,
          cashReceived: true,
          changeGiven: true,
          processedAt: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              tableNumber: true,
            },
          },
          cashier: {
            select: { id: true, fullName: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        cashReceived: p.cashReceived ? Number(p.cashReceived) : null,
        changeGiven: p.changeGiven ? Number(p.changeGiven) : null,
      })),
      meta: buildPaginationMeta(total, page, perPage),
    });
  })
);

// GET /receipts - Receipt history with filters (for cashier receipt tracking)
router.get(
  '/receipts',
  authenticate,
  enforceRestaurantScope,
  validateQuery(receiptListQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { dateFrom, dateTo, method, tableNumber, q, page, perPage } = req.query as any;

    const where: any = { restaurantId, status: 'PAID' };
    if (method) where.paymentMethod = method;
    if (dateFrom || dateTo) {
      where.processedAt = {};
      if (dateFrom) where.processedAt.gte = new Date(dateFrom);
      if (dateTo) where.processedAt.lte = new Date(dateTo);
    }

    const orderWhere: any = {};
    if (tableNumber) orderWhere.tableNumber = tableNumber;
    if (q) {
      orderWhere.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { items: { some: { itemName: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    if (Object.keys(orderWhere).length > 0) {
      where.order = { is: orderWhere };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePerPage = Math.min(100, Math.max(1, Number(perPage) || 20));
    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip: (safePage - 1) * safePerPage,
        take: safePerPage,
        select: {
          id: true,
          paymentMethod: true,
          amount: true,
          status: true,
          mpesaReceiptNumber: true,
          cashReceived: true,
          changeGiven: true,
          processedAt: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              tableNumber: true,
              subtotal: true,
              serviceCharge: true,
              taxAmount: true,
              tipAmount: true,
              totalAmount: true,
              customerName: true,
              customerPhone: true,
              items: {
                select: { itemName: true, itemPrice: true, quantity: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
          cashier: {
            select: { id: true, fullName: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        cashReceived: p.cashReceived ? Number(p.cashReceived) : null,
        changeGiven: p.changeGiven ? Number(p.changeGiven) : null,
        order: p.order
          ? {
              ...p.order,
              subtotal: Number(p.order.subtotal || 0),
              serviceCharge: Number(p.order.serviceCharge || 0),
              taxAmount: Number(p.order.taxAmount || 0),
              tipAmount: Number(p.order.tipAmount || 0),
              totalAmount: Number(p.order.totalAmount || 0),
              items: (p.order.items || []).map((i: any) => ({
                ...i,
                itemPrice: Number(i.itemPrice || 0),
              })),
            }
          : null,
      })),
      meta: buildPaginationMeta(total, safePage, safePerPage),
    });
  })
);

// GET /receipts/:id - Single server-side receipt (must precede /:id)
router.get('/receipts/:id',
  authenticate,
  enforceRestaurantScope,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const receipt = await getReceiptById(String(id));
    if (receipt.restaurantId !== restaurantId) {
      throw new NotFoundError('Receipt not found', 'Risiti haikupatikana');
    }

    res.json({
      success: true,
      data: {
        ...receipt,
        amount: Number(receipt.amount),
        vatAmount: Number(receipt.vatAmount),
      },
    });
  })
);

router.get('/:id',
  authenticate,
  enforceRestaurantScope,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const payment = await prisma.payment.findFirst({
      where: { id, restaurantId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            tableNumber: true,
            totalAmount: true,
            status: true,
          },
        },
        cashier: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found', 'Malipo hayakupatikana');
    }

    res.json({
      success: true,
      data: {
        ...payment,
        amount: Number(payment.amount),
        cashReceived: payment.cashReceived ? Number(payment.cashReceived) : null,
        changeGiven: payment.changeGiven ? Number(payment.changeGiven) : null,
        order: payment.order ? {
          ...payment.order,
          totalAmount: Number(payment.order.totalAmount),
        } : null,
      },
    });
  })
);

router.get('/summary/today',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [payments, pendingCount, cashiersOnDuty] = await Promise.all([
      prisma.payment.findMany({
        where: {
          restaurantId,
          processedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: 'PAID',
        },
        select: {
          paymentMethod: true,
          amount: true,
        },
      }),
      prisma.order.count({
        where: {
          restaurantId,
          paymentStatus: 'UNPAID',
          status: { not: 'CANCELLED' },
          createdAt: { gte: todayStart },
        },
      }),
      prisma.cashReconciliation.findMany({
        where: {
          restaurantId,
          status: 'OPEN',
        },
        include: {
          cashier: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    let mpesaTotal = 0;
    let cashTotal = 0;
    let totalRevenue = 0;

    for (const p of payments) {
      const amt = Number(p.amount);
      totalRevenue += amt;
      if (p.paymentMethod === 'MPESA') {
        mpesaTotal += amt;
      } else if (p.paymentMethod === 'CASH') {
        cashTotal += amt;
      }
    }

    res.json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        mpesaTotal: Math.round(mpesaTotal * 100) / 100,
        cashTotal: Math.round(cashTotal * 100) / 100,
        pendingCount,
        cashiersOnDuty: cashiersOnDuty.map((r) => ({
          id: r.cashier.id,
          name: r.cashier.fullName,
          shiftId: r.id,
          shiftStartedAt: r.shiftStart,
        })),
        date: todayStart,
      },
    });
  })
);

router.get('/report',
  authenticate,
  enforceRestaurantScope,
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { startDate, endDate, groupBy } = req.query as z.infer<typeof reportQuerySchema>;

    const payments = await prisma.payment.findMany({
      where: {
        restaurantId,
        status: 'PAID',
        processedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        amount: true,
        paymentMethod: true,
        processedAt: true,
      },
      orderBy: { processedAt: 'asc' },
    });

    const grouped: Record<string, { total: number; mpesa: number; cash: number; count: number }> = {};

    for (const p of payments) {
      if (!p.processedAt) continue;
      const date = new Date(p.processedAt);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().substring(0, 10);
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().substring(0, 10);
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = { total: 0, mpesa: 0, cash: 0, count: 0 };
      }

      const amt = Number(p.amount);
      grouped[key].total += amt;
      grouped[key].count += 1;
      if (p.paymentMethod === 'MPESA') {
        grouped[key].mpesa += amt;
      } else {
        grouped[key].cash += amt;
      }
    }

    const data = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({
        period,
        totalRevenue: Math.round(values.total * 100) / 100,
        mpesaTotal: Math.round(values.mpesa * 100) / 100,
        cashTotal: Math.round(values.cash * 100) / 100,
        transactionCount: values.count,
      }));

    const totals = payments.reduce(
      (acc, p) => {
        const amt = Number(p.amount);
        acc.total += amt;
        if (p.paymentMethod === 'MPESA') acc.mpesa += amt;
        else acc.cash += amt;
        return acc;
      },
      { total: 0, mpesa: 0, cash: 0 }
    );

    res.json({
      success: true,
      data: {
        reportData: data,
        summary: {
          totalRevenue: Math.round(totals.total * 100) / 100,
          mpesaTotal: Math.round(totals.mpesa * 100) / 100,
          cashTotal: Math.round(totals.cash * 100) / 100,
          transactionCount: payments.length,
          dateRange: { startDate, endDate },
        },
      },
    });
  })
);

router.get('/report/tax',
  authenticate,
  enforceRestaurantScope,
  validateQuery(taxReportQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { startDate, endDate } = req.query as z.infer<typeof taxReportQuerySchema>;

    const where: any = {
      restaurantId,
      paymentStatus: 'PAID',
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        totalAmount: true,
        taxAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyData: Record<string, { totalSales: number; taxCollected: number; orderCount: number }> = {};

    for (const order of orders) {
      const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { totalSales: 0, taxCollected: 0, orderCount: 0 };
      }
      monthlyData[key].totalSales += Number(order.totalAmount);
      monthlyData[key].taxCollected += Number(order.taxAmount);
      monthlyData[key].orderCount += 1;
    }

    const data = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        totalSales: Math.round(values.totalSales * 100) / 100,
        taxCollected: Math.round(values.taxCollected * 100) / 100,
        orderCount: values.orderCount,
      }));

    const totals = orders.reduce(
      (acc, o) => ({
        totalSales: acc.totalSales + Number(o.totalAmount),
        taxCollected: acc.taxCollected + Number(o.taxAmount),
      }),
      { totalSales: 0, taxCollected: 0 }
    );

    res.json({
      success: true,
      data: {
        taxReport: data,
        summary: {
          totalSales: Math.round(totals.totalSales * 100) / 100,
          taxCollected: Math.round(totals.taxCollected * 100) / 100,
          orderCount: orders.length,
        },
      },
    });
  })
);

// ── M-Pesa Reconciliation Routes ──

// GET /reconciliation/summary?date=YYYY-MM-DD - Live computed reconciliation
router.get('/reconciliation/summary',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();

    const summary = await computeReconciliation(restaurantId, date);

    res.json({ success: true, data: { date: date.toISOString().slice(0, 10), ...summary } });
  })
);

// POST /reconciliation/run - Expire stale attempts, compute and persist the day's record
router.post('/reconciliation/run',
  authenticate,
  enforceRestaurantScope,
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const date = req.body?.date ? new Date(String(req.body.date)) : new Date();
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 500) : undefined;

    const result = await runReconciliation(restaurantId, date, notes);

    res.json({ success: true, data: result });
  })
);

// GET /reconciliation/history - Persisted reconciliation records
router.get('/reconciliation/history',
  authenticate,
  enforceRestaurantScope,
  validateQuery(receiptListQuerySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 20));

    const { records, total } = await listReconciliations(restaurantId, page, perPage);

    res.json({ success: true, data: records, meta: buildPaginationMeta(total, page, perPage) });
  })
);

// POST /card/record - Record card payment
router.post('/card/record',
  authenticate,
  enforceRestaurantScope,
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const idempotencyKey = getIdempotencyKey(req);

    if (idempotencyKey) {
      const existing = await findIdempotentPayment(idempotencyKey, `pay:${restaurantId}`);
      if (existing) {
        logger.info('Reusing idempotent card payment', { paymentId: existing.id, restaurantId });
        res.status(201).json({
          success: true,
          data: {
            id: existing.id,
            orderId: existing.orderId,
            amount: Number(existing.amount),
            idempotentReplay: true,
          },
        });
        return;
      }
    }

    const { orderId, amount } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      select: { id: true, totalAmount: true, paymentStatus: true, tableId: true, customerName: true, customerPhone: true },
    });

    if (!order) throw new NotFoundError('Order not found', 'Agizo halikupatikana');
    if (order.paymentStatus === 'PAID') throw new ValidationError('Order is already paid', 'Agizo tayari limelipwa');

    let payment: any;
    try {
      [payment] = await Promise.all([
        prisma.payment.create({
          data: {
            restaurantId,
            orderId,
            paymentMethod: 'CARD',
            amount,
            status: 'PAID',
            processedAt: new Date(),
            idempotencyKey: idempotencyKey || null,
          },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID' },
        }),
      ]);
    } catch (error) {
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await findIdempotentPayment(idempotencyKey, `pay:${restaurantId}`);
        if (existing) {
          logger.info('Card payment idempotency race resolved', { paymentId: existing.id, restaurantId });
          res.status(201).json({
            success: true,
            data: {
              id: existing.id,
              orderId: existing.orderId,
              amount: Number(existing.amount),
              idempotentReplay: true,
            },
          });
          return;
        }
      }
      throw error;
    }

    if (idempotencyKey) {
      await recordPaymentIdempotency(idempotencyKey, `pay:${restaurantId}`, payment.id);
    }

    await freeTableIfLastOrder(restaurantId, orderId, order.tableId);

    const receipt = await createReceiptForPayment(payment.id);

    // Customer identity + spend (best-effort)
    if (order.customerPhone) {
      try {
        await upsertCustomer(restaurantId, {
          phone: order.customerPhone,
          name: order.customerName || undefined,
          source: 'POS',
        });
        await recordCustomerSpend(restaurantId, order.customerPhone, Number(payment.amount));
        await processLoyaltyPayment(restaurantId, order.customerPhone, orderId);
      } catch (customerError) {
        logger.error('Customer/loyalty processing failed (card payment)', { error: customerError, restaurantId });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ...payment,
        amount: Number(payment.amount),
        receiptId: receipt?.id || null,
        receiptNumber: receipt?.receiptNumber || null,
      },
    });
  })
);

const openShiftSchema = z.object({
  cashierId: z.string().uuid('Invalid cashier ID'),
}).strict();

const closeShiftSchema = z.object({
  shiftId: z.string().uuid('Invalid shift ID'),
  actualCash: z.number().min(0, 'Actual cash must be at least 0'),
}).strict();

// ── Cash Reconciliation Routes ──

router.post('/cash/open-shift',
  authenticate,
  enforceRestaurantScope,
  auditLog,
  validate(openShiftSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const cashierId = req.user?.userId || req.body.cashierId;

    let cashier = await prisma.staff.findFirst({
      where: { id: cashierId, restaurantId, isActive: true },
      select: { id: true, fullName: true },
    });

    if (!cashier) {
      const owner = await prisma.owner.findFirst({
        where: { id: cashierId },
        select: { id: true, fullName: true },
      });
      if (owner) {
        cashier = { id: owner.id, fullName: owner.fullName };
      }
    }

    if (!cashier) {
      throw new NotFoundError('Cashier not found in this restaurant', 'Mweka hazina hajakupatikana katika mgahawa huu');
    }

    const existingOpenShift = await prisma.cashReconciliation.findFirst({
      where: { restaurantId, cashierId, status: 'OPEN' },
    });

    if (existingOpenShift) {
      throw new AppError(409, 'SHIFT_ALREADY_OPEN', 'An open shift already exists for this cashier', 'Mabadiliko ya wazi tayari yapo kwa mweka hazina huyu');
    }

    const shift = await prisma.cashReconciliation.create({
      data: {
        restaurantId,
        cashierId,
        shiftStart: new Date(),
        expectedCash: 0,
        status: 'OPEN',
      },
    });

    logger.info('Cash shift opened', { shiftId: shift.id, cashierId, restaurantId });

    res.status(201).json({
      success: true,
      data: {
        shiftId: shift.id,
        cashierId: shift.cashierId,
        shiftStart: shift.shiftStart,
        expectedCash: Number(shift.expectedCash),
        status: shift.status,
      },
    });
  })
);

router.post('/cash/close-shift',
  authenticate,
  enforceRestaurantScope,
  auditLog,
  validate(closeShiftSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { shiftId, actualCash } = req.body;

    const shift = await prisma.cashReconciliation.findFirst({
      where: { id: shiftId, restaurantId, status: 'OPEN' },
      include: {
        cashier: { select: { id: true, fullName: true } },
      },
    });

    if (!shift) {
      throw new NotFoundError('Open shift not found', 'Mabadiliko ya wazi hayakupatikana');
    }

    const expectedAmount = Number(shift.expectedCash);
    const actualAmount = Number(actualCash);
    const discrepancy = Math.round((actualAmount - expectedAmount) * 100) / 100;

    const DISCREPANCY_THRESHOLD = 100;
    const status = Math.abs(discrepancy) > DISCREPANCY_THRESHOLD
      ? 'DISCREPANCY_FLAGGED'
      : 'CLOSED';

    const updated = await prisma.cashReconciliation.update({
      where: { id: shiftId },
      data: {
        shiftEnd: new Date(),
        actualCash: actualAmount,
        discrepancy,
        status,
        notes: Math.abs(discrepancy) > DISCREPANCY_THRESHOLD
          ? `Discrepancy of ${formatKES(discrepancy)} flagged. Threshold: ${formatKES(DISCREPANCY_THRESHOLD)}`
          : null,
      },
    });

    if (status === 'DISCREPANCY_FLAGGED') {
      logger.warn('Cash discrepancy flagged', {
        shiftId,
        cashierId: shift.cashierId,
        expected: expectedAmount,
        actual: actualAmount,
        discrepancy,
        threshold: DISCREPANCY_THRESHOLD,
        restaurantId,
      });
    }

    logger.info('Cash shift closed', { shiftId, cashierId: shift.cashierId, expected: expectedAmount, actual: actualAmount, discrepancy });

    res.json({
      success: true,
      data: {
        shiftId: updated.id,
        cashierId: shift.cashierId,
        cashierName: shift.cashier.fullName,
        shiftStart: shift.shiftStart,
        shiftEnd: updated.shiftEnd,
        expectedCash: Number(updated.expectedCash),
        actualCash: Number(updated.actualCash),
        discrepancy: Number(updated.discrepancy),
        status: updated.status,
        isFlagged: status === 'DISCREPANCY_FLAGGED',
      },
    });
  })
);

router.get('/cash/shifts',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const shifts = await prisma.cashReconciliation.findMany({
      where: { restaurantId },
      orderBy: { shiftStart: 'desc' },
      include: {
        cashier: {
          select: { id: true, fullName: true },
        },
      },
    });

    res.json({
      success: true,
      data: shifts.map((s) => ({
        id: s.id,
        cashierId: s.cashierId,
        cashierName: s.cashier.fullName,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        expectedCash: Number(s.expectedCash),
        actualCash: s.actualCash ? Number(s.actualCash) : null,
        discrepancy: s.discrepancy ? Number(s.discrepancy) : null,
        status: s.status,
        notes: s.notes,
        createdAt: s.createdAt,
      })),
    });
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
        status: order.paymentStatus,
        items: order.items.map((i) => ({ name: i.itemName, quantity: i.quantity, price: Number(i.itemPrice) })),
        totalAmount: Number(order.totalAmount),
        restaurantName: order.restaurant.name,
        paymentId: order.payments[0]?.id,
      };
    },
    updateOrderPayment: async (orderId: string, paymentData: { paymentId: string; status: string; mpesaReceipt?: string }) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { restaurantId: true, tableId: true },
      });

      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: paymentData.status === 'paid' ? 'PAID' : 'UNPAID',
        },
      });

      if (order && paymentData.status === 'paid') {
        await freeTableIfLastOrder(order.restaurantId, orderId, order.tableId);
      }
    },
    updateOrderStatus: async (orderId: string, status: string) => {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: status as any },
      });
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

function createPaymentService(idempotencyKey?: string | null) {
  return {
    createPayment: async (data: {
      orderId: string;
      amount: number;
      phone: string;
      method: string;
      checkoutRequestId: string;
      status: string;
    }) => {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        select: { restaurantId: true },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: data.orderId,
          restaurantId: order?.restaurantId || '',
          amount: data.amount,
          paymentMethod: 'MPESA',
          status: data.status as any,
          mpesaCheckoutRequestId: data.checkoutRequestId,
          mpesaPhone: data.phone,
          idempotencyKey: idempotencyKey || null,
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
      const updateData: any = {};
      if (data.status) updateData.status = data.status;
      if (data.mpesaReceiptNumber) updateData.mpesaReceiptNumber = data.mpesaReceiptNumber;
      if (data.amount) updateData.amount = data.amount;
      if (data.transactionDate) updateData.processedAt = new Date(data.transactionDate);

      await prisma.payment.updateMany({
        where: { mpesaCheckoutRequestId: checkoutRequestId },
        data: updateData,
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

function createSocketService() {
  return {
    emitToOrder: (orderNumber: string, event: string, data: any) => {
      try {
        io.to(`order:${orderNumber}`).emit(event, data);
      } catch (e) {
        logger.error('Socket emit to order failed', { error: e, orderNumber, event });
      }
    },
    emitToRestaurant: (restaurantId: string, event: string, data: any) => {
      try {
        io.to(`restaurant:${restaurantId}`).emit(event, data);
      } catch (e) {
        logger.error('Socket emit to restaurant failed', { error: e, restaurantId, event });
      }
    },
  };
}

export default router;
