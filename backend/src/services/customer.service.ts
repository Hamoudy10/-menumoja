import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Customer CRM service.
 *
 * Privacy principles:
 * - only necessary data is stored (name/phone/email as supplied)
 * - marketing consent is explicit (`consentMarketing`), opt-out respected
 *   (`isOptedOut`) — marketing flows must check both
 * - deletion removes the customer row AND anonymizes related order PII
 * - export returns everything stored about a customer
 */

export interface CustomerIdentityInput {
  phone: string;
  name?: string;
  email?: string;
  source?: 'QR' | 'POS' | 'SMS' | 'USSD' | 'MANUAL';
  consentMarketing?: boolean;
}

function normalizePhone(phone: string): string {
  let p = phone.trim().replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('0')) p = `254${p.slice(1)}`;
  return p;
}

/**
 * Finds or creates a customer by phone and records a visit.
 * Deduplicated per (restaurantId, phone). Never throws on race conditions —
 * unique-violation retries once.
 */
export async function upsertCustomer(restaurantId: string, input: CustomerIdentityInput): Promise<any> {
  const phone = normalizePhone(input.phone);
  if (!/^254\d{9}$/.test(phone)) return null;

  const now = new Date();

  const attempt = async () => {
    const existing = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone } },
    });

    if (existing) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: {
          lastVisit: now,
          totalVisits: { increment: 1 },
          name: input.name || existing.name,
          email: input.email || existing.email,
          consentMarketing: input.consentMarketing === true ? true : existing.consentMarketing,
          consentCollectedAt: input.consentMarketing === true && !existing.consentCollectedAt ? now : existing.consentCollectedAt,
        },
      });
    }

    return prisma.customer.create({
      data: {
        restaurantId,
        phone,
        name: input.name || null,
        email: input.email || null,
        source: input.source || 'QR',
        consentMarketing: input.consentMarketing || false,
        consentCollectedAt: input.consentMarketing ? now : null,
        firstVisit: now,
        lastVisit: now,
        totalVisits: 1,
      },
    });
  };

  try {
    return await attempt();
  } catch (error: any) {
    // race: another request created the customer first
    if (error?.code === 'P2002') {
      const existing = await prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId, phone } },
      });
      if (existing) {
        return prisma.customer.update({
          where: { id: existing.id },
          data: {
            lastVisit: now,
            totalVisits: { increment: 1 },
            name: input.name || existing.name,
            email: input.email || existing.email,
          },
        });
      }
    }
    throw error;
  }
}

/**
 * Accrues spend onto a customer (called when a payment is confirmed).
 */
export async function recordCustomerSpend(restaurantId: string, phone: string, amount: number): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { restaurantId_phone: { restaurantId, phone: normalizePhone(phone) } },
  });
  if (!customer || amount <= 0) return;

  const totalSpend = Number(customer.totalSpend) + amount;
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalSpend,
      averageSpend: customer.totalVisits > 0 ? Math.round((totalSpend / customer.totalVisits) * 100) / 100 : totalSpend,
    },
  });
}

