import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { config } from '@/config';
import logger from '@/utils/logger';

/**
 * AI guardrails: cost control + hallucination grounding + usage tracking.
 *
 * - Every LLM call is logged (AiUsageLog) with real token counts and an
 *   estimated cost in KES.
 * - A daily token budget per restaurant caps LLM spend: when exceeded,
 *   customer chat silently falls back to the local rule-based chef.
 * - Customer-chat responses are cached (Redis) keyed by menu fingerprint +
 *   language + message, so repeated questions cost nothing.
 * - Replies are grounded: any "KES <amount>" claimed by the model must
 *   match a price in the served menu context, otherwise the reply is
 *   rejected and the safe fallback is used.
 * - Prompt changes bump PROMPT_VERSION so cost attribution stays honest.
 */

export const PROMPT_VERSION = '2026-08-12.1';

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const CACHE_PREFIX = 'ai:chat:';

// Prices per 1M tokens (USD). DeepSeek default; OpenAI fallback.
const PRICE_USD_PER_M_INPUT: Record<string, number> = {
  deepseek: 0.14,
  openai: 2.5,
};
const PRICE_USD_PER_M_OUTPUT: Record<string, number> = {
  deepseek: 0.28,
  openai: 10,
};
const USD_TO_KES = 129;

/** Per-restaurant daily LLM token budget before falling back to rules. */
export const DAILY_TOKEN_BUDGET_PER_RESTAURANT = 200_000;

export function providerForModel(model: string): 'deepseek' | 'openai' {
  return model.includes('deepseek') ? 'deepseek' : 'openai';
}

export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

export function estimateCostKes(provider: 'deepseek' | 'openai', promptTokens: number, completionTokens: number): number {
  const inPrice = PRICE_USD_PER_M_INPUT[provider] ?? PRICE_USD_PER_M_INPUT.deepseek;
  const outPrice = PRICE_USD_PER_M_OUTPUT[provider] ?? PRICE_USD_PER_M_OUTPUT.deepseek;
  const costUsd = (promptTokens / 1_000_000) * inPrice + (completionTokens / 1_000_000) * outPrice;
  return Math.round(costUsd * USD_TO_KES * 10_000) / 10_000;
}

export interface UsageRecord {
  restaurantId: string;
  sessionId?: string;
  feature: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs?: number;
  promptVersion?: string;
  cached?: boolean;
}

export async function recordAiUsage(record: UsageRecord): Promise<void> {
  try {
    const totalTokens = record.promptTokens + record.completionTokens;
    await prisma.aiUsageLog.create({
      data: {
        restaurantId: record.restaurantId,
        sessionId: record.sessionId || null,
        feature: record.feature,
        provider: record.provider,
        model: record.model,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens,
        estimatedCostKes: estimateCostKes(record.provider as 'deepseek' | 'openai', record.promptTokens, record.completionTokens),
        latencyMs: record.latencyMs || null,
        promptVersion: record.promptVersion || PROMPT_VERSION,
        cached: record.cached || false,
      },
    });
  } catch (error: any) {
    logger.error('AI usage logging failed', { error: error.message, restaurantId: record.restaurantId });
  }
}

export async function getDailyTokenUsage(restaurantId: string): Promise<number> {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const agg = await prisma.aiUsageLog.aggregate({
      where: { restaurantId, createdAt: { gte: start } },
      _sum: { totalTokens: true },
    });
    return Number(agg._sum.totalTokens || 0);
  } catch {
    return 0;
  }
}

export async function isWithinDailyBudget(restaurantId: string): Promise<boolean> {
  const used = await getDailyTokenUsage(restaurantId);
  return used < DAILY_TOKEN_BUDGET_PER_RESTAURANT;
}

export async function getUsageSummary(restaurantId: string, period: 'today' | 'week' | 'month' = 'today'): Promise<any> {
  const now = new Date();
  let start = new Date();
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === 'week') start.setDate(start.getDate() - start.getDay());
  else start = new Date(now.getFullYear(), now.getMonth(), 1);
  void now;

  const [byFeature, totals] = await Promise.all([
    prisma.aiUsageLog.groupBy({
      by: ['feature'],
      where: { restaurantId, createdAt: { gte: start } },
      _sum: { totalTokens: true, estimatedCostKes: true },
      _count: { id: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { restaurantId, createdAt: { gte: start } },
      _sum: { totalTokens: true, estimatedCostKes: true },
      _count: { id: true },
    }),
  ]);

  return {
    period,
    requests: Number(totals._count.id || 0),
    totalTokens: Number(totals._sum.totalTokens || 0),
    estimatedCostKes: Number(totals._sum.estimatedCostKes || 0),
    dailyTokenBudget: DAILY_TOKEN_BUDGET_PER_RESTAURANT,
    byFeature: byFeature.map((f) => ({
      feature: f.feature,
      requests: f._count.id,
      tokens: Number(f._sum.totalTokens || 0),
      estimatedCostKes: Number(f._sum.estimatedCostKes || 0),
    })),
  };
}

// ── Caching ──

export function computeMenuFingerprint(menuItems: Array<{ name: string; price: number; isAvailable?: boolean }>): string {
  const parts = menuItems
    .map((i) => `${i.name}:${Math.round(i.price)}:${i.isAvailable !== false}`)
    .sort()
    .join('|');
  let hash = 0;
  for (let i = 0; i < parts.length; i++) {
    hash = (hash << 5) - hash + parts.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export function cacheKeyForChat(restaurantId: string, language: string, message: string, fingerprint: string): string {
  return `${CACHE_PREFIX}${restaurantId}:${fingerprint}:${language}:${message.trim().toLowerCase().slice(0, 300)}`;
}

export async function getCachedReply(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function setCachedReply(key: string, reply: string): Promise<void> {
  try {
    await redis.set(key, reply, 'EX', CACHE_TTL_SECONDS);
  } catch {
    // cache failure never blocks
  }
}

// ── Grounding ──

/**
 * Verifies that every "KES <amount>" the model claimed exists in the menu.
 * Returns true when grounded. Returns false when a mismatch is found —
 * callers must fall back to the rule-based reply.
 */
export function verifyGrounding(reply: string, menuPrices: number[]): boolean {
  const priceSet = new Set(menuPrices.map((p) => Math.round(p)));
  const matches = reply.match(/KES\s*([\d,]+(?:\.\d{1,2})?)/gi) || [];
  for (const match of matches) {
    const amount = parseFloat(match.replace(/[KES\s,]/gi, ''));
    if (!isFinite(amount)) continue;
    // rounded tolerance: the model may quote .00 variants of the same price
    const rounded = Math.round(amount);
    if (!priceSet.has(rounded) && !priceSet.has(rounded - 1) && !priceSet.has(rounded + 1)) {
      logger.warn('AI grounding check failed — price not in menu', { claimed: amount });
      return false;
    }
  }
  return true;
}

export function providerName(): string {
  return config.aiProvider || 'deepseek';
}
