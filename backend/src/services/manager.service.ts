import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { getProfitabilityOverview } from './profitability.service';
import { getStockLevels } from './inventory.service';
import { classifyCustomer } from './customer.service';

/**
 * AI Restaurant Manager — structured tool layer.
 * Every tool returns ONLY the data needed to answer the question
 * (never a database dump). All retrievals are tenant-scoped.
 */

function rangeFor(period: 'today' | 'week' | 'month' | 'year'): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

export async function getSalesSummary(restaurantId: string, period: 'today' | 'week' | 'month' = 'month'): Promise<any> {
  const { start, end } = rangeFor(period);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - (end.getTime() - start.getTime()) / 86400000);

  const [current, previous, topItems] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: start, lte: end } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: prevStart, lt: start } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        menuItemId: { not: null },
        order: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: start, lte: end } },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);

  const itemNames = await prisma.menuItem.findMany({
    where: { restaurantId, id: { in: topItems.map((t) => t.menuItemId as string) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(itemNames.map((i) => [i.id, i.name]));

  const revenue = Number(current._sum.totalAmount || 0);
  const orders = current._count.id;
  const previousRevenue = Number(previous._sum.totalAmount || 0);
  const changePct = previousRevenue > 0 ? Math.round(((revenue - previousRevenue) / previousRevenue) * 1000) / 10 : null;

  return {
    period,
    revenue: Math.round(revenue * 100) / 100,
    orders,
    averageOrderValue: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
    comparisonToPreviousPeriod: { previousRevenue, changePct },
    topItems: topItems.map((t) => ({ name: nameMap.get(t.menuItemId as string) || 'Unknown', unitsSold: Number(t._sum.quantity || 0) })),
  };
}

export async function getOrderSummary(restaurantId: string, period: 'today' | 'week' | 'month' = 'today'): Promise<any> {
  const { start, end } = rangeFor(period);
  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: start, lte: end } },
    select: { status: true, paymentStatus: true, createdAt: true, tableNumber: true },
  });

  const byStatus: Record<string, number> = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

  const hourly: Record<string, number> = {};
  for (const o of orders) {
    const h = String(o.createdAt.getHours()).padStart(2, '0');
    hourly[`${h}:00`] = (hourly[`${h}:00`] || 0) + 1;
  }
  const peakHour = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return { total: orders.length, byStatus, peakHour, dineIn: orders.filter((o) => o.tableNumber && o.tableNumber > 0).length, takeaway: orders.filter((o) => !o.tableNumber || o.tableNumber === 0).length };
}

export async function getInventoryRisk(restaurantId: string): Promise<any> {
  const levels = await getStockLevels(restaurantId);
  const low = levels.filter((i) => i.isActive && i.lowStock);
  const out = levels.filter((i) => i.isActive && i.outOfStock);
  return {
    lowStockCount: low.length,
    outOfStockCount: out.length,
    critical: [...out, ...low].slice(0, 10).map((i) => ({
      name: i.name,
      stock: i.stock,
      reorderLevel: Number(i.reorderLevel),
      lastUnitCost: i.lastUnitCost,
    })),
  };
}

export async function getCustomerSegments(restaurantId: string): Promise<any> {
  const customers = await prisma.customer.findMany({
    where: { restaurantId },
    select: { id: true, totalSpend: true, totalVisits: true, firstVisit: true, lastVisit: true },
  });

  const segments: Record<string, number> = {};
  for (const c of customers) {
    for (const s of classifyCustomer({
      totalSpend: Number(c.totalSpend),
      totalVisits: c.totalVisits,
      firstVisit: c.firstVisit,
      lastVisit: c.lastVisit,
      lunchShare: 0, dinnerShare: 0, weekendShare: 0, topCategoryShare: 0,
    })) {
      segments[s] = (segments[s] || 0) + 1;
    }
  }

  const active = customers.filter((c) => c.lastVisit.getTime() > Date.now() - 30 * 86400000).length;
  const returning = customers.filter((c) => c.totalVisits >= 2).length;

  return {
    totalCustomers: customers.length,
    activeLast30Days: active,
    repeatCustomers: returning,
    repeatRatePct: customers.length > 0 ? Math.round((returning / customers.length) * 1000) / 10 : 0,
    segments,
  };
}

export async function getStaffMetrics(restaurantId: string, period: 'week' | 'month' = 'month'): Promise<any> {
  const { start, end } = rangeFor(period);
  const [orderAgg, paymentAgg, staff] = await Promise.all([
    prisma.order.groupBy({
      by: ['waiterId'],
      where: { restaurantId, waiterId: { not: null }, status: { not: 'CANCELLED' }, createdAt: { gte: start, lte: end } },
      _count: { id: true },
    }),
    prisma.payment.groupBy({
      by: ['cashierId'],
      where: { restaurantId, cashierId: { not: null }, status: 'PAID', createdAt: { gte: start, lte: end } },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.staff.findMany({ where: { restaurantId, isActive: true }, select: { id: true, fullName: true, role: true } }),
  ]);

  const staffMap = new Map(staff.map((s) => [s.id, s]));
  return {
    period,
    waiters: orderAgg.map((o) => ({ name: staffMap.get(o.waiterId as string)?.fullName || 'Unknown', ordersServed: o._count.id })),
    cashiers: paymentAgg.map((p) => ({
      name: staffMap.get(p.cashierId as string)?.fullName || 'Unknown',
      payments: p._count.id,
      totalCollected: Number(p._sum.amount || 0),
    })),
  };
}

export async function getCampaignResults(restaurantId: string): Promise<any> {
  const campaigns = await prisma.campaign.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { events: true },
  });

  return campaigns.map((c) => ({
    name: c.name,
    status: c.status,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    totalRecipients: c.totalRecipients,
    conversions: c.events.filter((e) => e.type === 'ORDER').length,
    revenueAttributed: Math.round(c.events.reduce((sum, e) => sum + Number(e.value), 0) * 100) / 100,
  }));
}

