import { prisma } from '@/config/database';
import logger from '@/utils/logger';

const STALE_ATTEMPT_MINUTES = 30;

/**
 * M-Pesa reconciliation service.
 * Runs a daily (or on-demand) reconciliation: expected vs received,
 * duplicate/failed/expired/unmatched counts, persisted immutably per day.
 */

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Marks STK-push attempts still PENDING after the timeout as EXPIRED.
 * Returns the number of expired attempts.
 */
export async function expireStalePendingAttempts(restaurantId: string, minutes = STALE_ATTEMPT_MINUTES): Promise<number> {
  const cutoff = new Date(Date.now() - minutes * 60000);
  const result = await prisma.paymentAttempt.updateMany({
    where: {
      restaurantId,
      status: 'PENDING',
      initiatedAt: { lt: cutoff },
    },
    data: {
      status: 'EXPIRED',
      errorCode: 'TIMEOUT',
      errorMessage: `STK push expired after ${minutes} minutes without a callback`,
      completedAt: new Date(),
    },
  });
  if (result.count > 0) {
    logger.warn('Expired stale M-Pesa payment attempts', { restaurantId, count: result.count });
  }
  return result.count;
}

export interface ReconciliationSummary {
  expectedMpesa: number;
  receivedMpesa: number;
  difference: number;
  unmatched: number;
  duplicate: number;
  failed: number;
  expired: number;
  reversed: number;
}

/**
 * Computes the reconciliation summary for a restaurant on a given date.
 * Does not persist. Use runReconciliation to persist.
 */
export async function computeReconciliation(restaurantId: string, date: Date): Promise<ReconciliationSummary> {
  const from = startOfDay(date);
  const to = endOfDay(date);

  const [expectedAgg, receivedAgg, attempts, webhookEvents] = await Promise.all([
    prisma.payment.aggregate({
      where: { restaurantId, paymentMethod: 'MPESA', createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        restaurantId,
        paymentMethod: 'MPESA',
        status: 'PAID',
        mpesaReceiptNumber: { not: null },
        processedAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.paymentAttempt.findMany({
      where: { restaurantId, createdAt: { gte: from, lte: to } },
      select: { status: true },
    }),
    prisma.paymentWebhookEvent.count({
      where: { restaurantId, isDuplicate: true, createdAt: { gte: from, lte: to } },
    }),
  ]);

  let unmatched = 0;
  let failed = 0;
  let expired = 0;
  let reversed = 0;

  for (const a of attempts) {
    if (a.status === 'SUCCESS') unmatched++; // success without a matching paid payment
    else if (a.status === 'FAILED') failed++;
    else if (a.status === 'EXPIRED') expired++;
    else if (a.status === 'REVERSED') reversed++;
  }

  const expectedMpesa = Number(expectedAgg._sum.amount || 0);
  const receivedMpesa = Number(receivedAgg._sum.amount || 0);

  return {
    expectedMpesa,
    receivedMpesa,
    difference: Math.round((expectedMpesa - receivedMpesa) * 100) / 100,
    unmatched,
    duplicate: webhookEvents,
    failed,
    expired,
    reversed,
  };
}

/**
 * Runs the full reconciliation for a restaurant/date: expires stale pending
 * attempts, computes the summary, and upserts a persisted record.
 */
export async function runReconciliation(restaurantId: string, date: Date, notes?: string): Promise<ReconciliationSummary & { persisted: boolean }> {
  await expireStalePendingAttempts(restaurantId);
  const summary = await computeReconciliation(restaurantId, date);

  const day = startOfDay(date);
  await prisma.reconciliationRecord.upsert({
    where: { restaurantId_date: { restaurantId, date: day } },
    create: {
      restaurantId,
      date: day,
      expectedMpesa: summary.expectedMpesa,
      receivedMpesa: summary.receivedMpesa,
      difference: summary.difference,
      unmatched: summary.unmatched,
      duplicate: summary.duplicate,
      failed: summary.failed,
      expired: summary.expired,
      reversed: summary.reversed,
      notes: notes || null,
    },
    update: {
      expectedMpesa: summary.expectedMpesa,
      receivedMpesa: summary.receivedMpesa,
      difference: summary.difference,
      unmatched: summary.unmatched,
      duplicate: summary.duplicate,
      failed: summary.failed,
      expired: summary.expired,
      reversed: summary.reversed,
      notes: notes || null,
      reconciledAt: new Date(),
    },
  });

  logger.info('Reconciliation run completed', { restaurantId, date: day.toISOString().slice(0, 10), ...summary });

  return { ...summary, persisted: true };
}

/**
 * Lists persisted reconciliation records for a restaurant.
 */
export async function listReconciliations(restaurantId: string, page: number, perPage: number) {
  const [records, total] = await Promise.all([
    prisma.reconciliationRecord.findMany({
      where: { restaurantId },
      orderBy: { date: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.reconciliationRecord.count({ where: { restaurantId } }),
  ]);

  return {
    records: records.map((r) => ({
      ...r,
      expectedMpesa: Number(r.expectedMpesa),
      receivedMpesa: Number(r.receivedMpesa),
      difference: Number(r.difference),
    })),
    total,
  };
}
