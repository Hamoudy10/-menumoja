import { Router } from 'express';
import { prisma } from '@/config/database';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateQuery, validateParams, asyncHandler } from '@/middleware';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { generateOrderNumber, buildPaginationMeta } from '@/utils/helpers';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  recordMovementSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
} from '@/utils/validation';
import { recordMovement, getStockLevels, getLowStockItems, receivePurchaseOrder } from '@/services/inventory.service';
import { z } from 'zod';
import logger from '@/utils/logger';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const idParamSchema = z.object({ id: z.string().uuid('Invalid ID') });
const movementQuerySchema = z.object({
  itemId: z.string().uuid().optional(),
  type: z.enum(['OPENING','PURCHASE','SALE','WASTE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

// ── Items ──

router.get('/items', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const items = await getStockLevels(restaurantId);
  res.json({ success: true, data: items });
}));

router.post('/items', auditLog, validate(createInventoryItemSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const item = await prisma.inventoryItem.create({
    data: { restaurantId, ...req.body },
  });
  res.status(201).json({ success: true, data: item });
}));

router.put('/items/:id', auditLog, validate(updateInventoryItemSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findFirst({ where: { id, restaurantId } });
  if (!existing) throw new NotFoundError('Inventory item not found', 'Bidhaa haikupatikana');

  const updated = await prisma.inventoryItem.update({ where: { id }, data: req.body });
  res.json({ success: true, data: updated });
}));

router.delete('/items/:id', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const existing = await prisma.inventoryItem.findFirst({ where: { id, restaurantId } });
  if (!existing) throw new NotFoundError('Inventory item not found', 'Bidhaa haikupatikana');

  const movementCount = await prisma.stockMovement.count({ where: { itemId: id } });
  if (movementCount > 0) {
    throw new ConflictError('Item has movement history and cannot be deleted — deactivate it instead', 'Bidhaa hii ina historia ya harakati na haiwezi kufutwa — zima badala yake');
  }

  await prisma.inventoryItem.delete({ where: { id } });
  res.json({ success: true, data: { message: 'Item deleted' } });
}));

// ── Movements ──

router.get('/movements', validateQuery(movementQuerySchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const { itemId, type, dateFrom, dateTo, page, perPage } = req.query as any;

  const where: any = { restaurantId };
  if (itemId) where.itemId = itemId;
  if (type) where.type = type;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.min(100, Math.max(1, Number(perPage) || 20));

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safePerPage,
      take: safePerPage,
      include: { item: { select: { id: true, name: true, unit: true } } },
    }),
  ]);

  res.json({
    success: true,
    data: movements.map((m) => ({ ...m, quantity: Number(m.quantity), unitCost: m.unitCost ? Number(m.unitCost) : null, totalCost: m.totalCost ? Number(m.totalCost) : null })),
    meta: buildPaginationMeta(total, safePage, safePerPage),
  });
}));

router.post('/movements', auditLog, validate(recordMovementSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const movement = await recordMovement({
    restaurantId,
    itemId: req.body.itemId,
    type: req.body.type,
    quantity: req.body.quantity,
    unitCost: req.body.unitCost,
    referenceType: req.body.referenceType || 'MANUAL',
    referenceId: req.body.referenceId,
    notes: req.body.notes,
    performedById: req.user?.userId,
  });
  res.status(201).json({ success: true, data: movement });
}));

// ── Low stock ──

router.get('/low-stock', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const items = await getLowStockItems(restaurantId);
  res.json({ success: true, data: items });
}));

// ── Suppliers ──

router.get('/suppliers', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const suppliers = await prisma.supplier.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { purchaseOrders: true } } },
  });
  res.json({ success: true, data: suppliers });
}));

router.post('/suppliers', auditLog, validate(createSupplierSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const supplier = await prisma.supplier.create({
    data: { restaurantId, ...req.body, email: req.body.email || null },
  });
  res.status(201).json({ success: true, data: supplier });
}));

