import { prisma } from '@/config/database';
import * as openai from '@/integrations/openai';
import { detectIntent, runTool, formatToolData } from './manager.service';
import { recordAiUsage, isWithinDailyBudget, providerName, providerForModel } from './ai-usage.service';
import logger from '@/utils/logger';

/**
 * Menu Moja AI Manager — the owner-facing assistant.
 *
 * - Questions are mapped to structured tools (intent detection); the LLM
 *   only ever sees the tool output, never the database.
 * - Replies are grounded: the model is instructed to answer strictly from
 *   the provided data and not to invent numbers.
 * - Unknown intents cost nothing (no LLM call — a helpful menu is shown).
 * - The daily briefing is deterministic: every insight carries a reason
 *   and a data source, so owners can trust and verify it.
 */

async function answerFromLlm(restaurantId: string, question: string, dataText: string): Promise<string> {
  const startedAt = Date.now();
  const result = await openai.generateManagerAnswer(question, dataText);

  await recordAiUsage({
    restaurantId,
    feature: 'MANAGER',
    provider: providerName(),
    model: providerForModel(result.model || 'deepseek-v4-flash'),
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    latencyMs: Date.now() - startedAt,
  });

  return result.reply;
}

export async function answerQuestion(restaurantId: string, question: string): Promise<{ reply: string; toolUsed: string | null; source: 'llm' | 'tool' }> {
  const message = (question || '').trim();
  if (!message) {
    return { reply: 'Ask me about your sales, profitability, stock, customers, staff, campaigns or forecasts.', toolUsed: null, source: 'tool' };
  }

  const toolKey = detectIntent(message);
  if (!toolKey) {
    return {
      reply: 'I can help with: sales summaries, order volumes, profitability and margins, inventory risks, customer segments and retention, staff performance, campaign results, and sales forecasts. Try asking e.g. "How did sales perform this month?" or "What stock is running low?"',
      toolUsed: null,
      source: 'tool',
    };
  }

  const { label, data } = await runTool(restaurantId, toolKey);
  const dataText = formatToolData(label, data);

  // Budget guard: stay cheap — if exhausted, return the structured data directly.
  if (!(await isWithinDailyBudget(restaurantId))) {
    return { reply: dataText, toolUsed: toolKey, source: 'tool' };
  }

  try {
    const reply = await answerFromLlm(restaurantId, message, dataText);
    return { reply, toolUsed: toolKey, source: 'llm' };
  } catch (error) {
    logger.warn('Manager LLM failed — returning structured data', { error: (error as Error).message, restaurantId });
    return { reply: dataText, toolUsed: toolKey, source: 'tool' };
  }
}

// ── Daily briefing ──

export async function generateDailyBriefing(restaurantId: string, date = new Date()): Promise<any> {
  const day = new Date(date);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  start.setDate(start.getDate() - 1); // "yesterday"
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const comparable = new Date(start);
  comparable.setDate(comparable.getDate() - 7);

  const [today, weekAgo, topItems, itemsWithRecipes] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: start, lte: end } },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: comparable, lt: start } },
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
      take: 3,
    }),
    prisma.recipe.findMany({
      where: { restaurantId, isActive: true },
      include: { ingredients: true },
    }),
  ]);

  const revenue = Number(today._sum.totalAmount || 0);
  const orders = today._count.id;
  const previousRevenue = Number(weekAgo._sum.totalAmount || 0);
  const changePct = previousRevenue > 0 ? Math.round(((revenue - previousRevenue) / previousRevenue) * 1000) / 10 : null;

  const itemNames = await prisma.menuItem.findMany({
    where: { restaurantId, id: { in: topItems.map((t) => t.menuItemId as string) } },
    select: { id: true, name: true, price: true },
  });
  const itemMap = new Map(itemNames.map((i) => [i.id, i]));

  // margins from active recipes
  const costMap = new Map<string, number>();
  for (const r of itemsWithRecipes) {
    costMap.set(r.menuItemId, Math.round(r.ingredients.reduce((s, ing) => s + Number(ing.quantity) * Number(ing.unitCostSnapshot), 0) * 100) / 100);
  }

  const soldItems = topItems.map((t) => ({ id: t.menuItemId as string, units: Number(t._sum.quantity || 0) }));
  const topSeller = soldItems[0] ? { name: itemMap.get(soldItems[0].id)?.name || 'Unknown', units: soldItems[0].units } : null;

  const marginCandidates = soldItems
    .map((s) => {
      const item = itemMap.get(s.id);
      const price = item ? Number(item.price) : 0;
      const cost = costMap.get(s.id);
      if (!item || cost === undefined || price <= 0) return null;
      const margin = Math.round(((price - cost) / price) * 1000) / 10;
      return { name: item.name, margin };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.margin - a.margin);
  const highestMargin = marginCandidates[0] || null;

  // warnings: low stock
  const { getStockLevels } = await import('./inventory.service');
  const levels = await getStockLevels(restaurantId);
  const lowStockItems = levels.filter((i) => i.isActive && i.lowStock).slice(0, 3);

  const insights = [
    {
      type: 'revenue',
      title: `Yesterday's revenue: KES ${revenue.toLocaleString()}`,
      reason: `${orders} paid order(s), average KES ${orders > 0 ? Math.round(revenue / orders).toLocaleString() : 0} per order`,
      source: 'Paid orders',
      changePct,
    },
  ];

  if (topSeller) {
    insights.push({
      type: 'top_seller',
      title: `Top seller: ${topSeller.name}`,
      reason: `${topSeller.units} unit(s) sold yesterday`,
      source: 'Order items',
      changePct: null,
    });
  }
  if (highestMargin) {
    insights.push({
      type: 'margin',
      title: `Highest margin: ${highestMargin.name} (${highestMargin.margin}%)`,
      reason: `Recipe cost vs selling price among yesterday's best sellers`,
      source: 'Active recipes + menu prices',
      changePct: null,
    });
  }
  if (lowStockItems.length > 0) {
    insights.push({
      type: 'warning',
      title: `Low stock: ${lowStockItems.map((i) => i.name).join(', ')}`,
      reason: `Below reorder level — consider purchasing before tonight's service`,
      source: 'Inventory movements vs reorder levels',
      changePct: null,
    });
  }
  if (changePct !== null) {
    insights.push({
      type: 'comparison',
      title: `${changePct >= 0 ? '+' : ''}${changePct}% vs the same weekday last week`,
      reason: `Revenue KES ${revenue.toLocaleString()} vs KES ${previousRevenue.toLocaleString()}`,
      source: 'Paid orders, 7-day comparison',
      changePct,
    });
  }

  if (insights.length === 1) {
    insights.push({
      type: 'note',
      title: 'No orders yesterday',
      reason: 'Check that your QR codes are placed and ordering is enabled',
      source: 'Order data',
      changePct: null,
    });
  }

  return {
    date: start.toISOString().slice(0, 10),
    revenue,
    orders,
    averageOrderValue: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
    changePct,
    insights,
  };
}

export default { answerQuestion, generateDailyBriefing };
