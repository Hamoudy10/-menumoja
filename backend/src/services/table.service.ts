import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { emitTableStatusChanged } from '@/hooks/socket';

const ACTIVE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] as const;

export async function onTableSeated(restaurantId: string, tableId: string): Promise<void> {
  try {
    const openSession = await prisma.tableSession.findFirst({
      where: { tableId, endedAt: null },
      select: { id: true },
    });
    if (!openSession) {
      await prisma.tableSession.create({
        data: { restaurantId, tableId },
      });
    }
  } catch (error) {
    logger.error('Failed to start table session', { error, tableId });
  }

  try {
    emitTableStatusChanged(restaurantId, tableId, 'OCCUPIED');
  } catch (socketError) {
    logger.error('Failed to emit table status change', { error: socketError, tableId });
  }
}

export async function freeTableIfLastOrder(
  restaurantId: string,
  orderId: string,
  tableId: string | null
): Promise<void> {  if (!tableId) return;

  try {
    const activeCount = await prisma.order.count({
      where: {
        restaurantId,
        tableId,
        id: { not: orderId },
        status: { in: [...ACTIVE_ORDER_STATUSES] },
        paymentStatus: { notIn: ['PAID', 'REFUNDED'] },
      },
    });

    if (activeCount > 0) return;

    const table = await prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      select: { id: true, status: true },
    });
    if (!table || table.status !== 'OCCUPIED') return;

    await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status: 'FREE', currentSessionId: null },
    });
    await prisma.tableSession.updateMany({
      where: { tableId, endedAt: null },
      data: { endedAt: new Date() },
    });

    try {
      emitTableStatusChanged(restaurantId, tableId, 'FREE');
    } catch (socketError) {
      logger.error('Failed to emit table status change', { error: socketError, tableId });
    }
  } catch (error) {
    logger.error('Failed to free table', { error, orderId, tableId });
  }
}

/**
 * A table is only finished when the bill is paid *and* the order has been
 * served. Prepaid QR orders must not release the table while the guests are
 * still eating; dine-in orders paid at the end are released immediately.
 */
export async function freeTableWhenFinished(
  restaurantId: string,
  order: { id: string; tableId: string | null; status: string; paymentStatus: string }
): Promise<void> {
  if (!order.tableId) return;
  if (order.paymentStatus !== 'PAID') return;
  if (order.status !== 'SERVED') return;
  await freeTableIfLastOrder(restaurantId, order.id, order.tableId);
}
