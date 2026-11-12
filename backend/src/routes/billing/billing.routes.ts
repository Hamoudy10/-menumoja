import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, enforceRestaurantScope, requireRole, validate, asyncHandler } from '@/middleware';
import { AppError, NotFoundError } from '@/utils/errors';
import { getBillingOverview, listInvoices, getInvoice } from '@/services/billing.service';

/**
 * Owner-facing platform billing.
 *
 * The platform (not the restaurant) collects subscription money, so these
 * endpoints expose invoices and a "claim payment" step. An owner confirms an
 * M-Pesa/bank payment by submitting its reference; a super-admin reconciles it
 * and marks the invoice PAID via /admin/billing.
 */

const router = Router();

router.use(authenticate, enforceRestaurantScope, requireRole('owner'));

const claimSchema = z.object({
  method: z.enum(['MPESA', 'CASH', 'BANK', 'CARD']),
  reference: z.string().min(3).max(120),
  notes: z.string().max(500).optional(),
}).strict();

router.get('/overview', asyncHandler(async (req: any, res: any) => {
  const summary = await getBillingOverview(req.restaurantId);
  res.json({ success: true, data: summary });
}));

router.get('/invoices', asyncHandler(async (req: any, res: any) => {
  const status = ['PENDING', 'PAID', 'OVERDUE', 'VOID', 'all'].includes(String(req.query.status))
    ? (String(req.query.status) as any)
    : 'all';
  const invoices = await listInvoices(req.restaurantId, { status });
  res.json({ success: true, data: invoices });
}));

router.get('/invoices/:id', asyncHandler(async (req: any, res: any) => {
  const invoice = await getInvoice(req.restaurantId, String(req.params.id));
  res.json({ success: true, data: invoice });
}));

router.post('/invoices/:id/claim', validate(claimSchema), asyncHandler(async (req: any, res: any) => {
  const restaurantId = req.restaurantId as string;
  const invoiceId = String(req.params.id);
  const { method, reference, notes } = req.body;

  const invoice = await prisma.subscriptionInvoice.findFirst({ where: { id: invoiceId, restaurantId } });
  if (!invoice) throw new NotFoundError('Invoice not found', 'Ankara haikupatikana');
  if (invoice.status === 'PAID') throw new AppError(409, 'ALREADY_PAID', 'Invoice is already paid', 'Ankara tayari imelipwa');
  if (invoice.status === 'VOID') throw new AppError(409, 'INVOICE_VOID', 'Invoice has been voided', 'Ankara imefutwa');

  const updated = await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: {
      paymentMethod: method,
      reference,
      notes: notes || invoice.notes || null,
    },
  });

  res.json({
    success: true,
    data: {
      invoice: updated,
      message: 'Payment reference recorded. Your subscription will be activated once the payment is verified.',
    },
  });
}));

export default router;
