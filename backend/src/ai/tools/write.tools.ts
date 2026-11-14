import { z } from 'zod';
import { prisma } from '@/config/database';
import { invalidateMenuCache } from '@/utils/cache';
import { io } from '@/hooks/socket';
import { onTableSeated, freeTableIfLastOrder } from '@/services/table.service';
import { recordMovement } from '@/services/inventory.service';
import logger from '@/utils/logger';
import type { Tool, ToolContext, ResolveOutcome } from './types';
import {
  menuItemCandidates,
  inventoryItemCandidates,
  staffCandidates,
  tableCandidates,
  resolveSingle,
  resolveOrder,
} from './resolve';

/**
 * Write tools — proposed, then explicitly confirmed. Never auto-run.
 * Each tool snapshots the state it needs for a compensating undo (where the
 * domain supports one). Order-cancelling and payments are deliberately NOT
 * exposed: they trigger refunds/printing and must stay on the conservative
 * human path.
 */

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'PREPARING'],
  CONFIRMED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
};

function emitOrderStatus(restaurantId: string, order: { id: string; orderNumber: string; status: string; paymentStatus?: string }): void {
  try {
    io.to(`restaurant:${restaurantId}`).emit('order:status-changed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
    });
    io.to(`order:${order.orderNumber}`).emit('order:status-changed', { status: order.status });
  } catch (error) {
    logger.error('AI tool failed to emit order:status-changed', { error: (error as Error).message, orderId: order.id });
  }
}

