import { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError, NotFoundError, ConflictError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Platform billing.
 *
 * This is the revenue side of the SaaS, deliberately separate from customer
 * order payments (which go directly to each restaurant's own M-Pesa till).
 *
 * Lifecycle:
 *   TRIAL/ACTIVE restaurant ──invoice──▶ PENDING ──payment──▶ PAID
 *                                           │
 *                                           └─period end─▶ OVERDUE
 *
 * Paying an invoice extends `Restaurant.planExpiresAt` and sets the
 * subscription back to ACTIVE. The expiry sweep downgrades past-due
 * trials/plans to EXPIRED so `assertRestaurantUsable` blocks operations.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateInvoiceInput {
  restaurantId: string;
  planId?: string | null;
  amountKes?: number;
  periodStart?: Date;
  periodEnd?: Date;
  notes?: string | null;
}

export interface MarkPaidInput {
  method: string;
  reference?: string | null;
  notes?: string | null;
  actorId?: string | null;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const invoiceNumber = `INV-${ym}-${suffix}`;
    const existing = await prisma.subscriptionInvoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (!existing) return invoiceNumber;
  }
  throw AppError.internal('Could not generate a unique invoice number');
}

async function notifyOwner(restaurantId: string, recipientId: string, title: string, message: string, data?: Record<string, unknown>): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        restaurantId,
        recipientType: 'OWNER',
        recipientId,
        type: 'SUBSCRIPTION_EXPIRING',
        title,
        message,
        data: (data || undefined) as any,
      },
    });
  } catch (error) {
    // Notifications are best-effort; billing must not fail because of them.
    logger.warn('Billing notification failed', { restaurantId, error: (error as Error).message });
  }
}

export async function createInvoice(input: CreateInvoiceInput): Promise<any> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: input.restaurantId },
    include: { plan: true },
  });
  if (!restaurant) throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');

  const plan = input.planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } })
    : restaurant.plan;
  if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Subscription plan not found', 'Mpango haukupatikana');

  const periodStart = input.periodStart ?? new Date();
  const periodEnd = input.periodEnd ?? addMonths(periodStart, 1);
  const amountKes = input.amountKes ?? Number(plan.priceMonthlyKes);

  if (periodEnd <= periodStart) {
    throw AppError.validation('periodEnd must be after periodStart', 'Tarehe ya mwisho lazima iwe baada ya mwanzo');
  }
  if (amountKes <= 0) {
    throw AppError.validation('Invoice amount must be positive', 'Kiasi cha ankara lazima kiwe kikubwa');
  }

  const invoiceNumber = await generateInvoiceNumber();
  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      restaurantId: restaurant.id,
      planId: plan.id,
      invoiceNumber,
      amountKes,
      periodStart,
      periodEnd,
      notes: input.notes ?? null,
    },
  });

  await notifyOwner(
    restaurant.id,
    restaurant.ownerId,
    'New subscription invoice',
    `Invoice ${invoiceNumber} for KES ${amountKes.toLocaleString()} is due by ${periodEnd.toLocaleDateString('en-KE')}.`,
    { invoiceId: invoice.id, invoiceNumber }
  );

  logger.info('Subscription invoice created', { invoiceId: invoice.id, invoiceNumber, restaurantId: restaurant.id, amountKes });
  return invoice;
}

export async function getInvoice(restaurantId: string, invoiceId: string): Promise<any> {
  const invoice = await prisma.subscriptionInvoice.findFirst({
    where: { id: invoiceId, restaurantId },
    include: { plan: { select: { id: true, name: true } } },
  });
  if (!invoice) throw new NotFoundError('Invoice not found', 'Ankara haikupatikana');
  return invoice;
}

export async function listInvoices(
  restaurantId: string,
  options: { status?: InvoiceStatus | 'all'; take?: number } = {}
): Promise<any[]> {
  const { status, take = 50 } = options;
  return prisma.subscriptionInvoice.findMany({
    where: { restaurantId, ...(status && status !== 'all' ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(take, 200),
    include: { plan: { select: { id: true, name: true } } },
  });
}

export async function markInvoicePaid(invoiceId: string, input: MarkPaidInput): Promise<any> {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { restaurant: true, plan: true },
  });
  if (!invoice) throw new NotFoundError('Invoice not found', 'Ankara haikupatikana');
  if (invoice.status === 'PAID') throw new ConflictError('Invoice is already paid', 'Ankara tayari imelipwa');
  if (invoice.status === 'VOID') throw new ConflictError('Invoice has been voided', 'Ankara imefutwa');

  const paidAt = new Date();
  const updated = await prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paymentMethod: input.method,
      reference: input.reference ?? invoice.reference ?? null,
      notes: input.notes ?? invoice.notes ?? null,
      paidAt,
    },
  });

  // Extend the plan to the later of: current expiry, or the invoice period end.
  const currentExpiry = invoice.restaurant.planExpiresAt;
  const base = currentExpiry && currentExpiry > paidAt ? currentExpiry : paidAt;
  const newExpiry = invoice.periodEnd > base ? invoice.periodEnd : addMonths(base, 1);

  await prisma.restaurant.update({
    where: { id: invoice.restaurantId },
    data: {
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: newExpiry,
    },
  });

  await notifyOwner(
    invoice.restaurantId,
    invoice.restaurant.ownerId,
    'Payment received',
    `Invoice ${invoice.invoiceNumber} has been paid. Your subscription is active until ${newExpiry.toLocaleDateString('en-KE')}.`,
    { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber }
  );

  logger.info('Subscription invoice paid', {
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    restaurantId: invoice.restaurantId,
    method: input.method,
    actorId: input.actorId,
  });

  return { invoice: updated, planExpiresAt: newExpiry };
}

