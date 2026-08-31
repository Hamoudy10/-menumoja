import { z } from 'zod';
import { prisma } from '@/config/database';
import { AppError, NotFoundError, ConflictError } from '@/utils/errors';
import logger from '@/utils/logger';
import * as openai from '@/integrations/openai';
import { recordAiUsage, providerName, providerForModel } from './ai-usage.service';
import { recordMovement } from './inventory.service';

/**
 * Menu Moja AI — write-action layer (owner-facing, Level 3: execute with
 * confirmation).
 *
 * Principles (from the roadmap):
 *  - The AI NEVER writes to the database directly. It only proposes an
 *    action (tool + arguments). The backend validates ownership, resolves
 *    the referenced entity inside the restaurant, and performs the write.
 *  - Every proposal is persisted (AiAction, status PENDING), so the owner
 *    must explicitly confirm before anything changes. Nothing is executed
 *    implicitly.
 *  - Every action is audited (who, what, when, result).
 */

export interface ActionActor {
  userId: string;
  role?: string;
}

interface ActionDef {
  key: string;
  label: string;
  description: string;
  params: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  /** Human-readable summary for the confirmation card (resolves names). */
  describe: (restaurantId: string, args: any) => Promise<string>;
  /** Executes the write. Throws if the entity is not found / invalid. */
  execute: (restaurantId: string, args: any, actor: ActionActor) => Promise<{ message: string; result: any }>;
}

// ── Entity resolvers (name → real record, scoped to the restaurant) ──

async function resolveMenuItem(restaurantId: string, name: string): Promise<{ id: string; name: string; isAvailable: boolean; price: number }> {
  const needle = (name || '').trim().toLowerCase();
  if (!needle) throw AppError.validation('Provide a menu item name', 'Taja jina la chakula');

  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    select: { id: true, name: true, isAvailable: true, price: true },
  });

  const exact = items.find((i) => i.name.toLowerCase() === needle);
  if (exact) return { ...exact, price: Number(exact.price) };

  const partial = items.find((i) => i.name.toLowerCase().includes(needle));
  if (partial) return { ...partial, price: Number(partial.price) };

  const words = needle.split(/\s+/).filter((w) => w.length > 2);
  let best: { id: string; name: string; isAvailable: boolean; price: number } | null = null;
  let bestScore = 0;
  for (const item of items) {
    const itemName = item.name.toLowerCase();
    const score = words.reduce((s, w) => s + (itemName.includes(w) ? w.length : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = { ...item, price: Number(item.price) };
    }
  }
  if (best) return best;

  throw AppError.validation(`Menu item "${name}" was not found in this restaurant`, `Chakula "${name}" hakikupatikana`);
}

async function resolveInventoryItem(restaurantId: string, name: string): Promise<{ id: string; name: string }> {
  const needle = (name || '').trim().toLowerCase();
  if (!needle) throw AppError.validation('Provide an inventory item name', 'Taja jina la bidhaa');

  const items = await prisma.inventoryItem.findMany({ where: { restaurantId }, select: { id: true, name: true } });
  const exact = items.find((i) => i.name.toLowerCase() === needle);
  if (exact) return exact;
  const partial = items.find((i) => i.name.toLowerCase().includes(needle));
  if (partial) return partial;
  throw AppError.validation(`Inventory item "${name}" was not found`, `Bidhaa "${name}" haikupatikana`);
}

// ── Action registry ──