export const writeTools: Tool[] = [
  {
    key: 'set_item_availability',
    label: 'Set menu item availability',
    description: 'Mark a menu item as available or unavailable (86 it). Use when the operator says an item is sold out, out of stock, to stop selling it, or to bring it back.',
    kind: 'write',
    risk: 'low',
    roles: ['owner', 'manager', 'super_admin'],
    undoWindowSeconds: 15,
    inputSchema: z.object({
      item: z.string().min(1).max(120),
      available: z.boolean(),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Menu item name exactly as the operator said it' },
        available: { type: 'boolean', description: 'true to make it available, false to stop selling it' },
      },
      required: ['item', 'available'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const candidates = await menuItemCandidates(ctx.restaurantId);
      const resolved = resolveSingle(String(args.item), candidates, 'menu item');
      if (!resolved.ok) return { ok: false, clarification: resolved.clarification };
      const item = resolved.match;
      const currently = Boolean(item.meta?.isAvailable);
      return {
        ok: true,
        args: { itemId: item.id, available: Boolean(args.available) },
        preview: {
          summary: `Mark "${item.label}" as ${args.available ? 'AVAILABLE' : 'UNAVAILABLE'} (currently ${currently ? 'available' : 'unavailable'}).`,
          before: { itemId: item.id, itemName: item.label, isAvailable: currently },
        },
      };
    },
    run: async (ctx, args) => {
      const updated = await prisma.menuItem.update({
        where: { id: String(args.itemId) },
        data: { isAvailable: Boolean(args.available) },
        select: { id: true, name: true, isAvailable: true },
      });
      await invalidateMenuCache(ctx.restaurantId);
      return { message: `"${updated.name}" is now ${updated.isAvailable ? 'available' : 'unavailable'}.`, data: updated };
    },
    compensate: async (ctx, _args, before) => {
      const itemId = String(before?.itemId || '');
      if (!itemId) throw new Error('Undo snapshot missing itemId');
      const updated = await prisma.menuItem.update({
        where: { id: itemId },
        data: { isAvailable: Boolean(before?.isAvailable) },
        select: { id: true, name: true, isAvailable: true },
      });
      await invalidateMenuCache(ctx.restaurantId);
      return { message: `Undone: "${updated.name}" is ${updated.isAvailable ? 'available' : 'unavailable'} again.`, data: updated };
    },
  },

  {
    key: 'mark_item_special',
    label: 'Mark today\'s special',
    description: 'Mark a menu item as today\'s special, or remove the special flag.',
    kind: 'write',
    risk: 'low',
    roles: ['owner', 'manager', 'super_admin'],
    undoWindowSeconds: 15,
    inputSchema: z.object({
      item: z.string().min(1).max(120),
      isTodaysSpecial: z.boolean(),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Menu item name' },
        isTodaysSpecial: { type: 'boolean' },
      },
      required: ['item', 'isTodaysSpecial'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const candidates = await menuItemCandidates(ctx.restaurantId);
      const resolved = resolveSingle(String(args.item), candidates, 'menu item');
      if (!resolved.ok) return { ok: false, clarification: resolved.clarification };
      const item = resolved.match;
      const currently = Boolean(item.meta?.isTodaysSpecial);
      return {
        ok: true,
        args: { itemId: item.id, isTodaysSpecial: Boolean(args.isTodaysSpecial) },
        preview: {
          summary: `Mark "${item.label}" as ${args.isTodaysSpecial ? "today's special" : "no longer today's special"} (currently ${currently ? 'a special' : 'not a special'}).`,
          before: { itemId: item.id, itemName: item.label, isTodaysSpecial: currently },
        },
      };
    },
    run: async (ctx, args) => {
      const updated = await prisma.menuItem.update({
        where: { id: String(args.itemId) },
        data: { isTodaysSpecial: Boolean(args.isTodaysSpecial) },
        select: { id: true, name: true, isTodaysSpecial: true },
      });
      await invalidateMenuCache(ctx.restaurantId);
      return { message: `"${updated.name}" is ${updated.isTodaysSpecial ? "now today's special" : "no longer today's special"}.`, data: updated };
    },
    compensate: async (ctx, _args, before) => {
      const itemId = String(before?.itemId || '');
      const updated = await prisma.menuItem.update({
        where: { id: itemId },
        data: { isTodaysSpecial: Boolean(before?.isTodaysSpecial) },
        select: { id: true, name: true, isTodaysSpecial: true },
      });
      await invalidateMenuCache(ctx.restaurantId);
      return { message: `Undone: "${updated.name}" special flag restored.`, data: updated };
    },
  },

  {
    key: 'set_item_price',
    label: 'Set menu item price',
    description: 'Change the selling price of a menu item in KES. Confirm the item and the exact new price; do not guess.',
    kind: 'write',
    risk: 'high',
    roles: ['owner', 'manager', 'super_admin'],
    undoWindowSeconds: 30,
    inputSchema: z.object({
      item: z.string().min(1).max(120),
      price: z.coerce.number().min(1).max(1_000_000),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Menu item name' },
        price: { type: 'number', description: 'New price in KES (positive)' },
      },
      required: ['item', 'price'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const candidates = await menuItemCandidates(ctx.restaurantId);
      const resolved = resolveSingle(String(args.item), candidates, 'menu item');
      if (!resolved.ok) return { ok: false, clarification: resolved.clarification };
      const item = resolved.match;
      const oldPrice = Number(item.meta?.price || 0);
      return {
        ok: true,
        args: { itemId: item.id, price: Number(args.price) },
        preview: {
          summary: `Change the price of "${item.label}" from KSh ${oldPrice.toLocaleString()} to KSh ${Number(args.price).toLocaleString()}.`,
          before: { itemId: item.id, itemName: item.label, price: oldPrice },
        },
      };
    },
    run: async (ctx, args) => {
      const updated = await prisma.menuItem.update({
        where: { id: String(args.itemId) },
        data: { price: Number(args.price) },
        select: { id: true, name: true, price: true },
      });
      await invalidateMenuCache(ctx.restaurantId);
      return { message: `"${updated.name}" price is now KSh ${Number(updated.price).toLocaleString()}.`, data: { ...updated, price: Number(updated.price) } };
    },
    compensate: async (ctx, _args, before) => {
      const itemId = String(before?.itemId || '');
      const updated = await prisma.menuItem.update({
        where: { id: itemId },
        data: { price: Number(before?.price) },
        select: { id: true, name: true, price: true },
      });
      await invalidateMenuCache(ctx.restaurantId);
      return { message: `Undone: "${updated.name}" price restored to KSh ${Number(updated.price).toLocaleString()}.`, data: { ...updated, price: Number(updated.price) } };
    },
  },

  {
    key: 'restock_inventory_item',
    label: 'Restock inventory',
    description: 'Record stock coming into an inventory item (a purchase). Quantity is the amount added and must be positive.',
    kind: 'write',
    risk: 'high',
    roles: ['owner', 'manager', 'super_admin'],
    inputSchema: z.object({
      item: z.string().min(1).max(120),
      quantity: z.coerce.number().positive().max(1_000_000),
      unitCost: z.coerce.number().min(0).max(1_000_000).optional(),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Inventory item name' },
        quantity: { type: 'number', description: 'Positive quantity added to stock' },
        unitCost: { type: 'number', description: 'Optional unit cost in KES' },
      },
      required: ['item', 'quantity'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const candidates = await inventoryItemCandidates(ctx.restaurantId);
      const resolved = resolveSingle(String(args.item), candidates, 'inventory item');
      if (!resolved.ok) return { ok: false, clarification: resolved.clarification };
      const item = resolved.match;
      const unit = item.meta?.unit ? ` ${item.meta.unit}` : '';
      return {
        ok: true,
        args: {
          itemId: item.id,
          quantity: Number(args.quantity),
          ...(args.unitCost !== undefined ? { unitCost: Number(args.unitCost) } : {}),
        },
        preview: {
          summary: `Record ${Number(args.quantity)}${unit} of "${item.label}" added to stock${args.unitCost !== undefined ? ` at KSh ${Number(args.unitCost).toLocaleString()} each` : ''}.`,
          before: { itemId: item.id, itemName: item.label },
        },
      };
    },
    run: async (ctx, args) => {
      const movement = await recordMovement({
        restaurantId: ctx.restaurantId,
        itemId: String(args.itemId),
        type: 'PURCHASE',
        quantity: Number(args.quantity),
        unitCost: args.unitCost !== undefined ? Number(args.unitCost) : undefined,
        referenceType: 'MANUAL',
        notes: 'AI command restock',
        performedById: ctx.userId,
      });
      return { message: `Added ${Number(args.quantity)} unit(s) to stock.`, data: { id: movement?.id, item: movement?.item?.name, quantity: Number(args.quantity) } };
    },
  },

  {
    key: 'update_order_status',
    label: 'Update order status',
    description: 'Write: advance an active order — confirm, start preparing, mark ready, or mark served. Use for "mark ... ready/served", "start preparing", "confirm order". Do not use for cancellation (that requires a manager on the POS).',
    kind: 'write',
    risk: 'high',
    roles: ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'super_admin'],
    undoWindowSeconds: 15,
    inputSchema: z.object({
      order: z.string().min(1).max(160),
      status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'SERVED']),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        order: { type: 'string', description: 'Order number or table reference (e.g. "ORD-1234", "table 5")' },
        status: { type: 'string', enum: ['CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
      },
      required: ['order', 'status'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const resolved = await resolveOrder(ctx.restaurantId, String(args.order));
      if (!resolved.ok) return { ok: false, clarification: resolved.clarification };
      const order = resolved.order;
      const current = String(order.meta?.status || '');
      const target = String(args.status);
      const allowed = TRANSITIONS[current] || [];
      if (!allowed.includes(target)) {
        return {
          ok: false,
          clarification: {
            question: `Order ${order.meta?.orderNumber} is ${current}. It can only move to: ${allowed.join(', ') || 'nothing (it is finished)'}.`,
            options: [],
          },
        };
      }
      return {
        ok: true,
        args: { orderId: order.id, orderNumber: order.meta?.orderNumber, status: target },
        preview: {
          summary: `Move order ${order.meta?.orderNumber} (${order.meta?.tableNumber ? `Table ${order.meta.tableNumber}` : 'Takeaway'}) from ${current} to ${target}.`,
          before: { orderId: order.id, orderNumber: order.meta?.orderNumber, status: current },
        },
      };
    },
    run: async (ctx, args) => {
      const target = String(args.status);
      const updateData: any = { status: target };
      if (target === 'CONFIRMED') updateData.confirmedAt = new Date();
      if (target === 'PREPARING') updateData.preparedAt = new Date();
      if (target === 'READY') updateData.preparedAt = new Date();
      if (target === 'SERVED') updateData.servedAt = new Date();

      const updated = await prisma.order.update({
        where: { id: String(args.orderId) },
        data: updateData,
        select: { id: true, orderNumber: true, status: true, paymentStatus: true },
      });
      emitOrderStatus(ctx.restaurantId, updated);
      return { message: `Order ${updated.orderNumber} is now ${updated.status}.`, data: updated };
    },
    compensate: async (ctx, _args, before) => {
      const updated = await prisma.order.update({
        where: { id: String(before?.orderId) },
        data: { status: String(before?.status) as any },
        select: { id: true, orderNumber: true, status: true, paymentStatus: true },
      });
      emitOrderStatus(ctx.restaurantId, updated);
      return { message: `Undone: order ${updated.orderNumber} is back to ${updated.status}.`, data: updated };
    },
  },

  {
    key: 'assign_waiter',
    label: 'Assign waiter to order',
    description: 'Write: assign or reassign an active order to a waiter. Use for "assign/move this order to waiter X" or "reassign table 6 to Brian". Use full or partial waiter name.',
    kind: 'write',
    risk: 'low',
    roles: ['owner', 'manager', 'super_admin'],
    undoWindowSeconds: 15,
    inputSchema: z.object({
      order: z.string().min(1).max(160),
      waiter: z.string().min(1).max(120),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        order: { type: 'string', description: 'Order number or table reference' },
        waiter: { type: 'string', description: 'Waiter name' },
      },
      required: ['order', 'waiter'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const resolvedOrder = await resolveOrder(ctx.restaurantId, String(args.order));
      if (!resolvedOrder.ok) return { ok: false, clarification: resolvedOrder.clarification };
      const staff = await staffCandidates(ctx.restaurantId);
      const resolvedStaff = resolveSingle(String(args.waiter), staff, 'waiter');
      if (!resolvedStaff.ok) return { ok: false, clarification: resolvedStaff.clarification };
      const order = resolvedOrder.order;
      const waiter = resolvedStaff.match;
      return {
        ok: true,
        args: { orderId: order.id, waiterId: waiter.id, waiterName: waiter.label },
        preview: {
          summary: `Assign order ${order.meta?.orderNumber} to waiter "${waiter.label}".`,
          before: { orderId: order.id, orderNumber: order.meta?.orderNumber, waiterId: order.meta?.waiterId ?? null },
        },
      };
    },
    run: async (ctx, args) => {
      const updated = await prisma.order.update({
        where: { id: String(args.orderId) },
        data: { waiterId: String(args.waiterId) },
        select: { id: true, orderNumber: true, waiterId: true },
      });
      return { message: `Order ${updated.orderNumber} assigned to ${String(args.waiterName)}.`, data: updated };
    },
    compensate: async (ctx, _args, before) => {
      const updated = await prisma.order.update({
        where: { id: String(before?.orderId) },
        data: { waiterId: (before?.waiterId as string | null) ?? null },
        select: { id: true, orderNumber: true, waiterId: true },
      });
      return { message: `Undone: order ${updated.orderNumber} waiter assignment restored.`, data: updated };
    },
  },

  {
    key: 'transfer_table',
    label: 'Transfer order to another table',
    description: 'Write: move/transfer an active order (or a table\'s order) to a different free table. Use for requests like "move order ORD-1234 from table 2 to table 8" or "transfer table 4\'s order to table 9". Do not use a read-only table tool for this.',
    kind: 'write',
    risk: 'high',
    roles: ['owner', 'manager', 'waiter', 'super_admin'],
    undoWindowSeconds: 15,
    inputSchema: z.object({
      order: z.string().min(1).max(160),
      toTable: z.string().min(1).max(120),
    }).strict(),
    jsonSchema: {
      type: 'object',
      properties: {
        order: { type: 'string', description: 'Order number or current table reference' },
        toTable: { type: 'string', description: 'Target table number or label' },
      },
      required: ['order', 'toTable'],
      additionalProperties: false,
    },
    resolve: async (ctx, args): Promise<ResolveOutcome> => {
      const resolvedOrder = await resolveOrder(ctx.restaurantId, String(args.order));
      if (!resolvedOrder.ok) return { ok: false, clarification: resolvedOrder.clarification };
      const tables = await tableCandidates(ctx.restaurantId);
      const resolvedTable = resolveSingle(String(args.toTable), tables, 'table');
      if (!resolvedTable.ok) return { ok: false, clarification: resolvedTable.clarification };

      const order = resolvedOrder.order;
      const target = resolvedTable.match;
      const currentTableId = order.meta?.tableId as string | null;
      const targetStatus = String(target.meta?.status || '');

      if (currentTableId === target.id) {
        return { ok: false, clarification: { question: `Order ${order.meta?.orderNumber} is already on ${target.label}.`, options: [] } };
      }
      if (['UNAVAILABLE', 'RESERVED'].includes(targetStatus)) {
        return { ok: false, clarification: { question: `${target.label} is ${targetStatus.toLowerCase()} and cannot take this order. Choose another table.`, options: [] } };
      }
      if (targetStatus === 'OCCUPIED') {
        return { ok: false, clarification: { question: `${target.label} is already occupied. Choose a free table.`, options: [] } };
      }

      return {
        ok: true,
        args: {
          orderId: order.id,
          orderNumber: order.meta?.orderNumber,
          fromTableId: currentTableId,
          toTableId: target.id,
          toTableNumber: Number(target.meta?.tableNumber || 0),
        },
        preview: {
          summary: `Transfer order ${order.meta?.orderNumber} from ${order.meta?.tableNumber ? `Table ${order.meta.tableNumber}` : 'Takeaway'} to ${target.label}.`,
          before: {
            orderId: order.id,
            orderNumber: order.meta?.orderNumber,
            tableId: currentTableId,
            tableNumber: order.meta?.tableNumber ?? null,
          },
        },
      };
    },
    run: async (ctx, args) => {
      const updated = await prisma.order.update({
        where: { id: String(args.orderId) },
        data: { tableId: String(args.toTableId), tableNumber: Number(args.toTableNumber) },
        select: { id: true, orderNumber: true, tableId: true, tableNumber: true },
      });

      await onTableSeated(ctx.restaurantId, String(args.toTableId));
      if (args.fromTableId) {
        await freeTableIfLastOrder(ctx.restaurantId, updated.id, String(args.fromTableId));
      }
      return { message: `Order ${updated.orderNumber} moved to Table ${updated.tableNumber}.`, data: updated };
    },
    compensate: async (ctx, _args, before) => {
      const orderId = String(before?.orderId);
      const previousTableId = (before?.tableId as string | null) ?? null;
      const previousTableNumber = Number(before?.tableNumber || 0);

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { tableId: previousTableId, tableNumber: previousTableNumber || null },
        select: { id: true, orderNumber: true, tableId: true, tableNumber: true },
      });

      if (previousTableId) {
        await onTableSeated(ctx.restaurantId, previousTableId);
      }
      return { message: `Undone: order ${updated.orderNumber} returned to ${previousTableNumber ? `Table ${previousTableNumber}` : 'Takeaway'}.`, data: updated };
    },
  },
];
