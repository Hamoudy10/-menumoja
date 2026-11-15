import { prisma } from '@/config/database';
import logger from '@/utils/logger';

type SoldItem = {
  menuItemId?: string | null;
  quantity: number;
  subtotal?: unknown;
};

/**
 * Keep the denormalised sales counters in sync when an order is created.
 *
 * - `MenuItem.totalOrders` powers "most popular" on the customer menu and
 *   the top-item metric on the dashboard. It was never written before, so
 *   both features always fell back to newest items / null.
 * - `MenuItemAnalytics` powers the per-item views/orders breakdown.
 * - `AnalyticsDaily` keeps the daily order/item counters warm for exports.
 *
 * Analytics must never break ordering, so failures are logged and swallowed.
 */
export async function recordOrderAnalytics(
  restaurantId: string,
  items: SoldItem[],
  totalAmount: number
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byItem = new Map<string, { quantity: number; revenue: number }>();
  for (const item of items) {
    if (!item.menuItemId) continue;
    const current = byItem.get(item.menuItemId) || { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += Number(item.subtotal || 0);
    byItem.set(item.menuItemId, current);
  }

  const itemsSold = Array.from(byItem.values()).reduce((sum, sold) => sum + sold.quantity, 0);

  try {
    const writes = [
      prisma.analyticsDaily.upsert({
        where: { restaurantId_date: { restaurantId, date: today } },
        create: {
          restaurantId,
          date: today,
          totalOrders: 1,
          itemsSold,
        },
        update: {
          totalOrders: { increment: 1 },
          itemsSold: { increment: itemsSold },
        },
      }),
      ...Array.from(byItem.entries()).map(([menuItemId, sold]) =>
        prisma.menuItem.update({
          where: { id: menuItemId },
          data: { totalOrders: { increment: sold.quantity } },
        })
      ),
      ...Array.from(byItem.entries()).map(([menuItemId, sold]) =>
        prisma.menuItemAnalytics.upsert({
          where: { menuItemId_date: { menuItemId, date: today } },
          create: {
            restaurantId,
            menuItemId,
            date: today,
            orders: sold.quantity,
            revenue: sold.revenue,
          },
          update: {
            orders: { increment: sold.quantity },
            revenue: { increment: sold.revenue },
          },
        })
      ),
    ];

    await prisma.$transaction(writes);
  } catch (error) {
    logger.warn('Failed to record order analytics (order kept)', {
      error,
      restaurantId,
      itemCount: items.length,
      totalAmount,
    });
  }
}
