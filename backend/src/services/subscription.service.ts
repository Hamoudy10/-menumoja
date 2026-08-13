import { prisma } from '@/config/database';
import { ConflictError, AppError } from '@/utils/errors';

/**
 * Subscription & plan enforcement.
 *
 * - Plans are the single source of truth for pricing + limits (seeded —
 *   never hard-coded in the frontend).
 * - Enforcement is server-side: creating a menu item or table beyond the
 *   plan limit is rejected (409), and feature-gated endpoints check the
 *   plan before allowing access.
 * - Usage is reported to the owner (GET /restaurant/me/subscription).
 */

export async function getPlanForRestaurant(restaurantId: string): Promise<any | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { planId: true, subscriptionStatus: true, trialEndsAt: true, planExpiresAt: true, isSuspended: true },
  });
  if (!restaurant) return null;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: restaurant.planId } });
  return { ...restaurant, plan };
}

export async function assertRestaurantUsable(restaurantId: string): Promise<void> {
  const info = await getPlanForRestaurant(restaurantId);
  if (!info) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
  if (info.isSuspended || info.subscriptionStatus === 'SUSPENDED') {
    throw new ConflictError('This restaurant is suspended. Contact support to reactivate.', 'Mgahawa umesimamishwa. Wasiliana na usaidizi kuuwasha tena.');
  }
  if (info.subscriptionStatus === 'EXPIRED') {
    throw new ConflictError('Your subscription has expired. Renew to continue using Menu Moja.', 'Usajili wako umeisha muda. Sasisha ili uendelee kutumia Menu Moja.');
  }
}

export async function assertCanCreateMenuItem(restaurantId: string): Promise<void> {
  await assertRestaurantUsable(restaurantId);
  const info = await getPlanForRestaurant(restaurantId);
  if (!info?.plan) return;

  if (info.plan.maxMenuItems) {
    const count = await prisma.menuItem.count({ where: { restaurantId } });
    if (count >= info.plan.maxMenuItems) {
      throw new ConflictError(
        `Your ${info.plan.name} plan allows up to ${info.plan.maxMenuItems} menu items. Upgrade to add more.`,
        `Mpango wako wa ${info.plan.name} unaruhusu bidhaa ${info.plan.maxMenuItems}. Sasisha ili uongeze zaidi.`
      );
    }
  }
}

export async function assertCanCreateTable(restaurantId: string): Promise<void> {
  await assertRestaurantUsable(restaurantId);
  const info = await getPlanForRestaurant(restaurantId);
  if (!info?.plan) return;

  if (info.plan.maxTables) {
    const count = await prisma.restaurantTable.count({ where: { restaurantId } });
    if (count >= info.plan.maxTables) {
      throw new ConflictError(
        `Your ${info.plan.name} plan allows up to ${info.plan.maxTables} tables. Upgrade to add more.`,
        `Mpango wako wa ${info.plan.name} unaruhusu meza ${info.plan.maxTables}. Sasisha ili uongeze zaidi.`
      );
    }
  }
}

export async function assertFeatureEnabled(restaurantId: string, feature: 'analytics' | 'surveillance' | 'ussd' | 'multiBranch' | 'ordering'): Promise<void> {
  const info = await getPlanForRestaurant(restaurantId);
  if (!info?.plan) return;

  const flagMap: Record<string, boolean> = {
    analytics: info.plan.hasAnalytics,
    surveillance: info.plan.hasSurveillance,
    ussd: info.plan.hasUssd,
    multiBranch: info.plan.hasMultiBranch,
    ordering: info.plan.hasOrdering,
  };

  if (!flagMap[feature]) {
    throw new ConflictError(`${feature} is not included in your ${info.plan.name} plan. Upgrade to enable it.`, `${feature} haipo kwenye mpango wako wa ${info.plan.name}. Sasisha ili uwezeshe.`);
  }
}

export async function getSubscriptionSummary(restaurantId: string): Promise<any> {
  const info = await getPlanForRestaurant(restaurantId);
  if (!info || !info.plan) {
    throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
  }

  const [menuItemCount, tableCount, branchCount] = await Promise.all([
    prisma.menuItem.count({ where: { restaurantId } }),
    prisma.restaurantTable.count({ where: { restaurantId } }),
    prisma.restaurantBranch.count({ where: { restaurantId } }),
  ]);

  return {
    status: info.subscriptionStatus,
    trialEndsAt: info.trialEndsAt,
    planExpiresAt: info.planExpiresAt,
    isSuspended: info.isSuspended,
    plan: {
      id: info.plan.id,
      name: info.plan.name,
      priceMonthlyKes: Number(info.plan.priceMonthlyKes),
      priceYearlyKes: Number(info.plan.priceYearlyKes),
      maxMenuItems: info.plan.maxMenuItems,
      maxTables: info.plan.maxTables,
      features: {
        ordering: info.plan.hasOrdering,
        analytics: info.plan.hasAnalytics,
        surveillance: info.plan.hasSurveillance,
        ussd: info.plan.hasUssd,
        multiBranch: info.plan.hasMultiBranch,
      },
    },
    usage: {
      menuItems: menuItemCount,
      tables: tableCount,
      branches: branchCount,
    },
  };
}

export async function listPlans(): Promise<any[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthlyKes: 'asc' },
  });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    priceMonthlyKes: Number(p.priceMonthlyKes),
    priceYearlyKes: Number(p.priceYearlyKes),
    maxMenuItems: p.maxMenuItems,
    maxTables: p.maxTables,
    features: {
      ordering: p.hasOrdering,
      analytics: p.hasAnalytics,
      surveillance: p.hasSurveillance,
      ussd: p.hasUssd,
      multiBranch: p.hasMultiBranch,
    },
  }));
}

export default { getPlanForRestaurant, assertRestaurantUsable, assertCanCreateMenuItem, assertCanCreateTable, assertFeatureEnabled, getSubscriptionSummary, listPlans };