router.put('/suppliers/:id', auditLog, validate(updateSupplierSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const existing = await prisma.supplier.findFirst({ where: { id, restaurantId } });
  if (!existing) throw new NotFoundError('Supplier not found', 'Mwasilishaji hakupatikana');

  const updated = await prisma.supplier.update({
    where: { id },
    data: { ...req.body, email: req.body.email === undefined ? undefined : (req.body.email || null) },
  });
  res.json({ success: true, data: updated });
}));

router.delete('/suppliers/:id', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const existing = await prisma.supplier.findFirst({ where: { id, restaurantId } });
  if (!existing) throw new NotFoundError('Supplier not found', 'Mwasilishaji hakupatikana');

  const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
  if (poCount > 0) {
    throw new ConflictError('Supplier has purchase orders and cannot be deleted — deactivate instead', 'Mwasilishaji huyu ana agizo za ununuzi — zima badala yake');
  }

  await prisma.supplier.delete({ where: { id } });
  res.json({ success: true, data: { message: 'Supplier deleted' } });
}));

// ── Purchase orders ──

router.get('/purchase-orders', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const status = req.query.status as string | undefined;

  const where: any = { restaurantId };
  if (status) where.status = status;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: { item: { select: { id: true, name: true, unit: true } } },
      },
    },
  });

  res.json({
    success: true,
    data: orders.map((po) => ({
      ...po,
      items: po.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitCost: Number(i.unitCost),
        receivedQty: Number(i.receivedQty),
      })),
    })),
  });
}));

router.get('/purchase-orders/:id', validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, restaurantId },
    include: {
      supplier: { select: { id: true, name: true, phone: true } },
      items: { include: { item: { select: { id: true, name: true, unit: true } } } },
    },
  });
  if (!po) throw new NotFoundError('Purchase order not found', 'Agizo la ununuzi halikupatikana');

  res.json({
    success: true,
    data: {
      ...po,
      items: po.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitCost: Number(i.unitCost), receivedQty: Number(i.receivedQty) })),
    },
  });
}));

router.post('/purchase-orders', auditLog, validate(createPurchaseOrderSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const { supplierId, expectedDelivery, notes, items } = req.body;

  const po = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        restaurantId,
        supplierId: supplierId || null,
        orderNumber: `PO-${generateOrderNumber(restaurantId)}`,
        status: 'DRAFT',
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
        notes: notes || null,
        createdById: req.user?.userId,
      },
    });
    await tx.purchaseOrderItem.createMany({
      data: items.map((i: any) => ({
        purchaseOrderId: created.id,
        itemId: i.itemId,
        quantity: i.quantity,
        unitCost: i.unitCost,
      })),
    });
    return created;
  });

  logger.info('Purchase order created', { purchaseOrderId: po.id, restaurantId, itemCount: items.length });
  res.status(201).json({ success: true, data: po });
}));

router.put('/purchase-orders/:id', auditLog, validate(updatePurchaseOrderSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const po = await prisma.purchaseOrder.findFirst({ where: { id, restaurantId }, include: { items: true } });
  if (!po) throw new NotFoundError('Purchase order not found', 'Agizo la ununuzi halikupatikana');

  if (po.status === 'RECEIVED') {
    throw new ConflictError('Received purchase orders cannot be modified', 'Agizo lililopokelewa haliwezi kubadilishwa');
  }

  const { status, items, ...fields } = req.body;

  const updated = await prisma.$transaction(async (tx) => {
    if (items && po.status === 'DRAFT') {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderItem.createMany({
        data: items.map((i: any) => ({
          purchaseOrderId: id,
          itemId: i.itemId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      });
    }
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        ...fields,
        supplierId: fields.supplierId === undefined ? undefined : (fields.supplierId || null),
        expectedDelivery: fields.expectedDelivery === undefined ? undefined : (fields.expectedDelivery ? new Date(fields.expectedDelivery) : null),
        status: status || undefined,
      },
    });
  });

  res.json({ success: true, data: updated });
}));

router.post('/purchase-orders/:id/receive', auditLog, validate(receivePurchaseOrderSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const result = await receivePurchaseOrder(id, restaurantId, req.user?.userId, (req as any).body?.receivedQty);
  res.json({ success: true, data: result });
}));

export default router;