const ACTION_REGISTRY: Record<string, ActionDef> = {
  set_menu_item_availability: {
    key: 'set_menu_item_availability',
    label: 'Menu availability',
    description: 'Set whether a menu item is available for ordering. Use "available" or "unavailable".',
    params: z.object({ item: z.string().min(1), available: z.boolean() }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { item: { type: 'string' }, available: { type: 'boolean' } },
      required: ['item', 'available'],
      additionalProperties: false,
    },
    describe: async (restaurantId, args) => {
      const item = await resolveMenuItem(restaurantId, args.item);
      return `Mark "${item.name}" as ${args.available ? 'AVAILABLE' : 'UNAVAILABLE'} (currently ${item.isAvailable ? 'available' : 'unavailable'}).`;
    },
    execute: async (restaurantId, args) => {
      const item = await resolveMenuItem(restaurantId, args.item);
      const updated = await prisma.menuItem.update({ where: { id: item.id }, data: { isAvailable: args.available }, select: { id: true, name: true, isAvailable: true } });
      return { message: `"${updated.name}" is now ${updated.isAvailable ? 'available' : 'unavailable'}.`, result: updated };
    },
  },

  set_menu_item_price: {
    key: 'set_menu_item_price',
    label: 'Menu price',
    description: 'Set a new price (in KES) for a menu item.',
    params: z.object({ item: z.string().min(1), price: z.coerce.number().min(0) }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { item: { type: 'string' }, price: { type: 'number' } },
      required: ['item', 'price'],
      additionalProperties: false,
    },
    describe: async (restaurantId, args) => {
      const item = await resolveMenuItem(restaurantId, args.item);
      return `Change the price of "${item.name}" from KSh ${item.price} to KSh ${args.price}.`;
    },
    execute: async (restaurantId, args) => {
      const item = await resolveMenuItem(restaurantId, args.item);
      const updated = await prisma.menuItem.update({ where: { id: item.id }, data: { price: args.price }, select: { id: true, name: true, price: true } });
      return { message: `"${updated.name}" price is now KSh ${Number(updated.price)}.`, result: { id: updated.id, name: updated.name, price: Number(updated.price) } };
    },
  },

  set_menu_item_special: {
    key: 'set_menu_item_special',
    label: 'Today\'s special',
    description: 'Mark a menu item as a today\'s special (or remove the special flag).',
    params: z.object({ item: z.string().min(1), isTodaysSpecial: z.boolean() }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { item: { type: 'string' }, isTodaysSpecial: { type: 'boolean' } },
      required: ['item', 'isTodaysSpecial'],
      additionalProperties: false,
    },
    describe: async (restaurantId, args) => {
      const item = await resolveMenuItem(restaurantId, args.item);
      return `Mark "${item.name}" as ${args.isTodaysSpecial ? 'a today\'s special' : 'no longer a today\'s special'}.`;
    },
    execute: async (restaurantId, args) => {
      const item = await resolveMenuItem(restaurantId, args.item);
      const updated = await prisma.menuItem.update({ where: { id: item.id }, data: { isTodaysSpecial: args.isTodaysSpecial }, select: { id: true, name: true, isTodaysSpecial: true } });
      return { message: `"${updated.name}" is ${updated.isTodaysSpecial ? 'now a today\'s special' : 'no longer a today\'s special'}.`, result: updated };
    },
  },

  restock_inventory_item: {
    key: 'restock_inventory_item',
    label: 'Restock inventory',
    description: 'Record stock coming into an inventory item (a purchase/adjustment). Quantity is the amount added (positive).',
    params: z.object({ item: z.string().min(1), quantity: z.coerce.number().positive(), unitCost: z.coerce.number().min(0).optional() }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { item: { type: 'string' }, quantity: { type: 'number' }, unitCost: { type: 'number' } },
      required: ['item', 'quantity'],
      additionalProperties: false,
    },
    describe: async (restaurantId, args) => {
      const item = await resolveInventoryItem(restaurantId, args.item);
      return `Record ${args.quantity} more unit(s) of "${item.name}"${args.unitCost ? ` at KSh ${args.unitCost} each` : ''}.`;
    },
    execute: async (restaurantId, args, actor) => {
      const item = await resolveInventoryItem(restaurantId, args.item);
      const movement = await recordMovement({
        restaurantId,
        itemId: item.id,
        type: 'PURCHASE',
        quantity: args.quantity,
        unitCost: args.unitCost,
        referenceType: 'MANUAL',
        notes: 'AI manager restock',
        performedById: actor.userId,
      });
      return { message: `Added ${args.quantity} unit(s) of "${item.name}" to stock${args.unitCost ? ` at KSh ${args.unitCost} each` : ''}.`, result: { id: movement.id, item: item.name, quantity: args.quantity } };
    },
  },
};

export const ACTION_TOOL_LIST: openai.ManagerActionTool[] = Object.values(ACTION_REGISTRY).map((d) => ({
  key: d.key,
  label: d.label,
  description: d.description,
  jsonSchema: d.jsonSchema,
}));

