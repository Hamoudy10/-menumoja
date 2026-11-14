import { z } from 'zod';
import { prisma } from '@/config/database';
import { getSalesSummary, getProfitabilitySnapshot, getInventoryRisk, getStaffMetrics } from '@/services/manager.service';
import { generateDailyBriefing } from '@/services/ai-manager.service';
import type { Tool, ToolContext } from './types';

/**
 * Read tools — grounded, tenant-scoped, no side effects.
 * The command service answers from the returned data; the LLM never sees the
 * database directly.
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

async function getTopItems(restaurantId: string, period: 'today' | 'week' | 'month', limit: number): Promise<any> {
  const { start, end } = rangeFor(period);
  const rows = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      menuItemId: { not: null },
      order: { restaurantId, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, createdAt: { gte: start, lte: end } },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  const ids = rows.map((r) => r.menuItemId as string);
  const items = await prisma.menuItem.findMany({
    where: { restaurantId, id: { in: ids } },
    select: { id: true, name: true, price: true },
  });
  const nameMap = new Map(items.map((i) => [i.id, i]));

  return {
    period,
    items: rows.map((r) => ({
      name: nameMap.get(r.menuItemId as string)?.name || 'Unknown',
      unitsSold: Number(r._sum.quantity || 0),
      revenue: Math.round(Number(r._sum.subtotal || 0) * 100) / 100,
    })),
  };
}

async function getTableStatus(restaurantId: string): Promise<any> {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: { tableNumber: 'asc' },
    select: {
      id: true,
      tableNumber: true,
      label: true,
      status: true,
      capacity: true,
      orders: {
        where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } },
        select: { id: true, orderNumber: true, status: true, paymentStatus: true },
      },
    },
  });

  return {
    total: tables.length,
    free: tables.filter((t) => t.status === 'FREE').length,
    occupied: tables.filter((t) => t.status === 'OCCUPIED').length,
    reserved: tables.filter((t) => t.status === 'RESERVED').length,
    unavailable: tables.filter((t) => t.status === 'UNAVAILABLE').length,
    tables: tables.map((t) => ({
      tableNumber: t.tableNumber,
      label: t.label || `Table ${t.tableNumber}`,
      status: t.status,
      capacity: t.capacity,
      activeOrders: t.orders.map((o) => ({ orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus })),
    })),
  };
}

async function getOpenOrders(restaurantId: string): Promise<any> {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } },
    orderBy: { createdAt: 'asc' },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      tableNumber: true,
      totalAmount: true,
      customerName: true,
      createdAt: true,
      waiter: { select: { fullName: true } },
    },
  });

  const now = Date.now();
  return {
    count: orders.length,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      table: o.tableNumber ? `Table ${o.tableNumber}` : 'Takeaway',
      customerName: o.customerName || null,
      waiter: o.waiter?.fullName || null,
      total: Number(o.totalAmount),
      elapsedMinutes: Math.max(0, Math.round((now - o.createdAt.getTime()) / 60000)),
    })),
  };
}

export const readTools: Tool[] = [
  {
    key: 'get_sales_summary',
    label: 'Sales summary',
    description: 'Get revenue, number of paid orders, average order value and comparison to the previous period. Use for questions like "how much did we sell today?" or "how did this month perform?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ period: periodSchema.default('month') }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time period (default month)' },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx: ToolContext, args) => ({
      ok: true,
      args,
      preview: { summary: `Sales summary for ${String(args.period || 'month')}` },
    }),
    run: async (ctx, args) => ({
      data: await getSalesSummary(ctx.restaurantId, (args.period as any) || 'month'),
    }),
  },

  {
    key: 'get_top_items',
    label: 'Top-selling items',
    description: 'Get the best-selling menu items by quantity for a period. Use for "what is selling best?" or "top dishes this week".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      period: periodSchema.default('month'),
      limit: z.coerce.number().int().min(1).max(20).default(5),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'] },
        limit: { type: 'number', description: 'How many items (1-20, default 5)' },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({
      ok: true,
      args,
      preview: { summary: `Top ${String(args.limit || 5)} items for ${String(args.period || 'month')}` },
    }),
    run: async (ctx, args) => ({
      data: await getTopItems(ctx.restaurantId, (args.period as any) || 'month', Number(args.limit || 5)),
    }),
  },

  {
    key: 'get_menu_items',
    label: 'Menu items',
    description: 'Read-only: list menu items with price and availability. Optionally filter by category, availability, or a search term. Use for "list all menu items", "show me the menu", "what dishes do we have?", "which items are unavailable?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      category: z.string().max(100).optional(),
      available: z.boolean().optional(),
      search: z.string().max(100).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(100),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category name' },
        available: { type: 'boolean', description: 'Filter by availability' },
        search: { type: 'string', description: 'Optional name/description search term' },
        limit: { type: 'number', description: 'Maximum items (1-200, default 100)' },
      },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({
      ok: true,
      args,
      preview: {
        summary: `Menu items${args.category ? ` in ${String(args.category)}` : ''}${args.available === false ? ' (unavailable only)' : ''}`,
      },
    }),
    summarize: (data) => {
      const total = Number(data?.total || 0);
      const shown = Array.isArray(data?.items) ? data.items.length : 0;
      return `You have **${total}** menu item${total === 1 ? '' : 's'}${shown < total ? `; showing the first ${shown}.` : '.'}`;
    },
    run: async (ctx, args) => {
      const where: any = { restaurantId: ctx.restaurantId };
      if (args.available !== undefined) where.isAvailable = Boolean(args.available);
      if (args.search) {
        where.OR = [
          { name: { contains: String(args.search), mode: 'insensitive' } },
          { description: { contains: String(args.search), mode: 'insensitive' } },
        ];
      }
      if (args.category) {
        const categoryName = String(args.category);
        const category = await prisma.menuCategory.findFirst({
          where: { restaurantId: ctx.restaurantId, name: { equals: categoryName, mode: 'insensitive' } },
          select: { id: true },
        });
        where.category = category
          ? { id: category.id }
          : { name: { contains: categoryName, mode: 'insensitive' } };
      }

      const [items, total] = await Promise.all([
        prisma.menuItem.findMany({
          where,
          take: Number(args.limit || 100),
          orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            price: true,
            isAvailable: true,
            isTodaysSpecial: true,
            category: { select: { name: true } },
          },
        }),
        prisma.menuItem.count({ where }),
      ]);

      return {
        data: {
          total,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price),
            available: item.isAvailable,
            special: item.isTodaysSpecial,
            category: item.category?.name || null,
          })),
        },
      };
    },
  },

  {
    key: 'get_low_stock',
    label: 'Low stock / inventory risk',
    description: 'Get inventory items that are low or out of stock, with reorder levels. Use for "what stock is running low?" or "what should we order?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({}).strict(),
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Inventory risk' } }),
    run: async (ctx) => ({ data: await getInventoryRisk(ctx.restaurantId) }),
  },

  {
    key: 'get_table_status',
    label: 'Table status',
    description: 'Read-only: the live status of every table (free, occupied, reserved, unavailable) and the active orders on each table. Use ONLY when the operator is asking a question about tables. Do NOT use when they want to move or transfer an order.',
    kind: 'read',
    roles: ['owner', 'manager', 'cashier', 'waiter', 'super_admin'],
    inputSchema: z.object({}).strict(),
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Table status' } }),
    run: async (ctx) => ({ data: await getTableStatus(ctx.restaurantId) }),
  },

  {
    key: 'get_open_orders',
    label: 'Open orders',
    description: 'Read-only: list active (open) orders with table, status, payment status, waiter and elapsed minutes. Use for "what is still open?" or "which orders are waiting?" — not when the operator wants to change an order.',
    kind: 'read',
    roles: ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'super_admin'],
    inputSchema: z.object({}).strict(),
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Open orders' } }),
    run: async (ctx) => ({ data: await getOpenOrders(ctx.restaurantId) }),
  },

  {
    key: 'get_staff_performance',
    label: 'Staff performance',
    description: 'Get orders served per waiter and payments collected per cashier for a period.',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ period: z.enum(['week', 'month']).default('month') }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['week', 'month'] } },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({
      ok: true,
      args,
      preview: { summary: `Staff performance for ${String(args.period || 'month')}` },
    }),
    run: async (ctx, args) => ({
      data: await getStaffMetrics(ctx.restaurantId, (args.period as any) || 'month'),
    }),
  },

  {
    key: 'get_profitability',
    label: 'Profitability',
    description: 'Get net sales, estimated cost of goods, contribution and margin percentage for a period. Use for "are we profitable?", "what are our margins?", "food costs?".',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({ period: z.enum(['week', 'month']).default('month') }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['week', 'month'] } },
      additionalProperties: false,
    },
    resolve: async (_ctx, args) => ({
      ok: true,
      args,
      preview: { summary: `Profitability for ${String(args.period || 'month')}` },
    }),
    run: async (ctx, args) => ({
      data: await getProfitabilitySnapshot(ctx.restaurantId, (args.period as any) || 'month'),
    }),
  },

  {
    key: 'get_daily_briefing',
    label: 'Daily briefing',
    description: 'Get yesterday\'s deterministic business briefing: revenue, top seller, highest margin, low stock and comparison to last week.',
    kind: 'read',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({}).strict(),
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    resolve: async (_ctx, args) => ({ ok: true, args, preview: { summary: 'Daily briefing' } }),
    summarize: (data) => {
      const date = data?.date ? new Date(data.date).toLocaleDateString('en-KE') : 'Yesterday';
      const revenue = Number(data?.revenue || 0);
      const orders = Number(data?.orders || 0);
      const averageOrderValue = Number(data?.averageOrderValue || 0);
      const lines = [
        `**Daily briefing — ${date}**`,
        `Revenue **KES ${revenue.toLocaleString()}** · **${orders}** paid order${orders === 1 ? '' : 's'} · avg **KES ${averageOrderValue.toLocaleString()}**.`,
      ];

      if (data?.changePct !== null && data?.changePct !== undefined) {
        lines.push(`Change vs the prior period: **${data.changePct > 0 ? '+' : ''}${data.changePct}%**.`);
      }

      const notes = (Array.isArray(data?.insights) ? data.insights : []).filter(
        (insight: any) => insight.type !== 'revenue'
      );
      if (notes.length > 0) {
        lines.push('');
        for (const note of notes.slice(0, 3)) {
          lines.push(`- ${note.title}${note.reason ? ` — ${note.reason}` : ''}`);
        }
      }
      return lines.join('\n');
    },
    run: async (ctx) => ({ data: await generateDailyBriefing(ctx.restaurantId) }),
  },
];
