import { prisma } from '@/config/database';
import logger from '@/utils/logger';

/**
 * Smart upselling — basket analysis.
 *
 * "Customers ordering Burger add Fries 62% of the time" — computed from the
 * last 90 days of paid orders. Suggestions are always capped and never
 * include items already in the cart or unavailable items.
 */

const ANALYSIS_WINDOW_DAYS = 90;
const MAX_COMPANIONS = 5;

async function getItemNames(restaurantId: string, itemIds: string[]): Promise<Map<string, string>> {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId, id: { in: itemIds } },
    select: { id: true, name: true },
  });
  return new Map(items.map((i) => [i.id, i.name]));
}

/**
 * For a given item, the companions ordered together with it and their
 * co-occurrence percentage.
 */
export async function getCombinationStats(restaurantId: string, itemId: string, limit = 4): Promise<Array<{ itemId: string; name: string; percentage: number; ordersTogether: number }>> {
  const cutoff = new Date(Date.now() - ANALYSIS_WINDOW_DAYS * 86400000);

  const ordersWithItem = await prisma.orderItem.findMany({
    where: {
      order: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: cutoff } },
      menuItemId: itemId,
    },
    select: { orderId: true },
    take: 1000,
  });

  const orderIds = [...new Set(ordersWithItem.map((o) => o.orderId))];
  if (orderIds.length === 0) return [];

  const companions = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      orderId: { in: orderIds },
      menuItemId: { not: null },
      NOT: { menuItemId: itemId },
    },
    _count: { id: true },
  });

  const total = orderIds.length;
  const nameMap = await getItemNames(restaurantId, companions.map((c) => c.menuItemId as string));

  return companions
    .map((c) => ({
      itemId: c.menuItemId as string,
      name: nameMap.get(c.menuItemId as string) || 'Unknown',
      percentage: Math.round((c._count.id / total) * 1000) / 10,
      ordersTogether: c._count.id,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, Math.min(limit, MAX_COMPANIONS));
}

/**
 * Upsell suggestions for a cart: aggregated co-occurrence across all cart
 * items, excluding items already in the cart and unavailable items.
 */
export async function getUpsellSuggestions(restaurantId: string, cartItemIds: string[], limit = 3): Promise<Array<{ itemId: string; name: string; percentage: number; ordersTogether: number }>> {
  const uniqueCart = [...new Set(cartItemIds)].filter(Boolean);
  if (uniqueCart.length === 0) return [];

  const merged = new Map<string, { count: number; percentage: number }>();
  let ordersSeen = 0;

  for (const itemId of uniqueCart) {
    const stats = await getCombinationStats(restaurantId, itemId, MAX_COMPANIONS);
    for (const s of stats) {
      if (uniqueCart.includes(s.itemId)) continue;
      const prev = merged.get(s.itemId);
      merged.set(s.itemId, {
        count: (prev?.count || 0) + s.ordersTogether,
        percentage: Math.max(prev?.percentage || 0, s.percentage),
      });
      ordersSeen = Math.max(ordersSeen, s.ordersTogether);
    }
  }

  const available = await prisma.menuItem.findMany({
    where: { restaurantId, id: { in: [...merged.keys()] }, isAvailable: true },
    select: { id: true, name: true },
  });
  const availableIds = new Set(available.map((a) => a.id));

  return [...merged.entries()]
    .filter(([id]) => availableIds.has(id))
    .map(([id, v]) => ({
      itemId: id,
      name: available.find((a) => a.id === id)?.name || 'Unknown',
      percentage: v.percentage,
      ordersTogether: v.count,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, Math.min(limit, MAX_COMPANIONS));
}

export default { getCombinationStats, getUpsellSuggestions };