export async function voidInvoice(invoiceId: string, reason?: string | null): Promise<any> {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice not found', 'Ankara haikupatikana');
  if (invoice.status === 'PAID') throw new ConflictError('A paid invoice cannot be voided', 'Ankara iliyolipwa haiwezi kufutwa');

  return prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: { status: 'VOID', notes: reason ?? invoice.notes ?? null },
  });
}

/** Owner-facing: last invoice + subscription state. */
export async function getBillingOverview(restaurantId: string): Promise<any> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      planExpiresAt: true,
      plan: { select: { id: true, name: true, priceMonthlyKes: true, priceYearlyKes: true } },
    },
  });
  if (!restaurant) throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');

  const [invoices, pendingAgg] = await Promise.all([
    listInvoices(restaurantId, { take: 20 }),
    prisma.subscriptionInvoice.aggregate({
      where: { restaurantId, status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { amountKes: true },
      _count: { id: true },
    }),
  ]);

  return {
    subscription: {
      status: restaurant.subscriptionStatus,
      trialEndsAt: restaurant.trialEndsAt,
      planExpiresAt: restaurant.planExpiresAt,
      plan: restaurant.plan
        ? { ...restaurant.plan, priceMonthlyKes: Number(restaurant.plan.priceMonthlyKes), priceYearlyKes: Number(restaurant.plan.priceYearlyKes) }
        : null,
    },
    outstanding: {
      count: pendingAgg._count.id,
      amountKes: Number(pendingAgg._sum.amountKes || 0),
    },
    invoices,
  };
}

/**
 * Expires past-due subscriptions and marks unpaid invoices overdue.
 * Safe to run repeatedly (idempotent). Called daily by the scheduler and
 * available to super-admins as a manual trigger.
 */
export async function runExpirySweep(now = new Date()): Promise<{ expiredTrials: number; expiredPlans: number; markedOverdue: number }> {
  const [pastTrial, pastPlan] = await Promise.all([
    prisma.restaurant.findMany({
      where: { subscriptionStatus: 'TRIAL', trialEndsAt: { not: null, lt: now }, isSuspended: false },
      select: { id: true, ownerId: true, name: true, trialEndsAt: true },
    }),
    prisma.restaurant.findMany({
      where: { subscriptionStatus: 'ACTIVE', planExpiresAt: { not: null, lt: now }, isSuspended: false },
      select: { id: true, ownerId: true, name: true, planExpiresAt: true },
    }),
  ]);

  for (const restaurant of pastTrial) {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { subscriptionStatus: 'EXPIRED' } });
    await notifyOwner(
      restaurant.id,
      restaurant.ownerId,
      'Your trial has ended',
      `The free trial for "${restaurant.name}" has ended. Subscribe to keep taking orders.`,
      { reason: 'TRIAL_EXPIRED' }
    );
  }

  for (const restaurant of pastPlan) {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { subscriptionStatus: 'EXPIRED' } });
    await notifyOwner(
      restaurant.id,
      restaurant.ownerId,
      'Your subscription has expired',
      `The subscription for "${restaurant.name}" has expired. Renew to keep using Menu Moja.`,
      { reason: 'PLAN_EXPIRED' }
    );
  }

  const overdue = await prisma.subscriptionInvoice.updateMany({
    where: { status: 'PENDING', periodEnd: { lt: now } },
    data: { status: 'OVERDUE' },
  });

  const result = {
    expiredTrials: pastTrial.length,
    expiredPlans: pastPlan.length,
    markedOverdue: overdue.count,
  };

  if (result.expiredTrials || result.expiredPlans || result.markedOverdue) {
    logger.info('Billing expiry sweep completed', result);
  }

  return result;
}

/** Administrative billing metrics for the platform dashboard. */
export async function getBillingStats(): Promise<any> {
  const [billed, collected, outstanding, byStatus] = await Promise.all([
    prisma.subscriptionInvoice.aggregate({ _sum: { amountKes: true }, _count: { id: true } }),
    prisma.subscriptionInvoice.aggregate({ where: { status: 'PAID' }, _sum: { amountKes: true } }),
    prisma.subscriptionInvoice.aggregate({ where: { status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { amountKes: true }, _count: { id: true } }),
    prisma.subscriptionInvoice.groupBy({ by: ['status'], _sum: { amountKes: true }, _count: { id: true } }),
  ]);

  return {
    totalBilledKes: Number(billed._sum.amountKes || 0),
    invoiceCount: billed._count.id,
    collectedKes: Number(collected._sum.amountKes || 0),
    outstandingKes: Number(outstanding._sum.amountKes || 0),
    outstandingCount: outstanding._count.id,
    byStatus: byStatus.map((row: any) => ({
      status: row.status,
      count: row._count.id,
      amountKes: Number(row._sum.amountKes || 0),
    })),
  };
}

export default {
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  voidInvoice,
  getBillingOverview,
  runExpirySweep,
  getBillingStats,
};
