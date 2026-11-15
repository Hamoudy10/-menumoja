import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';
import { normalizeKenyanPhone, phoneQueryVariants } from '@/utils/phone';

/**
 * Customer CRM service.
 *
 * Identity rules:
 * - phones are stored in the canonical Kenyan form (`2547XXXXXXXX`); legacy
 *   rows are still found through `phoneQueryVariants`
 * - a "visit" is an actual on-premise interaction (order, reservation
 *   check-in, waitlist seating). Bookings and payments only touch `lastVisit`.
 * - visits are counted at most once per Kenya calendar day so split orders do
 *   not inflate loyalty/segments.
 *
 * Privacy principles:
 * - only necessary data is stored (name/phone/email as supplied)
 * - marketing consent is explicit (`consentMarketing`), opt-out respected
 *   (`isOptedOut`) — marketing flows must check both
 * - deletion removes the customer row AND anonymizes related PII across
 *   orders, payments, reservations, waitlist and campaign records
 * - export returns everything stored about a customer
 */

export interface CustomerIdentityInput {
  phone: string;
  name?: string;
  email?: string;
  source?: 'QR' | 'POS' | 'SMS' | 'USSD' | 'MANUAL';
  consentMarketing?: boolean;
}

export interface UpsertCustomerOptions {
  /**
   * Count this interaction as a visit. Deduplicated per Kenya calendar day.
   * Use true for order creation / reservation check-in / waitlist seating.
   */
  countVisit?: boolean;
}

const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000; // EAT, no DST
const BEHAVIOUR_WINDOW_DAYS = 180;
const BEHAVIOUR_ORDER_LIMIT = 5000;
const BEHAVIOUR_CACHE_TTL_MS = process.env.NODE_ENV === 'test' ? 0 : 60_000;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function averageSpend(totalSpend: number, totalVisits: number): number {
  return totalVisits > 0 ? roundMoney(totalSpend / totalVisits) : roundMoney(totalSpend);
}

function kenyaDayKey(date: Date): string {
  return new Date(date.getTime() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Finds a customer by phone using canonical + legacy representations.
 */
export async function findCustomerByPhone(restaurantId: string, phone: string): Promise<any | null> {
  const normalized = normalizeKenyanPhone(phone);
  if (normalized) {
    const exact = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone: normalized } },
    });
    if (exact) return exact;
  }

  const variants = phoneQueryVariants(phone);
  if (variants.length === 0) return null;

  return prisma.customer.findFirst({
    where: { restaurantId, phone: { in: variants } },
  });
}

/**
 * Finds or creates a customer by phone. Deduplicated per (restaurantId, phone).
 * Never throws on race conditions — unique-violation retries once.
 */
export async function upsertCustomer(
  restaurantId: string,
  input: CustomerIdentityInput,
  options: UpsertCustomerOptions = {}
): Promise<any | null> {
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) {
    logger.warn('Skipping customer upsert: invalid Kenyan phone', {
      restaurantId,
      source: input.source || 'QR',
    });
    return null;
  }

  const now = new Date();
  const countVisit = options.countVisit === true;
  const todayKey = kenyaDayKey(now);
  const name = input.name?.trim() || undefined;
  const email = input.email?.trim() || undefined;

  const updateExisting = async (existing: any) => {
    const data: any = {
      lastVisit: now,
      name: name || existing.name,
      email: email || existing.email,
    };

    const lastCounted = existing.lastVisitCountedAt ? new Date(existing.lastVisitCountedAt) : null;
    if (countVisit && (!lastCounted || kenyaDayKey(lastCounted) !== todayKey)) {
      data.totalVisits = { increment: 1 };
      data.lastVisitCountedAt = now;
      data.firstVisit = existing.firstVisit || now;
    }

    if (input.consentMarketing === true && !existing.consentMarketing) {
      data.consentMarketing = true;
      data.consentCollectedAt = existing.consentCollectedAt || now;
    }

    return prisma.customer.update({ where: { id: existing.id }, data });
  };

  const attempt = async () => {
    const existing = await prisma.customer.findFirst({
      where: { restaurantId, phone: { in: phoneQueryVariants(phone) } },
    });
    if (existing) return updateExisting(existing);

    return prisma.customer.create({
      data: {
        restaurantId,
        phone,
        name: name || null,
        email: email || null,
        source: input.source || 'QR',
        consentMarketing: input.consentMarketing === true,
        consentCollectedAt: input.consentMarketing === true ? now : null,
        firstVisit: now,
        lastVisit: now,
        totalVisits: countVisit ? 1 : 0,
        lastVisitCountedAt: countVisit ? now : null,
      },
    });
  };

  try {
    return await attempt();
  } catch (error: any) {
    // race: another request created the customer first
    if (error?.code === 'P2002') {
      const existing = await prisma.customer.findFirst({
        where: { restaurantId, phone: { in: phoneQueryVariants(phone) } },
      });
      if (existing) return updateExisting(existing);
    }
    throw error;
  }
}

