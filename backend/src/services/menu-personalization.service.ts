import { prisma } from '@/config/database';
import { getAllMenuItemCostings } from './recipe.service';
import { getUpsellSuggestions } from './upsell.service';

/**
 * Personalized QR menu storefront.
 *
 * Privacy rule: anonymous sessions only ever see aggregate sections
 * (most popular, best value, new, promotions). "Recommended for you" is
 * only computed when the session has placed at least one order (their own
 * data), and "Complete your meal" only when a cart is provided.
 */

const ITEM_SELECT = {
  id: true,
  name: true,
  nameSw: true,
  description: true,
  price: true,
  photoUrl: true,
  isAvailable: true,
  isTodaysSpecial: true,
  isFeatured: true,
  isNew: true,
  totalOrders: true,
  category: { select: { name: true } },
} as const;

export interface PersonalizedMenu {
  mostPopular: any[];
  bestValue: any[];
  newItems: any[];
  promotions: any[];
  recommendedForYou: any[] | null;
  completeYourMeal: any[] | null;
}

export async function getPersonalizedMenu(
  restaurantId: string,
  options: { sessionId?: string; cartItemIds?: string[] } = {}
): Promise<PersonalizedMenu> {
  const [mostPopular, newItems, costings, promotions] = await Promise.all([
    prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      orderBy: [{ totalOrders: 'desc' }, { createdAt: 'desc' }],
      select: ITEM_SELECT,
      take: 4,
    }),
    prisma.menuItem.findMany({
      where: { restaurantId, isAvailable: true, isNew: true },
      orderBy: { createdAt: 'desc' },
      select: ITEM_SELECT,
      take: 4,
    }),
    getAllMenuItemCostings(restaurantId),
    prisma.promotion.findMany({
      where: {
        restaurantId,
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
      },
      include: { menuItem: { select: ITEM_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
  ]);

  // Best value: highest-margin items that have recipes
  const costed = costings.filter((c) => c.hasRecipe && c.marginPct !== null);
  costed.sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0));
  const bestValueIds = costed.slice(0, 4).map((c) => c.menuItemId);
  const bestValueItems = bestValueIds.length > 0
    ? await prisma.menuItem.findMany({
        where: { restaurantId, id: { in: bestValueIds }, isAvailable: true },
        select: ITEM_SELECT,
      })
    : [];

  // "Recommended for you": only from the session's own order history
  let recommendedForYou: any[] | null = null;
  if (options.sessionId) {
    const sessionOrders = await prisma.order.findMany({
      where: { restaurantId, sessionId: options.sessionId },
      select: { items: { select: { menuItemId: true, menuItem: { select: { categoryId: true } } } } },
      take: 50,
    });

    if (sessionOrders.length > 0) {
      const categoryCounts = new Map<string, number>();
      const alreadyOrdered = new Set<string>();
      for (const o of sessionOrders) {
        for (const i of o.items) {
          if (i.menuItemId) alreadyOrdered.add(i.menuItemId);
          if (i.menuItem?.categoryId) {
            categoryCounts.set(i.menuItem.categoryId, (categoryCounts.get(i.menuItem.categoryId) || 0) + 1);
          }
        }
      }

      const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
      if (topCategories.length > 0) {
        recommendedForYou = await prisma.menuItem.findMany({
          where: {
            restaurantId,
            categoryId: { in: topCategories },
            id: { notIn: [...alreadyOrdered] },
            isAvailable: true,
          },
          orderBy: [{ totalOrders: 'desc' }, { createdAt: 'desc' }],
          select: ITEM_SELECT,
          take: 3,
        });
        if (recommendedForYou.length === 0) recommendedForYou = null;
      }
    }
  }

  // "Complete your meal": basket analysis on the provided cart
  let completeYourMeal: any[] | null = null;
  if (options.cartItemIds && options.cartItemIds.length > 0) {
    const suggestions = await getUpsellSuggestions(restaurantId, options.cartItemIds, 3);
    if (suggestions.length > 0) {
      completeYourMeal = await prisma.menuItem.findMany({
        where: { restaurantId, id: { in: suggestions.map((s) => s.itemId) } },
        select: ITEM_SELECT,
      });
    }
  }

  return {
    mostPopular,
    bestValue: bestValueItems,
    newItems,
    promotions: promotions.map((p) => ({ ...p, menuItem: p.menuItem || null })),
    recommendedForYou,
    completeYourMeal,
  };
}
