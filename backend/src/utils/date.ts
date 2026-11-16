/**
 * Kenya (EAT, UTC+3, no DST) date helpers.
 *
 * Centralised so "today / yesterday / this week / this month / this year"
 * mean the same thing everywhere (analytics, profitability, AI tools,
 * briefings). Server UTC must never define a business day.
 */

const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function kenyaNow(): Date {
  return new Date(Date.now() + KENYA_OFFSET_MS);
}

export function kenyaDayStart(date = new Date()): Date {
  const local = new Date(date.getTime() + KENYA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - KENYA_OFFSET_MS);
}

export function kenyaDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate) };
  }

  const now = new Date();
  const local = new Date(now.getTime() + KENYA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(Date.UTC(y, m, d) - KENYA_OFFSET_MS);
      break;
    case 'week': {
      const dayOfWeek = local.getUTCDay(); // 0 = Sunday
      start = new Date(Date.UTC(y, m, d - dayOfWeek) - KENYA_OFFSET_MS);
      break;
    }
    case 'year':
      start = new Date(Date.UTC(y, 0, 1) - KENYA_OFFSET_MS);
      break;
    case 'month':
    default:
      start = new Date(Date.UTC(y, m, 1) - KENYA_OFFSET_MS);
      break;
  }
  return { start, end: now };
}

export function kenyaDayKey(date = new Date()): string {
  return new Date(date.getTime() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
}
