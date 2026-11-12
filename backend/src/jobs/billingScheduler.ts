import logger from '../utils/logger';
import { runExpirySweep } from '../services/billing.service';

/**
 * In-process billing scheduler.
 *
 * Expiry checks do not need a full job queue and must keep working on
 * deployments without Redis, so this is a plain interval. `runExpirySweep`
 * is idempotent, which keeps repeated runs (and multiple app instances) safe.
 *
 * Set BILLING_SWEEP_ENABLED=false to disable (e.g. when running a dedicated
 * cron worker) and BILLING_SWEEP_INTERVAL_MS to tune the cadence.
 */

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const FIRST_RUN_DELAY_MS = 60 * 1000; // let the server settle first

let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<void> {
  try {
    const result = await runExpirySweep();
    if (result.expiredTrials || result.expiredPlans || result.markedOverdue) {
      logger.info('Billing sweep ran', result);
    }
  } catch (error) {
    logger.error('Billing sweep failed', { error: (error as Error).message });
  }
}

export function startBillingScheduler(): void {
  if (process.env.BILLING_SWEEP_ENABLED === 'false') {
    logger.info('Billing scheduler disabled by BILLING_SWEEP_ENABLED=false');
    return;
  }
  if (timer) return;

  const intervalMs = Number(process.env.BILLING_SWEEP_INTERVAL_MS) || DEFAULT_INTERVAL_MS;

  const firstRun = setTimeout(() => { void sweep(); }, FIRST_RUN_DELAY_MS);
  firstRun.unref?.();

  timer = setInterval(() => { void sweep(); }, intervalMs);
  timer.unref?.();

  logger.info('Billing scheduler started', { intervalMs, firstRunDelayMs: FIRST_RUN_DELAY_MS });
}

export function stopBillingScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
