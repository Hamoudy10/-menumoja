import { prisma } from '@/config/database';
import logger from '@/utils/logger';

/**
 * Profitability engine.
 *
 * Metrics:
 *   grossSales   = Σ order totalAmount (paid, not cancelled) in period
 *   discounts    = grossSales − Σ paid payment amounts (cash discounts etc.)
 *   refunds      = Σ refunded payment amounts
 *   netSales     = Σ paid payments − Σ refunded payments
 *   cogs         = estimated: Σ(order item qty × current active recipe cost)
 *                  for items with recipes (no recipe ⇒ cost 0)
 *   contribution = netSales − cogs
 *   margin %     = contribution / netSales × 100
 *   aov          = netSales / paid order count
 *
 * COGS is an ESTIMATE based on current recipe costs (order-time snapshots
 * arrive with the order-COGS phase). Reported as such in the UI.
 */

export interface ProfitabilityOverview {
  period: string;
  grossSales: number;
  discounts: number;
  refunds: number;
  netSales: number;
  cogs: number;
  contribution: number;
  marginPct: number;
  orderCount: number;
  unitsSold: number;
  averageOrderValue: number;
  costedUnits: number;
}

export async function getProfitabilityOverview(
  restaurantId: string,
  start: Date,
  end: Date,
  periodLabel: string
): Promise<ProfitabilityOverview> {
  const [orderAgg, paidPayments, refundedPayments, orderItems] = await Promise.all([
    prisma.order.aggregate({
      where: {
        restaurantId,
        paymentStatus: 'PAID',
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: {
        restaurantId,
        status: 'PAID',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        restaurantId,
        status: 'REFUNDED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          paymentStatus: 'PAID',
          status: { not: 'CANCELLED' },
        },
        createdAt: { gte: start, lte: end },
      },
      select: { menuItemId: true, quantity: true },
    }),
  ]);

  const grossSales = Number(orderAgg._sum.totalAmount || 0);
  const orderCount = orderAgg._count.id;
  const paidSum = Number(paidPayments._sum.amount || 0);
  const refunds = Number(refundedPayments._sum.amount || 0);
  const netSales = Math.round((paidSum - refunds) * 100) / 100;
  const discounts = Math.max(0, Math.round((grossSales - paidSum) * 100) / 100);

  // Estimated COGS from current active recipe costs
  const menuItemIds = [...new Set(orderItems.map((oi) => oi.menuItemId).filter(Boolean))] as string[];
  const recipes = menuItemIds.length > 0
    ? await prisma.recipe.findMany({
        where: { restaurantId, menuItemId: { in: menuItemIds }, isActive: true },
        include: { ingredients: true },
      })
    : [];
  const costMap = new Map<string, number>();
  for (const r of recipes) {
    const cost = r.ingredients.reduce((s, ing) => s + Number(ing.quantity) * Number(ing.unitCostSnapshot), 0);
    costMap.set(r.menuItemId, Math.round(cost * 100) / 100);
  }

  let cogs = 0;
  let unitsSold = 0;
  let costedUnits = 0;
  for (const oi of orderItems) {
    unitsSold += oi.quantity;
    const cost = oi.menuItemId ? costMap.get(oi.menuItemId) : undefined;
    if (cost !== undefined) {
      cogs += cost * oi.quantity;
      costedUnits += oi.quantity;
    }
  }
  cogs = Math.round(cogs * 100) / 100;

  const contribution = Math.round((netSales - cogs) * 100) / 100;
  const marginPct = netSales > 0 ? Math.round((contribution / netSales) * 1000) / 10 : 0;
  const averageOrderValue = orderCount > 0 ? Math.round((netSales / orderCount) * 100) / 100 : 0;

  return {
    period: periodLabel,
    grossSales: Math.round(grossSales * 100) / 100,
    discounts,
    refunds,
    netSales,
    cogs,
    contribution,
    marginPct,
    orderCount,
    unitsSold,
    averageOrderValue,
    costedUnits,
  };
}

export type MenuEngineeringClass = 'STAR' | 'PLOW_HORSE' | 'PUZZLE' | 'DOG' | 'NO_COST_DATA';