// ── Intent detection (deterministic, cheap — only route to the LLM when it looks like a write) ──

const ACTION_MARKERS = [
  'mark', 'unavailable', 'available', 'restock', 'hide', 'set the price', 'change the price', 'update the price',
  'set the price of', 'stop selling', 'start selling', 'remove from menu', 'add stock', 'restock',
];

export function detectActionIntent(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return ACTION_MARKERS.some((m) => lower.includes(m));
}

// ── Proposal ──

export interface ProposedAction {
  id: string;
  tool: string;
  label: string;
  args: Record<string, unknown>;
  summary: string;
}

export async function proposeAction(restaurantId: string, message: string): Promise<{ proposedAction: ProposedAction; reply: string } | null> {
  const result = await openai.generateManagerAction(message, ACTION_TOOL_LIST);

  await recordAiUsage({
    restaurantId,
    feature: 'MANAGER_ACTION',
    provider: providerName(),
    model: providerForModel('deepseek-v4-flash'),
    promptTokens: 0,
    completionTokens: 0,
  }).catch(() => undefined);

  const def = result.action ? ACTION_REGISTRY[result.action] : undefined;
  if (!def) return null;

  let args: any;
  try {
    args = def.params.parse(result.args);
  } catch (error) {
    logger.warn('AI action args did not validate', { tool: result.action, error: (error as Error).message, restaurantId });
    return null;
  }

  const summary = await def.describe(restaurantId, args);

  const record = await prisma.aiAction.create({
    data: { restaurantId, tool: def.key, label: def.label, args, summary, status: 'PENDING' },
  });

  const proposedAction: ProposedAction = { id: record.id, tool: record.tool, label: record.label, args, summary: record.summary };
  return { proposedAction, reply: `I can do that — “${summary}” Please confirm to apply it.` };
}

// ── Confirm / reject / list ──

export async function confirmAction(restaurantId: string, actionId: string, actor: ActionActor): Promise<{ message: string; result: any }> {
  const action = await prisma.aiAction.findFirst({ where: { id: actionId, restaurantId } });
  if (!action) throw new NotFoundError('Action not found', 'Kitendo hakikupatikana');
  if (action.status === 'EXECUTED') throw new ConflictError('Action already executed', 'Kitendo tayari kimetekelezwa');
  if (action.status === 'REJECTED') throw new ConflictError('Action was rejected', 'Kitendo kilikataliwa');

  const def = ACTION_REGISTRY[action.tool];
  if (!def) throw AppError.internal(`Unknown action tool: ${action.tool}`);

  try {
    const outcome = await def.execute(restaurantId, action.args, actor);
    await prisma.aiAction.update({
      where: { id: action.id },
      data: { status: 'EXECUTED', executedById: actor.userId, executedAt: new Date(), result: outcome.result as any },
    });
    logger.info('AI action executed', { actionId: action.id, tool: action.tool, restaurantId, actor: actor.userId });
    return { message: outcome.message, result: outcome.result };
  } catch (error) {
    await prisma.aiAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', executedById: actor.userId, executedAt: new Date(), result: { error: (error as Error).message } },
    });
    throw error;
  }
}

export async function rejectAction(restaurantId: string, actionId: string, actor: ActionActor): Promise<void> {
  const action = await prisma.aiAction.findFirst({ where: { id: actionId, restaurantId } });
  if (!action) throw new NotFoundError('Action not found', 'Kitendo hakikupatikana');
  if (action.status !== 'PENDING') throw new ConflictError('Only pending actions can be rejected', 'Vitendo vinavyosubiri tu ndivyo vinavyoweza kukataliwa');

  await prisma.aiAction.update({ where: { id: action.id }, data: { status: 'REJECTED', executedById: actor.userId, executedAt: new Date() } });
  logger.info('AI action rejected', { actionId: action.id, tool: action.tool, restaurantId, actor: actor.userId });
}

export async function listActions(restaurantId: string, statusQuery?: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'FAILED' | 'all'): Promise<any[]> {
  const status = statusQuery && statusQuery !== 'all' ? statusQuery : undefined;
  return prisma.aiAction.findMany({
    where: { restaurantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export default { proposeAction, confirmAction, rejectAction, listActions, detectActionIntent };
