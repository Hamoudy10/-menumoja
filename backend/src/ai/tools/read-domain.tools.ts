import { z } from 'zod';
import { prisma } from '@/config/database';
import { listCustomers } from '@/services/customer.service';
import { getSubscriptionSummary } from '@/services/subscription.service';
import type { Tool } from './types';

/**
 * Phase E1 — domain read tools.
 *
 * These extend Jarvis from "operations snapshot" to whole-system knowledge:
 * payments, order history, customers, recipes/costing, reservations,
 * promotions, QR analytics, billing, staff shifts and non-secret settings.
 *
 * Every query is tenant-scoped through ctx.restaurantId. Read-only by design.
 */

const periodSchema = z.enum(['today', 'week', 'month']);

function rangeFor(period: 'today' | 'week' | 'month'): { start: Date; end: Date } {
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
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end };
}

const money = (value: unknown) => `KES ${Number(value || 0).toLocaleString()}`;

export const domainReadTools: Tool[] = [
  {
    key: 'get_payments_summary',
    label: 'Payments summary',
    description: 'Read-only: payment totals by method (M-Pesa/cash/card), payment count and the latest payments for a period. Use for "how much did we collect?", "cash vs M-Pesa?", "recent payments".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ period: periodSchema.default('today') }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['today', 'week', 'month'] } },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: `Payments for ${String(args.period || 'today')}` } }),
    summarize: (data) => {
      const methods = (Array.isArray(data?.byMethod) ? data.byMethod : [])
        .map((row: any) => `${row.method}: ${money(row.amount)}`)
        .join(' · ');
      return `**Payments (${data?.period || 'today'})**: ${money(data?.total)} across ${Number(data?.count || 0)} payment(s)${methods ? ` — ${methods}` : ''}.`;
    },
    run: async (ctx, args) => {
      const period = (args.period as any) || 'today';
      const { start, end } = rangeFor(period);
      const where: any = { restaurantId: ctx.restaurantId, status: 'PAID', createdAt: { gte: start, lte: end } };

      const [aggregate, byMethod, recent] = await Promise.all([
        prisma.payment.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
        prisma.payment.groupBy({ by: ['paymentMethod'], where, _sum: { amount: true }, _count: { id: true } }),
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            createdAt: true,
            mpesaReceiptNumber: true,
            order: { select: { orderNumber: true } },
          },
        }),
      ]);

      return {
        data: {
          period,
          total: Number(aggregate._sum.amount || 0),
          count: aggregate._count.id,
          byMethod: byMethod.map((row) => ({
            method: row.paymentMethod,
            amount: Number(row._sum.amount || 0),
            count: row._count.id,
          })),
          recent: recent.map((payment) => ({
            orderNumber: payment.order?.orderNumber || null,
            amount: Number(payment.amount),
            method: payment.paymentMethod,
            reference: payment.mpesaReceiptNumber || null,
            at: payment.createdAt,
          })),
        },
      };
    },
  },

  {
    key: 'get_order_history',
    label: 'Order history',
    description: 'Read-only: search past orders by period (today/week/month/all), status, order number, customer name/phone or table. Use for "show yesterday\'s orders", "find order ORD-...", "how many cancelled orders?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      period: z.enum(['today', 'week', 'month', 'all']).default('week'),
      status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']).optional(),
      search: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'all'] },
        status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] },
        search: { type: 'string', description: 'Order number, customer name or phone' },
        limit: { type: 'number', description: '1-50, default 20' },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: `Order history (${String(args.period || 'week')})` } }),
    summarize: (data) => `Found **${Number(data?.total || 0)}** order(s) for ${String(data?.period || 'the selected period')}.`,
    run: async (ctx, args) => {
      const period = String(args.period || 'week');
      const where: any = { restaurantId: ctx.restaurantId };
      if (period !== 'all') {
        const { start, end } = rangeFor(period as any);
        where.createdAt = { gte: start, lte: end };
      }
      if (args.status) where.status = String(args.status).toUpperCase();
      if (args.search) {
        const search = String(args.search);
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search } },
        ];
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(args.limit || 20),
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            tableNumber: true,
            customerName: true,
            customerPhone: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
        }),
        prisma.order.count({ where }),
      ]);

      return {
        data: {
          period,
          total,
          orders: orders.map((order) => ({
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: Number(order.totalAmount),
            table: order.tableNumber ? `Table ${order.tableNumber}` : 'Takeaway',
            customer: order.customerName || null,
            items: order._count?.items ?? 0,
            at: order.createdAt,
          })),
        },
      };
    },
  },

  {
    key: 'get_customers',
    label: 'Customers / CRM',
    description: 'Read-only: list/search customers with spend, visits, last visit and segments (VIP, Frequent, New, Dormant, etc.). Use for "top customers", "how many VIPs?", "find customer X".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      search: z.string().max(100).optional(),
      segment: z.string().max(40).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Name, phone or email' },
        segment: { type: 'string', description: 'Optional segment, e.g. VIP, Frequent, New, Dormant' },
        limit: { type: 'number', description: '1-50, default 10' },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Customer list' } }),
    summarize: (data) => {
      const segments = data?.segments && typeof data.segments === 'object'
        ? Object.entries(data.segments).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${name}: ${count}`).join(' · ')
        : '';
      return `You have **${Number(data?.total || 0)}** customer(s)${segments ? ` — ${segments}` : ''}.`;
    },
    run: async (ctx, args) => {
      const result = await listCustomers(ctx.restaurantId, {
        search: args.search ? String(args.search) : undefined,
        segment: args.segment ? String(args.segment) : undefined,
        page: 1,
        perPage: Number(args.limit || 10),
      });

      return {
        data: {
          total: result.total,
          segments: result.segments,
          customers: result.customers.map((customer: any) => ({
            name: customer.name || 'Unnamed',
            phone: customer.phone,
            totalSpend: Number(customer.totalSpend || 0),
            visits: Number(customer.totalVisits || 0),
            lastVisit: customer.lastVisit,
            consentMarketing: customer.consentMarketing,
          })),
        },
      };
    },
  },

  {
    key: 'get_recipe_costs',
    label: 'Recipe costs & margins',
    description: 'Read-only: costed recipes with cost, selling price and margin percentage. Use for "what are our margins?", "which dish is most profitable?", "food cost of X".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      search: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Menu item name filter' },
        limit: { type: 'number', description: '1-50, default 20' },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Recipe costs and margins' } }),
    summarize: (data) => {
      const top = Array.isArray(data?.recipes) ? data.recipes[0] : null;
      return `Costed **${Number(data?.total || 0)}** recipe(s)${top ? `; highest margin: **${top.item}** at **${top.marginPct}%**.` : '.'}`;
    },
    run: async (ctx, args) => {
      const recipes = await prisma.recipe.findMany({
        where: { restaurantId: ctx.restaurantId, isActive: true },
        take: 100,
        orderBy: { updatedAt: 'desc' },
        include: {
          menuItem: { select: { id: true, name: true, price: true, isAvailable: true } },
          ingredients: { select: { quantity: true, unitCostSnapshot: true } },
        },
      });

      const search = args.search ? String(args.search).toLowerCase() : '';
      const rows = recipes
        .filter((recipe) => !search || recipe.menuItem?.name?.toLowerCase().includes(search))
        .map((recipe) => {
          const price = Number(recipe.menuItem?.price || 0);
          const cost = recipe.ingredients.reduce(
            (sum, ingredient) => sum + Number(ingredient.quantity) * Number(ingredient.unitCostSnapshot),
            0
          );
          const marginPct = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0;
          return {
            item: recipe.menuItem?.name || 'Unknown',
            price,
            cost: Math.round(cost * 100) / 100,
            marginPct,
            ingredients: recipe.ingredients.length,
            available: recipe.menuItem?.isAvailable ?? true,
          };
        })
        .sort((a, b) => b.marginPct - a.marginPct)
        .slice(0, Number(args.limit || 20));

      return { data: { total: rows.length, recipes: rows } };
    },
  },

  {
    key: 'get_reservations',
    label: 'Reservations',
    description: 'Read-only: reservations for a period with party size, time, status and table. Use for "reservations today", "who is coming tonight?", "upcoming bookings".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      period: periodSchema.default('today'),
      status: z.enum(['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED']).optional(),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'] },
        status: { type: 'string', enum: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: `Reservations for ${String(args.period || 'today')}` } }),
    summarize: (data) => `There are **${Number(data?.total || 0)}** reservation(s) for ${String(data?.period || 'today')}.`,
    run: async (ctx, args) => {
      const period = (args.period as any) || 'today';
      const { start, end } = rangeFor(period);
      const where: any = { restaurantId: ctx.restaurantId, reservedAt: { gte: start, lte: end } };
      if (args.status) where.status = String(args.status);

      const reservations = await prisma.reservation.findMany({
        where,
        orderBy: { reservedAt: 'asc' },
        take: 50,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          partySize: true,
          reservedAt: true,
          status: true,
          notes: true,
          table: { select: { tableNumber: true, label: true } },
        },
      });

      return {
        data: {
          period,
          total: reservations.length,
          reservations: reservations.map((reservation) => ({
            name: reservation.customerName,
            phone: reservation.customerPhone,
            partySize: reservation.partySize,
            at: reservation.reservedAt,
            status: reservation.status,
            table: reservation.table?.label || (reservation.table?.tableNumber ? `Table ${reservation.table.tableNumber}` : null),
            notes: reservation.notes,
          })),
        },
      };
    },
  },

  {
    key: 'get_promotions',
    label: 'Promotions',
    description: 'Read-only: active and scheduled promotions (special, offer, event, giveaway) with linked item and dates. Use for "what promotions are running?", "any specials today?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ activeOnly: z.boolean().default(true) }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { activeOnly: { type: 'boolean', description: 'Only currently active promotions (default true)' } },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: args.activeOnly === false ? 'All promotions' : 'Active promotions' } }),
    summarize: (data) => `There are **${Number(data?.total || 0)}** promotion(s) ${data?.activeOnly ? 'active now' : 'on record'}.`,
    run: async (ctx, args) => {
      const now = new Date();
      const activeOnly = args.activeOnly !== false;
      const where: any = { restaurantId: ctx.restaurantId };
      if (activeOnly) {
        where.isActive = true;
        where.AND = [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ];
      }

      const promotions = await prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { menuItem: { select: { name: true, price: true } } },
      });

      return {
        data: {
          activeOnly,
          total: promotions.length,
          promotions: promotions.map((promotion) => ({
            type: promotion.type,
            title: promotion.title,
            description: promotion.description,
            specialPrice: promotion.specialPrice !== null ? Number(promotion.specialPrice) : null,
            item: promotion.menuItem?.name || null,
            itemPrice: promotion.menuItem?.price !== undefined ? Number(promotion.menuItem.price) : null,
            startsAt: promotion.startsAt,
            endsAt: promotion.endsAt,
            isActive: promotion.isActive,
          })),
        },
      };
    },
  },

  {
    key: 'get_qr_stats',
    label: 'QR scan stats',
    description: 'Read-only: QR code scan totals and the top-performing codes for a period. Use for "how many QR scans?", "which table QR is popular?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ period: periodSchema.default('week') }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['today', 'week', 'month'] } },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: `QR scans for ${String(args.period || 'week')}` } }),
    summarize: (data) => `There were **${Number(data?.totalScans || 0)}** QR scan(s) for ${String(data?.period || 'the period')}.`,
    run: async (ctx, args) => {
      const period = (args.period as any) || 'week';
      const { start, end } = rangeFor(period);

      const [totalScans, codes] = await Promise.all([
        prisma.qrScan.count({ where: { restaurantId: ctx.restaurantId, scannedAt: { gte: start, lte: end } } }),
        prisma.qrCode.findMany({
          where: { restaurantId: ctx.restaurantId },
          orderBy: { scanCount: 'desc' },
          take: 20,
          select: { id: true, label: true, tableNumber: true, qrType: true, scanCount: true, isActive: true },
        }),
      ]);

      return {
        data: {
          period,
          totalScans,
          codes: codes.map((code) => ({
            label: code.label,
            table: code.tableNumber,
            type: code.qrType,
            scans: code.scanCount,
            active: code.isActive,
          })),
        },
      };
    },
  },

  {
    key: 'get_subscription',
    label: 'Subscription & billing',
    description: 'Read-only: current plan, status, trial/expiry dates, usage against limits and unpaid invoices. Use for "what plan am I on?", "when does my trial end?", "any invoices due?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({}).strict(),
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Subscription and invoices' } }),
    summarize: (data) => {
      const plan = data?.plan?.name || 'your plan';
      const status = data?.status || 'UNKNOWN';
      const outstanding = Array.isArray(data?.outstandingInvoices) ? data.outstandingInvoices.length : 0;
      return `You're on **${plan}** (${status})${outstanding ? ` with **${outstanding}** unpaid invoice(s).` : ' with no unpaid invoices.'}`;
    },
    run: async (ctx) => {
      const summary = await getSubscriptionSummary(ctx.restaurantId);
      const outstandingInvoices = await prisma.subscriptionInvoice.findMany({
        where: { restaurantId: ctx.restaurantId, status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { periodEnd: 'asc' },
        take: 5,
        select: { invoiceNumber: true, amountKes: true, periodEnd: true, status: true },
      });

      return {
        data: {
          ...summary,
          outstandingInvoices: outstandingInvoices.map((invoice) => ({
            invoiceNumber: invoice.invoiceNumber,
            amountKes: Number(invoice.amountKes),
            due: invoice.periodEnd,
            status: invoice.status,
          })),
        },
      };
    },
  },

  {
    key: 'get_staff_shifts',
    label: 'Staff shifts',
    description: 'Read-only: current or recent staff shifts/clock-ins. Use for "who is on shift?", "who clocked in today?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ activeOnly: z.boolean().default(true) }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { activeOnly: { type: 'boolean', description: 'Only currently active shifts (default true)' } },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: args.activeOnly === false ? 'All shifts' : 'Active shifts' } }),
    summarize: (data) => `There are **${Number(data?.active || 0)}** active shift(s)${data?.activeOnly ? '' : ` out of ${Number(data?.total || 0)}`}.`,
    run: async (ctx, args) => {
      const activeOnly = args.activeOnly !== false;
      const where: any = { restaurantId: ctx.restaurantId };
      if (activeOnly) where.isActive = true;

      const shifts = await prisma.staffShift.findMany({
        where,
        orderBy: { clockIn: 'desc' },
        take: 50,
        include: { staff: { select: { fullName: true, role: true } } },
      });

      return {
        data: {
          activeOnly,
          total: shifts.length,
          active: shifts.filter((shift) => shift.isActive).length,
          shifts: shifts.map((shift) => ({
            staff: shift.staff?.fullName || 'Unknown',
            role: shift.staff?.role || null,
            clockIn: shift.clockIn,
            clockOut: shift.clockOut,
            active: shift.isActive,
          })),
        },
      };
    },
  },

  {
    key: 'get_settings',
    label: 'Restaurant settings',
    description: 'Read-only: non-secret restaurant settings — ordering/payment toggles, tax %, service charge, tip flag, languages, currency. Use for "is M-Pesa enabled?", "what is our tax rate?", "which languages are on?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({}).strict(),
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Restaurant settings' } }),
    summarize: (data) => {
      const payments = data?.payments || {};
      const languages = Array.isArray(data?.languages) ? data.languages.join(', ') : 'none';
      return `Ordering ${data?.allowOrdering ? 'is **on**' : 'is **off**'} · M-Pesa ${payments.mpesa ? 'on' : 'off'} · Cash ${payments.cash ? 'on' : 'off'} · Tax **${Number(data?.taxPercent || 0)}%** · Service charge **${Number(data?.serviceChargePercent || 0)}%** · Languages: ${languages}.`;
    },
    run: async (ctx) => {
      const [restaurant, settings] = await Promise.all([
        prisma.restaurant.findUnique({
          where: { id: ctx.restaurantId },
          select: { name: true, currency: true, city: true, phone: true },
        }),
        prisma.restaurantSettings.findUnique({
          where: { restaurantId: ctx.restaurantId },
          select: {
            allowOrdering: true,
            allowCashPayment: true,
            allowMpesaPayment: true,
            mpesaShortcode: true,
            mpesaBusinessName: true,
            taxPercent: true,
            serviceChargePercent: true,
            tipEnabled: true,
            showPrices: true,
            languageEnglish: true,
            languageSwahili: true,
            languageArabic: true,
          },
        }),
      ]);

      if (!settings) {
        return { data: { restaurant, settingsConfigured: false } };
      }

      const languages = [
        settings.languageEnglish ? 'English' : null,
        settings.languageSwahili ? 'Kiswahili' : null,
        settings.languageArabic ? 'Arabic' : null,
      ].filter(Boolean) as string[];

      return {
        data: {
          restaurant,
          settingsConfigured: true,
          allowOrdering: settings.allowOrdering,
          showPrices: settings.showPrices,
          taxPercent: Number(settings.taxPercent || 0),
          serviceChargePercent: Number(settings.serviceChargePercent || 0),
          tipEnabled: settings.tipEnabled,
          languages,
          payments: {
            mpesa: settings.allowMpesaPayment,
            cash: settings.allowCashPayment,
            shortcode: settings.mpesaShortcode || null,
            businessName: settings.mpesaBusinessName || null,
          },
        },
      };
    },
  },
];