export async function getCustomer(restaurantId: string, customerId: string): Promise<any> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
  });
  if (!customer) {
    throw new NotFoundError('Customer not found', 'Mteja hakupatikana');
  }

  // Favourite categories/items derived from order history
  const [orders, itemAgg, menuItems] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, customerPhone: customer.phone, paymentStatus: { in: ['PAID', 'REFUNDED'] } },
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
      where: {
        order: { restaurantId, customerPhone: customer.phone },
      },
      _sum: { quantity: true },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId },
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
  ]);

  const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]));

  // favourite categories by units
  const categoryCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  for (const oi of itemAgg) {
    const mi = menuItemMap.get(String(oi.menuItemId));
    if (!mi) continue;
    const cat = mi.category?.name || 'Other';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + Number(oi._sum.quantity || 0));
    itemCounts.set(mi.name, (itemCounts.get(mi.name) || 0) + Number(oi._sum.quantity || 0));
  }

  const favouriteCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  const favouriteItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

  // preferred channel + segment
  const lunch = orders.filter((o) => { const h = o.createdAt.getHours(); return h >= 11 && h <= 15; }).length;
  const dinner = orders.filter((o) => { const h = o.createdAt.getHours(); return h >= 18 && h <= 22; }).length;
  const weekend = orders.filter((o) => { const d = o.createdAt.getDay(); return d === 5 || d === 6 || d === 0; }).length;

  const segment = classifyCustomer({
    totalSpend: Number(customer.totalSpend),
    totalVisits: customer.totalVisits,
    firstVisit: customer.firstVisit,
    lastVisit: customer.lastVisit,
    lunchShare: orders.length > 0 ? lunch / orders.length : 0,
    dinnerShare: orders.length > 0 ? dinner / orders.length : 0,
    weekendShare: orders.length > 0 ? weekend / orders.length : 0,
    topCategoryShare: favouriteCategories.length > 0 ? (categoryCounts.get(favouriteCategories[0]) || 0) / Math.max(1, [...categoryCounts.values()].reduce((a, b) => a + b, 0)) : 0,
  });

  const recentOrders = orders.slice(0, 5).map((o) => ({
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
    segment,
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

/**
 * Lists customers with search + segment filter.
 */
export async function listCustomers(
  restaurantId: string,
  filters: { search?: string; segment?: string; page: number; perPage: number }
): Promise<{ customers: any[]; total: number; segments: Record<string, number> }> {
  const where: any = { restaurantId };
  if (filters.search) {
    where.OR = [
      { phone: { contains: filters.search } },
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ totalSpend: 'desc' }, { lastVisit: 'desc' }],
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
    }),
    prisma.customer.count({ where }),
  ]);

  const now = Date.now();
  const all = await prisma.customer.findMany({
    where: { restaurantId },
    select: { id: true, totalSpend: true, totalVisits: true, firstVisit: true, lastVisit: true },
  });

  const segments: Record<string, number> = {};
  for (const c of all) {
    const segs = classifyCustomer({
      totalSpend: Number(c.totalSpend),
      totalVisits: c.totalVisits,
      firstVisit: c.firstVisit,
      lastVisit: c.lastVisit,
      lunchShare: 0,
      dinnerShare: 0,
      weekendShare: 0,
      topCategoryShare: 0,
    });
    for (const s of segs) segments[s] = (segments[s] || 0) + 1;
  }

  let result = customers.map((c) => ({ ...c, totalSpend: Number(c.totalSpend), averageSpend: Number(c.averageSpend) }));

  // segment filter applied client-side here (segment is derived)
  if (filters.segment) {
    result = result.filter((c) => {
      const segs = classifyCustomer({
        totalSpend: Number(c.totalSpend),
        totalVisits: c.totalVisits,
        firstVisit: c.firstVisit,
        lastVisit: c.lastVisit,
        lunchShare: 0,
        dinnerShare: 0,
        weekendShare: 0,
        topCategoryShare: 0,
      });
      return segs.includes(filters.segment as string);
    });
  }

  return { customers: result, total, segments };
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

  const orders = await prisma.order.findMany({
    where: { restaurantId, customerPhone: customer.phone },
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
  });

  return {
    customer: {
      ...customer,
      totalSpend: Number(customer.totalSpend),
      averageSpend: Number(customer.averageSpend),
    },
    orders: orders.map((o) => ({ ...o, totalAmount: Number(o.totalAmount) })),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Privacy deletion — removes the customer and anonymizes related order PII.
 */
export async function deleteCustomer(restaurantId: string, customerId: string): Promise<void> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found', 'Mteja hakupatikana');

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { restaurantId, customerPhone: customer.phone },
      data: { customerName: null, customerPhone: null },
    });
    await tx.payment.updateMany({
      where: { restaurantId, mpesaPhone: customer.phone },
      data: { mpesaPhone: null },
    });
    await tx.customer.delete({ where: { id: customerId } });
  });

  logger.info('Customer deleted (privacy)', { restaurantId, customerId });
}

export default {
  upsertCustomer,
  recordCustomerSpend,
  getCustomer,
  classifyCustomer,
  listCustomers,
  updateCustomer,
  exportCustomer,
  deleteCustomer,
};