/**
 * Accrues spend onto a customer (called when a payment is confirmed).
 * Payments are idempotent at the route level, so this only applies the delta.
 */
export async function recordCustomerSpend(restaurantId: string, phone: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const customer = await findCustomerByPhone(restaurantId, phone);
  if (!customer) return;

  const totalSpend = roundMoney(Number(customer.totalSpend) + amount);
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalSpend,
      averageSpend: averageSpend(totalSpend, customer.totalVisits),
    },
  });
  invalidateBehaviourCache(restaurantId);
}

/**
 * Reverses spend when a payment is refunded or a paid order is cancelled.
 * Never lets spend go below zero.
 */
export async function reverseCustomerSpend(restaurantId: string, phone: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const customer = await findCustomerByPhone(restaurantId, phone);
  if (!customer) return;

  const totalSpend = roundMoney(Math.max(0, Number(customer.totalSpend) - amount));
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalSpend,
      averageSpend: averageSpend(totalSpend, customer.totalVisits),
    },
  });
  invalidateBehaviourCache(restaurantId);
  logger.info('Customer spend reversed', { restaurantId, customerId: customer.id, amount });
}

export async function getCustomer(restaurantId: string, customerId: string): Promise<any> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });
  if (!customer) {
    throw new NotFoundError('Customer not found', 'Mteja hakupatikana');
  }

  const phoneVariants = phoneQueryVariants(customer.phone);
  const orderWhere: any = {
    restaurantId,
    customerPhone: { in: phoneVariants },
    paymentStatus: { in: ['PAID', 'REFUNDED'] },
  };

  // Favourite categories/items derived from order history
  const [orders, itemAgg, menuItems] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        items: { select: { itemName: true, quantity: true, menuItem: { select: { category: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: orderWhere } as any,
      _sum: { quantity: true },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
  ]);

  const menuItemMap = new Map<string, any>(((menuItems as any[]) || []).map((mi) => [mi.id, mi]));

  // favourite categories by units
  const categoryCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  for (const oi of itemAgg || []) {
    const mi = menuItemMap.get(String(oi.menuItemId));
    if (!mi) continue;
    const cat = mi.category?.name || 'Other';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + Number(oi._sum.quantity || 0));
    itemCounts.set(mi.name, (itemCounts.get(mi.name) || 0) + Number(oi._sum.quantity || 0));
  }

  const favouriteCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  const favouriteItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

  const orderList = orders || [];

  // preferred channel + segment
  const lunch = orderList.filter((o) => { const h = toKenyaDate(o.createdAt).getUTCHours(); return h >= 11 && h <= 15; }).length;
  const dinner = orderList.filter((o) => { const h = toKenyaDate(o.createdAt).getUTCHours(); return h >= 18 && h <= 22; }).length;
  const weekend = orderList.filter((o) => { const d = toKenyaDate(o.createdAt).getUTCDay(); return d === 5 || d === 6 || d === 0; }).length;
  const totalUnits = [...categoryCounts.values()].reduce((a, b) => a + b, 0);

  const segments = classifyCustomer({
    totalSpend: Number(customer.totalSpend),
    totalVisits: customer.totalVisits,
    firstVisit: customer.firstVisit,
    lastVisit: customer.lastVisit,
    lunchShare: orderList.length > 0 ? lunch / orderList.length : 0,
    dinnerShare: orderList.length > 0 ? dinner / orderList.length : 0,
    weekendShare: orderList.length > 0 ? weekend / orderList.length : 0,
    topCategoryShare: favouriteCategories.length > 0 ? (categoryCounts.get(favouriteCategories[0]) || 0) / Math.max(1, totalUnits) : 0,
  });

  const recentOrders = orderList.slice(0, 5).map((o) => ({
    id: o.id,
    createdAt: o.createdAt,
    totalAmount: Number(o.totalAmount),
    itemNames: o.items.slice(0, 3).map((i) => i.itemName),
  }));

  return {
    ...customer,
    totalSpend: Number(customer.totalSpend),
    averageSpend: Number(customer.averageSpend),
    favouriteCategories,
    favouriteItems,
    segment: segments,
    segments,
    recentOrders,
  };
}