/**
 * Naive forecast: average revenue of the same weekday over the previous
 * 4 weeks, with a confidence band based on variability.
 */
export async function getForecast(restaurantId: string, days = 7): Promise<any> {
  const rows: Array<{ date: string; weekday: string; expected: number; low: number; high: number; confidence: 'High' | 'Moderate' | 'Low' }> = [];

  for (let d = 1; d <= days; d++) {
    const target = new Date();
    target.setDate(target.getDate() + d);
    const weekday = target.getDay();

    const samples: number[] = [];
    for (let w = 1; w <= 4; w++) {
      const day = new Date(target);
      day.setDate(day.getDate() - w * 7);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const agg = await prisma.order.aggregate({
        where: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
      });
      samples.push(Number(agg._sum.totalAmount || 0));
    }

    const nonZero = samples.filter((s) => s > 0);
    const expected = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
    const mean = expected;
    const variance = nonZero.length > 1 ? nonZero.reduce((acc, s) => acc + (s - mean) ** 2, 0) / (nonZero.length - 1) : 0;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    const confidence: 'High' | 'Moderate' | 'Low' = nonZero.length === 0 ? 'Low' : cv <= 0.3 ? 'High' : cv <= 0.6 ? 'Moderate' : 'Low';
    const band = mean * (cv > 0.6 ? 0.5 : cv <= 0.3 ? 0.15 : 0.3);

    rows.push({
      date: target.toISOString().slice(0, 10),
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday],
      expected: Math.round(expected * 100) / 100,
      low: Math.max(0, Math.round((expected - band) * 100) / 100),
      high: Math.round((expected + band) * 100) / 100,
      confidence,
    });
  }

  return { basis: 'Average of the same weekday over the previous 4 weeks', days: rows };
}

export async function getProfitabilitySnapshot(restaurantId: string, period: 'week' | 'month' = 'month'): Promise<any> {
  const overview = await getProfitabilityOverview(restaurantId, rangeFor(period).start, rangeFor(period).end, period);
  return {
    period,
    netSales: overview.netSales,
    estimatedCogs: overview.cogs,
    contribution: overview.contribution,
    marginPct: overview.marginPct,
    averageOrderValue: overview.averageOrderValue,
  };
}

const TOOL_REGISTRY: Record<string, { keywords: string[]; run: (restaurantId: string, period?: any) => Promise<any>; label: string }> = {
  sales: {
    keywords: ['sale', 'revenue', 'income', 'earn', 'how much did we make', 'turnover', 'performance', 'perform', 'did we do'],
    run: (r) => getSalesSummary(r, 'month'),
    label: 'Sales summary',
  },
  orders: {
    keywords: ['order', 'orders today', 'how many orders', 'peak'],
    run: (r) => getOrderSummary(r, 'today'),
    label: 'Order summary',
  },
  profit: {
    keywords: ['profit', 'margin', 'cogs', 'cost of goods', 'food cost', 'contribution', 'profitable'],
    run: (r) => getProfitabilitySnapshot(r, 'month'),
    label: 'Profitability',
  },
  inventory: {
    keywords: ['stock', 'inventory', 'ingredient', 'low stock', 'run out', 'reorder', 'supply'],
    run: (r) => getInventoryRisk(r),
    label: 'Inventory risk',
  },
  customers: {
    keywords: ['customer', 'segment', 'vip', 'frequent', 'retention', 'repeat', 'dormant', 'churn'],
    run: (r) => getCustomerSegments(r),
    label: 'Customer segments',
  },
  staff: {
    keywords: ['staff', 'waiter', 'cashier', 'employee', 'who served', 'performance'],
    run: (r) => getStaffMetrics(r, 'month'),
    label: 'Staff metrics',
  },
  campaigns: {
    keywords: ['campaign', 'whatsapp', 'promotion results', 'marketing'],
    run: (r) => getCampaignResults(r),
    label: 'Campaign results',
  },
  forecast: {
    keywords: ['forecast', 'predict', 'tomorrow', 'next week', 'expect', 'future sales'],
    run: (r) => getForecast(r, 7),
    label: 'Sales forecast',
  },
};

export function detectIntent(message: string): string | null {
  const lower = message.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [key, tool] of Object.entries(TOOL_REGISTRY)) {
    // longer (more specific) keywords outweigh short generic ones on ties
    const score = tool.keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? kw.length : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function runTool(restaurantId: string, toolKey: string): Promise<{ label: string; data: any }> {
  const tool = TOOL_REGISTRY[toolKey];
  if (!tool) throw new Error(`Unknown tool: ${toolKey}`);
  const data = await tool.run(restaurantId);
  return { label: tool.label, data };
}

export function formatToolData(label: string, data: any): string {
  try {
    return `${label}:\n${JSON.stringify(data, null, 2)}`;
  } catch {
    return `${label}: (data unavailable)`;
  }
}

export const AVAILABLE_INTENTS = Object.keys(TOOL_REGISTRY).map((k) => TOOL_REGISTRY[k].label);

export default {
  getSalesSummary,
  getOrderSummary,
  getInventoryRisk,
  getCustomerSegments,
  getStaffMetrics,
  getCampaignResults,
  getForecast,
  getProfitabilitySnapshot,
  detectIntent,
  runTool,
};
