import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { emitNotification } from '@/hooks/socket';
import { getStockLevels } from './inventory.service';
import { generateDailyBriefing } from './ai-manager.service';

/**
 * Phase C — deterministic proactive alerts.
 *
 * NO LLM runs here. Every detector is a plain, tenant-scoped query. Alerts are
 * persisted as `Notification` rows (so they survive refresh) and emitted over
 * Socket.io. Each alert may carry pre-wired actions that the admin dashboard
 * turns into buttons ("Open inventory", "Ask Jarvis", "Open orders").
 *
 * Deduplication is time-window based (no schema change): if an alert of the
 * same type was created within the window, it is not repeated.
 *
 * The daily briefing is deterministic too — the existing `generateDailyBriefing`
 * produces the narrative; we only push it once per day per restaurant.
 */

type NudgeType = 'LOW_STOCK' | 'ORDER_WAITING' | 'SUBSCRIPTION_EXPIRING' | 'DAILY_BRIEFING';

export interface NudgeAction {
  kind: 'navigate' | 'command';
  label: string;
  to?: string;
  text?: string;
}

const WAITING_ORDER_MINUTES = Number(process.env.PROACTIVE_WAITING_ORDER_MINUTES) || 20;
const LOW_STOCK_DEDUPE_HOURS = Number(process.env.PROACTIVE_LOW_STOCK_DEDUPE_HOURS) || 6;
const WAITING_DEDUPE_MINUTES = Number(process.env.PROACTIVE_WAITING_DEDUPE_MINUTES) || 20;
const EXPIRY_WINDOW_DAYS = Number(process.env.PROACTIVE_EXPIRY_WINDOW_DAYS) || 3;
const BRIEFING_HOUR = Number(process.env.PROACTIVE_BRIEFING_HOUR) || 7;
const MAX_RESTAURANTS = Number(process.env.PROACTIVE_MAX_RESTAURANTS) || 500;

interface ProactiveRestaurant {
  id: string;
  ownerId: string;
  name: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

async function recentAlertExists(restaurantId: string, type: NudgeType, since: Date): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: { restaurantId, type: type as any, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(existing);
}

async function notifyOwner(
  restaurant: ProactiveRestaurant,
  type: NudgeType,
  title: string,
  message: string,
  data: Record<string, unknown>
): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      restaurantId: restaurant.id,
      recipientType: 'OWNER',
      recipientId: restaurant.ownerId,
      type: type as any,
      title,
      message,
      data: data as any,
    },
  });

  try {
    emitNotification(restaurant.ownerId, {
      id: notification.id,
      restaurantId: restaurant.id,
      type,
      title,
      message,
      data,
      createdAt: notification.createdAt,
    });
  } catch (error) {
    logger.warn('Proactive notification socket emit failed', { restaurantId: restaurant.id, error: (error as Error).message });
  }
}

export async function detectLowStock(restaurant: ProactiveRestaurant, now = new Date()): Promise<number> {
  const levels = await getStockLevels(restaurant.id);
  const low = levels.filter((item) => item.isActive && item.lowStock);
  if (low.length === 0) return 0;

  const since = new Date(now.getTime() - LOW_STOCK_DEDUPE_HOURS * 3600_000);
  if (await recentAlertExists(restaurant.id, 'LOW_STOCK', since)) return 0;

  const preview = low
    .slice(0, 5)
    .map((item) => `${item.name} (${item.stock}${item.unit ? ` ${item.unit}` : ''})`)
    .join(', ');

  await notifyOwner(
    restaurant,
    'LOW_STOCK',
    `Low stock: ${low.length} item${low.length === 1 ? '' : 's'}`,
    preview,
    {
      kind: 'low_stock',
      items: low.slice(0, 10).map((item) => ({ name: item.name, stock: item.stock, unit: item.unit, reorderLevel: item.reorderLevel })),
      actions: [
        { kind: 'command', label: 'Review with Jarvis', text: 'Show me what stock is low' },
        { kind: 'navigate', label: 'Open inventory', to: '/dashboard/inventory' },
      ] satisfies NudgeAction[],
    }
  );

  return 1;
}

export async function detectWaitingOrders(restaurant: ProactiveRestaurant, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - WAITING_ORDER_MINUTES * 60_000);
  const orders = await prisma.order.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] },
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, orderNumber: true, tableNumber: true, status: true, createdAt: true },
  });
  if (orders.length === 0) return 0;

  const since = new Date(now.getTime() - WAITING_DEDUPE_MINUTES * 60_000);
  if (await recentAlertExists(restaurant.id, 'ORDER_WAITING', since)) return 0;

  const oldest = orders[0];
  const oldestMinutes = Math.max(1, Math.round((now.getTime() - oldest.createdAt.getTime()) / 60_000));

  await notifyOwner(
    restaurant,
    'ORDER_WAITING',
    `${orders.length} order${orders.length === 1 ? '' : 's'} waiting`,
    `Oldest: ${oldest.orderNumber}${oldest.tableNumber ? ` (Table ${oldest.tableNumber})` : ''} — ${oldestMinutes} min`,
    {
      kind: 'waiting_orders',
      orders: orders.map((order) => ({
        orderNumber: order.orderNumber,
        tableNumber: order.tableNumber,
        status: order.status,
        minutes: Math.max(1, Math.round((now.getTime() - order.createdAt.getTime()) / 60_000)),
      })),
      actions: [
        { kind: 'navigate', label: 'Open orders', to: '/dashboard/orders' },
        { kind: 'command', label: 'Ask Jarvis', text: 'Show open orders' },
      ] satisfies NudgeAction[],
    }
  );

  return 1;
}