export interface SegmentInput {
  totalSpend: number;
  totalVisits: number;
  firstVisit: Date;
  lastVisit: Date;
  lunchShare: number;
  dinnerShare: number;
  weekendShare: number;
  topCategoryShare: number;
}

/**
 * Multi-label segmentation. A customer can belong to several segments.
 */
export function classifyCustomer(c: SegmentInput): string[] {
  const segments: string[] = [];
  const now = new Date();
  const daysSinceFirst = Math.floor((now.getTime() - c.firstVisit.getTime()) / 86400000);
  const daysSinceLast = Math.floor((now.getTime() - c.lastVisit.getTime()) / 86400000);

  if (c.totalSpend >= 20000 && c.totalVisits >= 5) segments.push('VIP');
  if (c.totalVisits >= 5) segments.push('Frequent');
  if (daysSinceFirst <= 30) segments.push('New');
  if (daysSinceLast > 90) segments.push('Dormant');
  if (c.totalSpend >= 10000) segments.push('High spender');
  if (c.lunchShare >= 0.5) segments.push('Lunch customer');
  if (c.dinnerShare >= 0.5) segments.push('Dinner customer');
  if (c.weekendShare >= 0.5) segments.push('Weekend customer');
  if (c.topCategoryShare >= 0.5) segments.push('Category-loyal');

  return segments;
}

interface BehaviourStats {
  orderCount: number;
  lunchOrders: number;
  dinnerOrders: number;
  weekendOrders: number;
  categoryUnits: Map<string, number>;
  totalUnits: number;
  topCategoryUnits: number;
}

interface BehaviourCacheEntry {
  at: number;
  stats: Map<string, BehaviourStats>;
}

const behaviourCache = new Map<string, BehaviourCacheEntry>();

function invalidateBehaviourCache(restaurantId: string): void {
  behaviourCache.delete(restaurantId);
}

function toKenyaDate(value: Date | string): Date {
  return new Date(new Date(value).getTime() + KENYA_OFFSET_MS);
}

function emptyBehaviour(): BehaviourStats {
  return {
    orderCount: 0,
    lunchOrders: 0,
    dinnerOrders: 0,
    weekendOrders: 0,
    categoryUnits: new Map(),
    totalUnits: 0,
    topCategoryUnits: 0,
  };
}

/**
 * Aggregates recent paid/non-cancelled orders per customer so time-of-day and
 * category segments can be evaluated for the whole customer base (not just the
 * current page). Bounded by window + row limit to keep CRM reads predictable.
 */
