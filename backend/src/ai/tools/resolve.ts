import { prisma } from '@/config/database';
import type { Clarification, ClarificationOption } from './types';

/**
 * Entity resolution for natural-language commands.
 *
 * Rules (quality over convenience):
 *  - exact name/id match → resolved;
 *  - exactly one partial/token match → resolved (the confirmation card shows
 *    the resolved name, so the operator still sees what will happen);
 *  - more than one match → clarification with the candidates;
 *  - no match → clarification; never guess.
 */

export interface NamedCandidate {
  id: string;
  label: string;
  meta?: Record<string, any>;
}

export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MatchResult {
  exact?: NamedCandidate;
  matches: NamedCandidate[];
}

export function matchCandidates(needle: string, candidates: NamedCandidate[]): MatchResult {
  const raw = String(needle ?? '').trim();
  const normalized = normalizeName(raw);
  if (!normalized) return { matches: [] };

  // Direct id match (allows a verified uiContext entityId to be used safely).
  const byId = candidates.find((c) => c.id === raw);
  if (byId) return { exact: byId, matches: [byId] };

  const decorated = candidates.map((c) => ({ candidate: c, norm: normalizeName(c.label) }));
  const exact = decorated.find((d) => d.norm === normalized);
  if (exact) return { exact: exact.candidate, matches: [exact.candidate] };

  const tokens = normalized.split(' ').filter((t) => t.length > 1);
  const matches = decorated
    .filter(({ norm }) => {
      if (norm.includes(normalized) || normalized.includes(norm)) return true;
      return tokens.some((t) => norm.split(' ').includes(t));
    })
    .map((d) => d.candidate);

  return { matches };
}

export function optionsFrom(candidates: NamedCandidate[], limit = 5): ClarificationOption[] {
  return candidates.slice(0, limit).map((c) => ({ id: c.id, label: c.label }));
}

export type SingleResolution =
  | { ok: true; match: NamedCandidate; clarification?: undefined }
  | { ok: false; clarification: Clarification; match?: undefined };

export function resolveSingle(needle: string, candidates: NamedCandidate[], noun: string): SingleResolution {
  const { exact, matches } = matchCandidates(needle, candidates);

  if (exact) return { ok: true, match: exact };
  if (matches.length === 1) return { ok: true, match: matches[0] };
  if (matches.length > 1) {
    return {
      ok: false,
      clarification: {
        question: `I found more than one ${noun} matching "${needle}". Which one did you mean?`,
        options: optionsFrom(matches),
      },
    };
  }
  return {
    ok: false,
    clarification: {
      question: `I couldn't find a ${noun} matching "${needle}". Could you tell me the exact name?`,
      options: optionsFrom(candidates.slice(0, 3)),
    },
  };
}

// ── Candidate loaders (all tenant-scoped) ──

export async function menuItemCandidates(restaurantId: string): Promise<NamedCandidate[]> {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    select: { id: true, name: true, price: true, isAvailable: true, isTodaysSpecial: true },
  });
  return items.map((i) => ({
    id: i.id,
    label: i.name,
    meta: { price: Number(i.price), isAvailable: i.isAvailable, isTodaysSpecial: i.isTodaysSpecial },
  }));
}

export async function inventoryItemCandidates(restaurantId: string): Promise<NamedCandidate[]> {
  const items = await prisma.inventoryItem.findMany({
    where: { restaurantId, isActive: true },
    select: { id: true, name: true, unit: true, reorderLevel: true },
  });
  return items.map((i) => ({
    id: i.id,
    label: i.name,
    meta: { unit: i.unit, reorderLevel: Number(i.reorderLevel) },
  }));
}

export async function staffCandidates(restaurantId: string): Promise<NamedCandidate[]> {
  const staff = await prisma.staff.findMany({
    where: { restaurantId, isActive: true, role: { in: ['WAITER', 'MANAGER'] } },
    select: { id: true, fullName: true, role: true },
  });
  return staff.map((s) => ({ id: s.id, label: s.fullName, meta: { role: s.role } }));
}

export async function tableCandidates(restaurantId: string): Promise<NamedCandidate[]> {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    select: { id: true, tableNumber: true, label: true, status: true, capacity: true },
    orderBy: { tableNumber: 'asc' },
  });
  return tables.map((t) => ({
    id: t.id,
    label: t.label || `Table ${t.tableNumber}`,
    meta: { tableNumber: t.tableNumber, label: t.label, status: t.status, capacity: t.capacity },
  }));
}

export const ACTIVE_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as const;

export async function orderCandidates(restaurantId: string): Promise<NamedCandidate[]> {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: [...ACTIVE_ORDER_STATUSES] } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      tableNumber: true,
      tableId: true,
      waiterId: true,
      customerName: true,
      totalAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return orders.map((o) => ({
    id: o.id,
    label: `${o.orderNumber}${o.tableNumber ? ` · Table ${o.tableNumber}` : ' · Takeaway'}`,
    meta: {
      orderNumber: o.orderNumber,
      status: o.status,
      tableNumber: o.tableNumber,
      tableId: o.tableId,
      waiterId: o.waiterId,
      customerName: o.customerName,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
    },
  }));
}

export type OrderResolution =
  | { ok: true; order: NamedCandidate; clarification?: undefined }
  | { ok: false; clarification: Clarification; order?: undefined };

/**
 * Resolves an order by order number or table reference. Table references are
 * only accepted when they resolve to exactly one active order.
 */
export async function resolveOrder(restaurantId: string, needle: string): Promise<OrderResolution> {
  const orders = await orderCandidates(restaurantId);
  const direct = matchCandidates(needle, orders);

  if (direct.exact) return { ok: true, order: direct.exact };

  const tableMatch = String(needle).match(/(?:table\s*)?(\d+)\s*$/i);
  if (tableMatch) {
    const tableNumber = Number(tableMatch[1]);
    const onTable = orders.filter((o) => o.meta?.tableNumber === tableNumber);
    if (onTable.length === 1) return { ok: true, order: onTable[0] };
    if (onTable.length > 1) {
      return {
        ok: false,
        clarification: {
          question: `There are ${onTable.length} active orders on Table ${tableNumber}. Which order do you mean?`,
          options: optionsFrom(onTable),
        },
      };
    }
  }

  if (direct.matches.length === 1) return { ok: true, order: direct.matches[0] };
  if (direct.matches.length > 1) {
    return {
      ok: false,
      clarification: {
        question: `I found more than one active order matching "${needle}". Which one did you mean?`,
        options: optionsFrom(direct.matches),
      },
    };
  }

  return {
    ok: false,
    clarification: {
      question: `I couldn't find an active order matching "${needle}". Mention the order number or the table.`,
      options: optionsFrom(orders.slice(0, 3)),
    },
  };
}
