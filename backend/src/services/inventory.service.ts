import { prisma } from '@/config/database';
import { AppError, NotFoundError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Inventory service.
 *
 * Core principle: stock quantities are NEVER overwritten. Every change to
 * stock is an immutable StockMovement row (signed quantity: positive = in,
 * negative = out). The current stock level is always the sum of movements.
 */

export interface MovementInput {
  restaurantId: string;
  itemId: string;
  type: 'OPENING' | 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  quantity: number; // positive = stock in, negative = stock out
  unitCost?: number;
  referenceType: 'PURCHASE_ORDER' | 'ORDER' | 'MANUAL' | 'OPENING';
  referenceId?: string;
  notes?: string;
  performedById?: string;
}

/**
 * Records an immutable stock movement. Validates the item belongs to the
 * restaurant. Throws on a movement that would drive stock negative for
 * consumption types (SALE/WASTE/ADJUSTMENT/TRANSFER_OUT).
 */
export async function recordMovement(input: MovementInput): Promise<any> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: input.itemId, restaurantId: input.restaurantId },
    select: { id: true },
  });
  if (!item) {
    throw new NotFoundError('Inventory item not found', 'Bidhaa haikupatikana');
  }

  const quantity = Number(input.quantity);
  if (!isFinite(quantity) || quantity === 0) {
    throw AppError.validation('Movement quantity must be non-zero', 'Kiasi cha harakati lazima kiwe kisicho sifuri');
  }

  const consumptionTypes = ['SALE', 'WASTE', 'ADJUSTMENT', 'TRANSFER_OUT'];
  if (consumptionTypes.includes(input.type) && quantity > 0) {
    throw AppError.validation('Consumption movements must use a negative quantity', 'Harakati za matumizi zinahitaji kiasi hasi');
  }

  if (input.type === 'OPENING' && quantity < 0) {
    throw AppError.validation('Opening stock cannot be negative', 'Hisia ya mwanzo haiwezi kuwa hasi');
  }

  if (consumptionTypes.includes(input.type)) {
    const current = await getStockLevel(input.restaurantId, input.itemId);
    if (current + quantity < 0) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient stock for this movement', 'Hisia haitoshi kwa harakati hii');
    }
  }

  const unitCost = input.unitCost !== undefined ? Number(input.unitCost) : undefined;
  const totalCost = unitCost !== undefined ? Math.round(unitCost * Math.abs(quantity) * 100) / 100 : undefined;

  return prisma.stockMovement.create({
    data: {
      restaurantId: input.restaurantId,
      itemId: input.itemId,
      type: input.type,
      quantity,
      unitCost: unitCost ?? null,
      totalCost: totalCost ?? null,
      referenceType: input.referenceType,
      referenceId: input.referenceId || null,
      notes: input.notes || null,
      performedById: input.performedById || null,
    },
    include: { item: { select: { id: true, name: true, unit: true } } },
  });
}

/**
 * Returns the current stock level for one item (sum of movements).
 */
export async function getStockLevel(restaurantId: string, itemId: string): Promise<number> {
  const agg = await prisma.stockMovement.aggregate({
    where: { restaurantId, itemId },
    _sum: { quantity: true },
  });
  return Number(agg._sum.quantity || 0);
}

/**
 * Returns all items with their current stock levels and low-stock flags.
 */
export async function getStockLevels(restaurantId: string): Promise<any[]> {
  const [items, movements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { restaurantId },
      orderBy: { name: 'asc' },
    }),
    prisma.stockMovement.groupBy({
      by: ['itemId'],
      where: { restaurantId },
      _sum: { quantity: true },
    }),
  ]);

  const levelMap = new Map(movements.map((m) => [m.itemId, Number(m._sum.quantity || 0)]));

  return items.map((item) => {
    const stock = levelMap.get(item.id) || 0;
    return {
      ...item,
      stock,
      lowStock: stock < Number(item.reorderLevel),
      outOfStock: stock <= 0,
    };
  });
}

/**
 * Lists items that are at or below their reorder level.
 */
export async function getLowStockItems(restaurantId: string): Promise<any[]> {
  const levels = await getStockLevels(restaurantId);
  return levels.filter((i) => i.isActive && i.lowStock);
}

/**
 * Receives a purchase order: creates PURCHASE movements for each item and
 * updates received quantities + order status.
 */
export async function receivePurchaseOrder(purchaseOrderId: string, restaurantId: string, performedById?: string, receivedQtyOverride?: Record<string, number>): Promise<any> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: true },
  });

  if (!po || po.restaurantId !== restaurantId) {
    throw new NotFoundError('Purchase order not found', 'Agizo la ununuzi halikupatikana');
  }

  if (po.status === 'RECEIVED') {
    throw AppError.validation('Purchase order already received', 'Agizo la ununuzi tayari limepokelewa');
  }
  if (po.status === 'CANCELLED') {
    throw AppError.validation('Cancelled purchase orders cannot be received', 'Agizo lililoghairiwa haliwezi kupokelewa');
  }

  const movements = [];
  for (const item of po.items) {
    const receivedQty = receivedQtyOverride?.[item.id] ?? Number(item.quantity) - Number(item.receivedQty);
    if (receivedQty <= 0) continue;

    movements.push(
      await recordMovement({
        restaurantId,
        itemId: item.itemId,
        type: 'PURCHASE',
        quantity: receivedQty,
        unitCost: Number(item.unitCost),
        referenceType: 'PURCHASE_ORDER',
        referenceId: po.orderNumber,
        performedById,
      })
    );
  }

  const totalReceived = movements.length;
  const allReceived = po.items.every((i) => {
    const q = receivedQtyOverride?.[i.id] ?? Number(i.quantity) - Number(i.receivedQty);
    return q > 0 || Number(i.receivedQty) >= Number(i.quantity);
  });

  const status = allReceived ? 'RECEIVED' : totalReceived > 0 ? 'PARTIAL' : po.status;

  // Persist received quantities per item
  for (const item of po.items) {
    const q = receivedQtyOverride?.[item.id];
    if (q !== undefined && q > 0) {
      await prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: { increment: q } },
      });
    }
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      status,
      receivedAt: totalReceived > 0 ? new Date() : undefined,
    },
    include: { items: { include: { item: { select: { id: true, name: true, unit: true } } } }, supplier: true },
  });

  logger.info('Purchase order received', { purchaseOrderId: po.id, restaurantId, movements: totalReceived, status });

  return updated;
}
