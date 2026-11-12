import logger from '../utils/logger';
import { runProactiveChecks } from '../services/proactive.service';

/**
 * In-process scheduler for deterministic proactive alerts (Phase C).
 *
 * No Redis/BullMQ dependency: the checks are cheap SQL and must keep working
 * on any deployment. Detectors are idempotent within their dedupe windows, so
 * repeated runs (and multiple instances) are safe.
 *
 * Env:
 *  - PROACTIVE_ALERTS_ENABLED=false  → disable
 *  - PROACTIVE_INTERVAL_MS           → default 5 minutes
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 90 * 1000;

let timer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  try {
    const result = await runProactiveChecks();
    const total =
      result.lowStock + result.waitingOrders + result.expiringSubscriptions + result.dailyBriefings;
    if (total > 0) logger.info('Proactive scheduler tick', result);
  } catch (error) {
    logger.error('Proactive scheduler tick failed', { error: (error as Error).message });
  }
}

export function startProactiveScheduler(): void {
  if (process.env.PROACTIVE_ALERTS_ENABLED === 'false') {
    logger.info('Proactive alerts disabled by PROACTIVE_ALERTS_ENABLED=false');
    return;
  }
  if (timer) return;

  const intervalMs = Number(process.env.PROACTIVE_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  const firstRun = setTimeout(() => { void tick(); }, FIRST_RUN_DELAY_MS);
  firstRun.unref?.();

  timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref?.();

  logger.info('Proactive alerts scheduler started', { intervalMs, firstRunDelayMs: FIRST_RUN_DELAY_MS });
}

export function stopProactiveScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