async function loadBehaviourStats(restaurantId: string): Promise<Map<string, BehaviourStats>> {
  const cached = behaviourCache.get(restaurantId);
  if (BEHAVIOUR_CACHE_TTL_MS > 0 && cached && Date.now() - cached.at < BEHAVIOUR_CACHE_TTL_MS) {
    return cached.stats;
  }

  const stats = new Map<string, BehaviourStats>();
  const since = new Date(Date.now() - BEHAVIOUR_WINDOW_DAYS * 86400000);

  const orders = (await prisma.order.findMany({
    where: {
      restaurantId,
      customerPhone: { not: null },
      createdAt: { gte: since },
      status: { not: 'CANCELLED' },
      paymentStatus: { in: ['PAID', 'REFUNDED'] },
    },
    select: {
      customerPhone: true,
      createdAt: true,
      items: { select: { menuItemId: true, quantity: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: BEHAVIOUR_ORDER_LIMIT,
  })) || [];

  if (orders.length === 0) {
    behaviourCache.set(restaurantId, { at: Date.now(), stats });
    return stats;
  }

  const menuItemIds = [...new Set(
    orders
      .flatMap((o) => o.items || [])
      .map((i) => i.menuItemId)
      .filter((id): id is string => !!id)
  )];

  const menuItems = menuItemIds.length > 0
    ? (await prisma.menuItem.findMany({
        where: { restaurantId, id: { in: menuItemIds } },
        select: { id: true, category: { select: { name: true } } },
      })) || []
    : [];

  const categoryByItem = new Map(menuItems.map((m) => [m.id, m.category?.name || 'Other']));

  for (const order of orders) {
    const phone = normalizeKenyanPhone(order.customerPhone);
    if (!phone) continue;

    const local = toKenyaDate(order.createdAt);
    const hour = local.getUTCHours();
    const weekday = local.getUTCDay();

    let entry = stats.get(phone);
    if (!entry) {
      entry = emptyBehaviour();
      stats.set(phone, entry);
    }

    entry.orderCount += 1;
    if (hour >= 11 && hour <= 15) entry.lunchOrders += 1;
    if (hour >= 18 && hour <= 22) entry.dinnerOrders += 1;
    if (weekday === 5 || weekday === 6 || weekday === 0) entry.weekendOrders += 1;

    for (const item of order.items || []) {
      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) continue;
      const category = (item.menuItemId && categoryByItem.get(item.menuItemId)) || 'Other';
      entry.categoryUnits.set(category, (entry.categoryUnits.get(category) || 0) + quantity);
      entry.totalUnits += quantity;
    }
  }

  for (const entry of stats.values()) {
    entry.topCategoryUnits = Math.max(0, ...entry.categoryUnits.values());
  }

  behaviourCache.set(restaurantId, { at: Date.now(), stats });
  return stats;
}

export interface CustomerSegmentRow {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  totalSpend: number;
  averageSpend: number;
  totalVisits: number;
  firstVisit: Date;
  lastVisit: Date;
  consentMarketing: boolean;
  isOptedOut: boolean;
  preferredChannel: string | null;
  segments: string[];
  [key: string]: any;
}

export interface CustomerSegmentSnapshot {
  customers: CustomerSegmentRow[];
  segments: Record<string, number>;
}

/**
 * Fresh customer rows + derived segments for the whole restaurant.
 * Order behaviour is cached briefly; customer rows are always read live so
 * consent changes are never served from cache.
 */
export async function getCustomerSegmentSnapshot(restaurantId: string): Promise<CustomerSegmentSnapshot> {
  const [customersRaw, behaviour] = await Promise.all([
    prisma.customer.findMany({
      where: { restaurantId },
      orderBy: [{ totalSpend: 'desc' }, { lastVisit: 'desc' }],
    }),
    loadBehaviourStats(restaurantId),
  ]);

  const customers: CustomerSegmentRow[] = ((customersRaw as any[]) || []).map((customer) => {
    const phone = normalizeKenyanPhone(customer.phone);
    const stats = phone ? behaviour.get(phone) : undefined;
    const orderCount = stats?.orderCount || 0;

    const segments = classifyCustomer({
      totalSpend: Number(customer.totalSpend),
      totalVisits: customer.totalVisits,
      firstVisit: customer.firstVisit,
      lastVisit: customer.lastVisit,
      lunchShare: orderCount > 0 ? (stats?.lunchOrders || 0) / orderCount : 0,
      dinnerShare: orderCount > 0 ? (stats?.dinnerOrders || 0) / orderCount : 0,
      weekendShare: orderCount > 0 ? (stats?.weekendOrders || 0) / orderCount : 0,
      topCategoryShare: stats && stats.totalUnits > 0 ? stats.topCategoryUnits / stats.totalUnits : 0,
    });

    return {
      ...customer,
      totalSpend: Number(customer.totalSpend),
      averageSpend: Number(customer.averageSpend),
      segments,
    };
  });

  const segments: Record<string, number> = {};
  for (const customer of customers) {
    for (const segment of customer.segments) {
      segments[segment] = (segments[segment] || 0) + 1;
    }
  }

  return { customers, segments };
}

/**
 * Lists customers with search + segment filter across the *whole* matched
 * dataset (never only the current page).
 */
export async function listCustomers(
  restaurantId: string,
  filters: { search?: string; segment?: string; page: number; perPage: number }
): Promise<{ customers: any[]; total: number; segments: Record<string, number> }> {
  const snapshot = await getCustomerSegmentSnapshot(restaurantId);

  const search = filters.search?.trim().toLowerCase();
  const searchDigits = (filters.search || '').replace(/\D/g, '');
  const searchPhone = normalizeKenyanPhone(filters.search || '');

  const phoneSearchCandidates = new Set<string>();
  if (searchDigits) {
    phoneSearchCandidates.add(searchDigits);
    if (searchDigits.startsWith('0')) phoneSearchCandidates.add(`254${searchDigits.slice(1)}`);
    if (searchDigits.startsWith('254')) phoneSearchCandidates.add(`0${searchDigits.slice(3)}`);
  }
  if (searchPhone) {
    const subscriber = searchPhone.slice(3);
    phoneSearchCandidates.add(searchPhone);
    phoneSearchCandidates.add(subscriber);
    phoneSearchCandidates.add(`0${subscriber}`);
  }

  let rows = snapshot.customers;

  if (search) {
    rows = rows.filter((customer) => {
      const name = (customer.name || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phoneDigits = String(customer.phone || '').replace(/\D/g, '');
      return (
        name.includes(search) ||
        email.includes(search) ||
        [...phoneSearchCandidates].some((candidate) => phoneDigits.includes(candidate))
      );
    });
  }

  if (filters.segment) {
    const target = filters.segment.trim().toLowerCase();
    rows = rows.filter((customer) => customer.segments.some((segment) => segment.toLowerCase() === target));
  }

  const total = rows.length;
  const skip = (filters.page - 1) * filters.perPage;
  const customers = rows.slice(skip, skip + filters.perPage);

  return { customers, total, segments: snapshot.segments };
}

/**
 * Updates a customer's profile/consent.
 */
export async function updateCustomer(restaurantId: string, customerId: string, data: any): Promise<any> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found', 'Mteja hakupatikana');

  const update: any = {};
  if (data.name !== undefined) update.name = data.name || null;
  if (data.email !== undefined) update.email = data.email || null;
  if (data.notes !== undefined) update.notes = data.notes || null;
  if (data.preferredChannel !== undefined) update.preferredChannel = data.preferredChannel || null;
  if (data.consentMarketing !== undefined) {
    update.consentMarketing = data.consentMarketing;
    update.consentCollectedAt = data.consentMarketing ? (customer.consentCollectedAt || new Date()) : null;
  }
  if (data.isOptedOut !== undefined) update.isOptedOut = data.isOptedOut;

  return prisma.customer.update({ where: { id: customerId }, data: update });
}

/**
 * Privacy export — everything stored about a customer.
 */
export async function exportCustomer(restaurantId: string, customerId: string): Promise<any> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found', 'Mteja hakupatikana');

  const phoneVariants = phoneQueryVariants(customer.phone);

  const orders = (await prisma.order.findMany({
    where: { restaurantId, customerPhone: { in: phoneVariants } },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalAmount: true,
      status: true,
      paymentStatus: true,
      items: { select: { itemName: true, quantity: true, itemPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  })) || [];

  const orderIds = orders.map((o) => o.id);

  const [payments, reservations, waitlist, loyaltyAccount, campaignDeliveries, campaignEvents] = await Promise.all([
    prisma.payment.findMany({
      where: {
        restaurantId,
        OR: [
          { mpesaPhone: { in: phoneVariants } },
          { orderId: { in: orderIds } },
        ],
      },
      select: {
        id: true,
        orderId: true,
        paymentMethod: true,
        amount: true,
        currency: true,
        status: true,
        mpesaPhone: true,
        mpesaReceiptNumber: true,
        processedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        OR: [{ customerId: customer.id }, { customerPhone: { in: phoneVariants } }],
      },
      orderBy: { reservedAt: 'desc' },
    }),
    prisma.waitlistEntry.findMany({
      where: {
        restaurantId,
        OR: [{ customerId: customer.id }, { customerPhone: { in: phoneVariants } }],
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.loyaltyAccount.findFirst({
      where: { customerId: customer.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' } },
        rewards: { orderBy: { issuedAt: 'desc' } },
      },
    }),
    prisma.campaignDelivery.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } }),
    prisma.campaignEvent.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    customer: {
      ...customer,
      totalSpend: Number(customer.totalSpend),
      averageSpend: Number(customer.averageSpend),
    },
    orders: (orders as any[]).map((o) => ({ ...o, totalAmount: Number(o.totalAmount) })),
    payments: ((payments as any[]) || []).map((p) => ({ ...p, amount: Number(p.amount) })),
    reservations: reservations || [],
    waitlist: waitlist || [],
    loyalty: loyaltyAccount
      ? {
          account: {
            id: loyaltyAccount.id,
            pointsBalance: loyaltyAccount.pointsBalance,
            totalEarned: loyaltyAccount.totalEarned,
            totalRedeemed: loyaltyAccount.totalRedeemed,
            createdAt: loyaltyAccount.createdAt,
          },
          transactions: loyaltyAccount.transactions || [],
          rewards: loyaltyAccount.rewards || [],
        }
      : null,
    campaigns: {
      deliveries: campaignDeliveries || [],
      events: campaignEvents || [],
    },
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Privacy deletion — removes the customer and anonymizes related PII across
 * every table that stores a name or phone for them.
 */
export async function deleteCustomer(restaurantId: string, customerId: string): Promise<void> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found', 'Mteja hakupatikana');

  const phoneVariants = phoneQueryVariants(customer.phone);
  const redactedPhone = '0000000000';
  const redactedName = 'Deleted customer';

  await prisma.$transaction(async (tx) => {
    // Capture order ids before orders are anonymized, so payments can still be
    // tied back to this customer's orders.
    const orders = (await tx.order.findMany({
      where: { restaurantId, customerPhone: { in: phoneVariants } },
      select: { id: true },
    })) || [];
    const orderIds = orders.map((o) => o.id);

    await tx.payment.updateMany({
      where: {
        restaurantId,
        OR: [
          { mpesaPhone: { in: phoneVariants } },
          ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
        ],
      },
      data: { mpesaPhone: null },
    });

    await tx.order.updateMany({
      where: { restaurantId, customerPhone: { in: phoneVariants } },
      data: { customerName: null, customerPhone: null },
    });

    await tx.reservation.updateMany({
      where: {
        restaurantId,
        OR: [{ customerId: customer.id }, { customerPhone: { in: phoneVariants } }],
      },
      data: { customerId: null, customerName: redactedName, customerPhone: redactedPhone, notes: null },
    });

    await tx.waitlistEntry.updateMany({
      where: {
        restaurantId,
        OR: [{ customerId: customer.id }, { customerPhone: { in: phoneVariants } }],
      },
      data: { customerId: null, customerName: redactedName, customerPhone: redactedPhone },
    });

    await tx.campaignDelivery.updateMany({
      where: { customerId: customer.id },
      data: { customerId: null, phone: redactedPhone },
    });

    await tx.campaignEvent.updateMany({
      where: { customerId: customer.id },
      data: { customerId: null },
    });

    // Loyalty account + ledger cascade with the customer row.
    await tx.customer.delete({ where: { id: customerId } });
  });

  invalidateBehaviourCache(restaurantId);
  logger.info('Customer deleted (privacy)', { restaurantId, customerId });
}

export default {
  upsertCustomer,
  findCustomerByPhone,
  recordCustomerSpend,
  reverseCustomerSpend,
  getCustomer,
  classifyCustomer,
  getCustomerSegmentSnapshot,
  listCustomers,
  updateCustomer,
  exportCustomer,
  deleteCustomer,
};
