import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import { generateReceiptNumber } from '@/utils/helpers';
import logger from '@/utils/logger';

/**
 * Central receipt service.
 * Receipts are immutable server-side records: unique receipt numbers,
 * snapshot of order items + restaurant details at issue time.
 */

export async function getReceiptById(id: string): Promise<any> {
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      restaurant: {
        select: { id: true, name: true, slug: true },
      },
    },
  });
  if (!receipt) {
    throw new NotFoundError('Receipt not found', 'Risiti haikupatikana');
  }
  return receipt;
}

export async function getReceiptByNumber(receiptNumber: string): Promise<any | null> {
  return prisma.receipt.findUnique({
    where: { receiptNumber },
  });
}

/**
 * Creates a receipt for a payment (idempotent — one receipt per payment).
 * Snapshotting keeps receipt contents accurate even if menu/prices change later.
 * Failures are logged and swallowed: receipt generation must never break
 * the payment flow.
 */
export async function createReceiptForPayment(paymentId: string, options: { isRefund?: boolean } = {}): Promise<any | null> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            restaurant: true,
            items: true,
          },
        },
      },
    });

    if (!payment || !payment.order) {
      logger.warn('Receipt skipped: payment or order not found', { paymentId });
      return null;
    }

    if (payment.status !== 'PAID' && payment.status !== 'REFUNDED') {
      return null;
    }

    const existing = await prisma.receipt.findFirst({
      where: { paymentId, isRefund: !!options.isRefund },
    });
    if (existing) return existing;

    const order = payment.order;
    const restaurant = order.restaurant;
    const vatAmount = options.isRefund
      ? 0
      : Number(order.taxAmount) || (Number(payment.amount) * 16) / 116;

    return prisma.receipt.create({
      data: {
        restaurantId: payment.restaurantId,
        orderId: order.id,
        paymentId: payment.id,
        receiptNumber: generateReceiptNumber(payment.restaurantId),
        serialNumber: `ETR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${payment.restaurantId.slice(0, 4).toUpperCase()}`,
        issueDate: new Date(),
        amount: payment.amount,
        vatAmount,
        paymentMethod: payment.paymentMethod,
        cashierId: payment.cashierId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderNumber: order.orderNumber,
        items: (order.items || []).map((i: any) => ({
          itemName: i.itemName,
          quantity: i.quantity,
          itemPrice: Number(i.itemPrice),
          subtotal: Number(i.subtotal),
        })),
        restaurantSnapshot: {
          name: restaurant.name,
          kraPin: restaurant.kraPin,
          vatRegNo: restaurant.vatRegNo,
          businessRegNo: restaurant.businessRegNo,
          address: restaurant.address,
          city: restaurant.city,
          phone: restaurant.phone,
        },
        isRefund: !!options.isRefund,
        refundedAt: options.isRefund ? new Date() : null,
      },
    });
  } catch (error: any) {
    logger.error('Receipt generation failed', { error: error.message, paymentId });
    return null;
  }
}

/**
 * Lists receipts for a restaurant with filters (used by the receipts browser).
 */
export async function listReceipts(
  restaurantId: string,
  filters: { dateFrom?: Date; dateTo?: Date; method?: string; tableNumber?: number; q?: string; page: number; perPage: number }
): Promise<{ receipts: any[]; total: number }> {
  const where: any = { restaurantId };

  if (filters.dateFrom || filters.dateTo) {
    where.issueDate = {};
    if (filters.dateFrom) where.issueDate.gte = filters.dateFrom;
    if (filters.dateTo) where.issueDate.lte = filters.dateTo;
  }
  if (filters.method) where.paymentMethod = filters.method.toUpperCase();

  if (filters.q) {
    where.OR = [
      { receiptNumber: { contains: filters.q, mode: 'insensitive' } },
      { orderNumber: { contains: filters.q, mode: 'insensitive' } },
      { customerName: { contains: filters.q, mode: 'insensitive' } },
      { customerPhone: { contains: filters.q } },
    ];
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        cashier: { select: { id: true, fullName: true } },
      },
      orderBy: { issueDate: 'desc' },
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
    }),
    prisma.receipt.count({ where }),
  ]);

  return { receipts, total };
}