export async function detectExpiringSubscription(restaurant: ProactiveRestaurant, now = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 3600_000);

  const isTrialEnding =
    restaurant.subscriptionStatus === 'TRIAL' &&
    !!restaurant.trialEndsAt &&
    restaurant.trialEndsAt > now &&
    restaurant.trialEndsAt <= soon;

  const isPlanEnding =
    restaurant.subscriptionStatus === 'ACTIVE' &&
    !!restaurant.planExpiresAt &&
    restaurant.planExpiresAt > now &&
    restaurant.planExpiresAt <= soon;

  if (!isTrialEnding && !isPlanEnding) return 0;

  const since = new Date(now.getTime() - 24 * 3600_000);
  if (await recentAlertExists(restaurant.id, 'SUBSCRIPTION_EXPIRING', since)) return 0;

  const endDate = (isTrialEnding ? restaurant.trialEndsAt : restaurant.planExpiresAt)!;

  await notifyOwner(
    restaurant,
    'SUBSCRIPTION_EXPIRING',
    isTrialEnding ? 'Your trial is ending soon' : 'Subscription renewal due soon',
    `${restaurant.name} ${isTrialEnding ? 'trial ends' : 'renews'} on ${endDate.toLocaleDateString('en-KE')}.`,
    {
      kind: 'subscription',
      endsAt: endDate.toISOString(),
      actions: [{ kind: 'navigate', label: 'View subscription', to: '/dashboard/settings' }] satisfies NudgeAction[],
    }
  );

  return 1;
}

export async function pushDailyBriefing(restaurant: ProactiveRestaurant, now = new Date()): Promise<number> {
  if (now.getHours() < BRIEFING_HOUR) return 0;

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (await recentAlertExists(restaurant.id, 'DAILY_BRIEFING', startOfDay)) return 0;

  const briefing = await generateDailyBriefing(restaurant.id, now);
  const insights = Array.isArray(briefing?.insights) ? briefing.insights : [];
  if (insights.length === 0) return 0;

  const summary = insights.slice(0, 3).map((insight: any) => insight.title).filter(Boolean).join(' · ');

  await notifyOwner(
    restaurant,
    'DAILY_BRIEFING',
    'Your daily briefing',
    summary || 'Your daily briefing is ready.',
    {
      kind: 'daily_briefing',
      revenue: briefing.revenue,
      orders: briefing.orders,
      changePct: briefing.changePct,
      insights: insights.slice(0, 6),
      actions: [{ kind: 'navigate', label: 'Open dashboard', to: '/dashboard' }] satisfies NudgeAction[],
    }
  );

  return 1;
}

export interface ProactiveRunResult {
  restaurants: number;
  lowStock: number;
  waitingOrders: number;
  expiringSubscriptions: number;
  dailyBriefings: number;
}

export async function runProactiveChecks(now = new Date()): Promise<ProactiveRunResult> {
  const restaurants = (await prisma.restaurant.findMany({
    where: { isActive: true, isSuspended: false },
    select: {
      id: true,
      ownerId: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      planExpiresAt: true,
    },
    take: MAX_RESTAURANTS,
  })) as ProactiveRestaurant[];

  const result: ProactiveRunResult = {
    restaurants: restaurants.length,
    lowStock: 0,
    waitingOrders: 0,
    expiringSubscriptions: 0,
    dailyBriefings: 0,
  };

  for (const restaurant of restaurants) {
    try {
      result.lowStock += await detectLowStock(restaurant, now);
    } catch (error) {
      logger.warn('Low-stock detector failed', { restaurantId: restaurant.id, error: (error as Error).message });
    }
    try {
      result.waitingOrders += await detectWaitingOrders(restaurant, now);
    } catch (error) {
      logger.warn('Waiting-orders detector failed', { restaurantId: restaurant.id, error: (error as Error).message });
    }
    try {
      result.expiringSubscriptions += await detectExpiringSubscription(restaurant, now);
    } catch (error) {
      logger.warn('Subscription-expiry detector failed', { restaurantId: restaurant.id, error: (error as Error).message });
    }
    try {
      result.dailyBriefings += await pushDailyBriefing(restaurant, now);
    } catch (error) {
      logger.warn('Daily-briefing detector failed', { restaurantId: restaurant.id, error: (error as Error).message });
    }
  }

  if (result.lowStock || result.waitingOrders || result.expiringSubscriptions || result.dailyBriefings) {
    logger.info('Proactive checks completed', result);
  }

  return result;
}

export default {
  runProactiveChecks,
  detectLowStock,
  detectWaitingOrders,
  detectExpiringSubscription,
  pushDailyBriefing,
};
