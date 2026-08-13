import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { isEtimsConfigured, buildA1Payload, submitReceipt } from '@/integrations/etims';

/**
 * eTIMS submission tracking.
 *
 * The honest-compliance layer: every receipt gets an EtrSubmission row.
 * - Not configured → stays PENDING (surfaced to the owner, never marked done).
 * - Configured + KRA accepts → SUBMITTED with the KRA invoice number.
 * - Business rejection → REJECTED (no auto-retry — the owner must fix data).
 * - Network/provider error → FAILED (retryable, capped attempts).
 * A receipt is NEVER labelled "compliant" — only "submitted to KRA" with the
 * KRA-returned invoice number as evidence.
 */

export const MAX_ATTEMPTS = 5;

export async function ensureSubmission(restaurantId: string, receiptId: string): Promise<void> {
  try {
    const existing = await prisma.etrSubmission.findUnique({ where: { receiptId } });
    if (existing) return;
    await prisma.etrSubmission.create({
      data: { restaurantId, receiptId },
    });
  } catch (error: any) {
    logger.error('eTIMS submission row creation failed', { error: error.message, restaurantId, receiptId });
  }
}

export async function getSubmission(restaurantId: string, receiptId: string): Promise<any | null> {
  return prisma.etrSubmission.findFirst({ where: { receiptId, restaurantId } });
}

/**
 * Attempts one submission. Returns the updated row.
 */
export async function processSubmission(submissionId: string): Promise<any> {
  const submission = await prisma.etrSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new Error('Submission not found');
  if (submission.status === 'SUBMITTED' || submission.status === 'REJECTED') return submission;

  // Not configured → stay PENDING (honest: nothing was sent to KRA)
  if (!isEtimsConfigured()) {
    logger.info('eTIMS not configured — submission stays pending', { submissionId: submission.id, restaurantId: submission.restaurantId });
    return submission;
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: submission.receiptId },
    include: { restaurant: true },
  });
  if (!receipt) return submission;

  const payload = buildA1Payload({
    receipt,
    restaurant: {
      kraPin: receipt.restaurant.kraPin,
      name: receipt.restaurant.name,
      address: receipt.restaurant.address,
      phone: receipt.restaurant.phone,
    },
  });

  const result = await submitReceipt(payload);
  const attempts = submission.attempts + 1;

  let update: any = {
    attempts,
    payload: payload as any,
    responseCode: result.responseCode,
    responseMessage: result.message,
    lastError: result.ok ? null : result.message,
  };

  if (result.ok) {
    update.status = 'SUBMITTED';
    update.submittedAt = new Date();
    update.kraInvoiceNumber = result.invoiceNumber || null;
  } else if (!result.retryable) {
    update.status = 'REJECTED';
    update.lastError = result.message || 'Rejected by KRA eTIMS';
  } else if (attempts >= MAX_ATTEMPTS) {
    update.status = 'FAILED';
    update.lastError = result.message || 'Max attempts reached';
  } else {
    update.status = 'FAILED';
    update.lastError = result.message || 'Network error';
  }

  logger.info('eTIMS submission processed', {
    submissionId: submission.id,
    receiptId: submission.receiptId,
    status: update.status,
    attempts,
    responseCode: result.responseCode,
  });

  return prisma.etrSubmission.update({ where: { id: submission.id }, data: update });
}

/**
 * Processes all PENDING/FAILED submissions for a restaurant (manual trigger
 * and future scheduled job). Returns a summary.
 */
export async function processPendingSubmissions(restaurantId: string): Promise<{ processed: number; submitted: number; failed: number; pending: number }> {
  const pending = await prisma.etrSubmission.findMany({
    where: { restaurantId, status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS } },
    take: 50,
  });

  let submitted = 0;
  let failed = 0;
  for (const submission of pending) {
    const updated = await processSubmission(submission.id);
    if (updated.status === 'SUBMITTED') submitted++;
    else if (updated.status === 'FAILED' || updated.status === 'REJECTED') failed++;
  }

  return { processed: pending.length, submitted, failed, pending: pending.length - submitted - failed };
}

export async function getEtimsStatus(restaurantId: string): Promise<any> {
  const groups = await prisma.etrSubmission.groupBy({
    by: ['status'],
    where: { restaurantId },
    _count: { id: true },
  });
  const counts: Record<string, number> = { PENDING: 0, SUBMITTED: 0, FAILED: 0, REJECTED: 0 };
  for (const g of groups) counts[g.status] = g._count.id;

  const unsubmitted = await prisma.etrSubmission.findMany({
    where: { restaurantId, status: { in: ['PENDING', 'FAILED', 'REJECTED'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { receipt: { select: { id: true, receiptNumber: true, amount: true, issueDate: true } } },
  });

  return {
    configured: isEtimsConfigured(),
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    unsubmitted: unsubmitted.map((s) => ({
      id: s.id,
      status: s.status,
      attempts: s.attempts,
      lastError: s.lastError,
      receiptNumber: s.receipt?.receiptNumber,
      amount: Number(s.receipt?.amount || 0),
      issueDate: s.receipt?.issueDate,
      kraInvoiceNumber: s.kraInvoiceNumber,
    })),
    note: 'Receipts are only ever reported as SUBMITTED to KRA — never as compliant without a KRA-returned invoice number.',
  };
}

export default { ensureSubmission, getSubmission, processSubmission, processPendingSubmissions, getEtimsStatus };