export interface MenuEngineeringItem {
  menuItemId: string;
  menuItemName: string;
  price: number;
  unitsSold: number;
  revenue: number;
  cost: number;
  contribution: number;
  marginPct: number | null;
  classification: MenuEngineeringClass;
  recommendation: string;
}

const RECOMMENDATIONS: Record<MenuEngineeringClass, string> = {
  STAR: 'Promote & protect — high popularity, high margin',
  PLOW_HORSE: 'Reprice or redesign to raise margin',
  PUZZLE: 'Promote & reposition to increase visibility',
  DOG: 'Review — bundle, reprice, or remove',
  NO_COST_DATA: 'Add a recipe to see profitability',
};

/**
 * Menu engineering matrix.
 * Popularity = units sold; profitability = current margin %.
 * Items are split at the median of each axis. Items without a recipe are
 * classified NO_COST_DATA (never guessed).
 */
export async function getMenuEngineering(
  restaurantId: string,
  start: Date,
  end: Date
): Promise<{ matrix: MenuEngineeringItem[]; summary: Record<string, number> }> {
  const [sales, costings, recipes] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        menuItemId: { not: null },
        order: {
          restaurantId,
          paymentStatus: 'PAID',
          status: { not: 'CANCELLED' },
        },
        createdAt: { gte: start, lte: end },
      },
      _sum: { quantity: true },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId },
      select: { id: true, name: true, price: true },
    }),
    prisma.recipe.findMany({
      where: { restaurantId, isActive: true },
      include: { ingredients: true },
    }),
  ]);

  const saleMap = new Map(sales.map((s) => [s.menuItemId as string, Number(s._sum.quantity || 0)]));
  const recipeMap = new Map(recipes.map((r) => [r.menuItemId, r]));

  const rows: Array<{ menuItemId: string; name: string; price: number; unitsSold: number; cost: number | null }> = costings.map((item) => {
    const recipe = recipeMap.get(item.id);
    const cost = recipe
      ? Math.round(recipe.ingredients.reduce((s, ing) => s + Number(ing.quantity) * Number(ing.unitCostSnapshot), 0) * 100) / 100
      : null;
    return {
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      unitsSold: saleMap.get(item.id) || 0,
      cost,
    };
  });

  // Only items WITH sales data participate in the popularity median so that
  // unsold items land in the low-popularity half rather than skewing it.
  const sold = rows.filter((r) => r.unitsSold > 0);
  const priced = rows.filter((r) => r.cost !== null);

  const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const popularityMedian = median(sold.map((r) => r.unitsSold));
  const marginMedian = median(priced.map((r) => (r.price > 0 ? ((r.price - (r.cost as number)) / r.price) * 100 : 0)));

  let summary: Record<string, number> = { STAR: 0, PLOW_HORSE: 0, PUZZLE: 0, DOG: 0, NO_COST_DATA: 0 };

  const matrix: MenuEngineeringItem[] = rows.map((row) => {
    const price = row.price;
    const contribution = row.cost !== null ? Math.round((price - row.cost) * 100) / 100 : null;
    const marginPct = row.cost !== null && price > 0 ? Math.round(((price - row.cost) / price) * 1000) / 10 : null;

    let classification: MenuEngineeringClass;
    if (marginPct === null) {
      classification = 'NO_COST_DATA';
    } else {
      const highPopularity = row.unitsSold >= popularityMedian;
      const highMargin = marginPct >= marginMedian;
      if (highPopularity && highMargin) classification = 'STAR';
      else if (highPopularity) classification = 'PLOW_HORSE';
      else if (highMargin) classification = 'PUZZLE';
      else classification = 'DOG';
    }

    summary[classification] += 1;

    return {
      menuItemId: row.menuItemId,
      menuItemName: row.name,
      price,
      unitsSold: row.unitsSold,
      revenue: Math.round(row.unitsSold * price * 100) / 100,
      cost: row.cost ?? 0,
      contribution: contribution ?? 0,
      marginPct,
      classification,
      recommendation: RECOMMENDATIONS[classification],
    };
  });

  return { matrix, summary };
}

export default { getProfitabilityOverview, getMenuEngineering };
