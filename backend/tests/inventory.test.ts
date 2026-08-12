import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

async function setupTenant() {
  const owner = await createTestOwner();
  const restaurant = await createTestRestaurant(owner.id);
  return { owner, restaurant, token: generateTestToken(owner.id, 'owner', restaurant.id) };
}

describe('INVENTORY ITEMS', () => {
  it('creates an inventory item', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.inventoryItem.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), restaurantId: restaurant.id, name: 'Chicken Breast', unit: 'KG', reorderLevel: 10,
    });

    const res = await request(app)
      .post('/api/v1/inventory/items')
      .set(getAuthHeader(token))
      .send({ name: 'Chicken Breast', unit: 'KG', reorderLevel: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Chicken Breast');
  });

  it('lists items with computed stock levels and low-stock flags', async () => {
    const { restaurant, token } = await setupTenant();
    const itemA = uuidv4();
    const itemB = uuidv4();
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: itemA, restaurantId: restaurant.id, name: 'Chicken', unit: 'KG', reorderLevel: 10, minStock: 0, maxStock: null, isActive: true },
      { id: itemB, restaurantId: restaurant.id, name: 'Beef', unit: 'KG', reorderLevel: 5, minStock: 0, maxStock: null, isActive: true },
    ]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([
      { itemId: itemA, _sum: { quantity: 12 } },
      { itemId: itemB, _sum: { quantity: 2 } },
    ]);

    const res = await request(app)
      .get('/api/v1/inventory/items')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ name: 'Chicken', stock: 12, lowStock: false });
    expect(res.body.data[1]).toMatchObject({ name: 'Beef', stock: 2, lowStock: true });
  });

  it('prevents deleting an item with movement history', async () => {
    const { restaurant, token } = await setupTenant();
    const itemA = uuidv4();
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: itemA, restaurantId: restaurant.id });
    (prisma.stockMovement.count as jest.Mock).mockResolvedValue(5);

    const res = await request(app)
      .delete(`/api/v1/inventory/items/${itemA}`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(409);
    expect(prisma.inventoryItem.delete).not.toHaveBeenCalled();
  });
});

describe('STOCK MOVEMENTS', () => {
  it('records a purchase movement (stock in)', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), restaurantId: restaurant.id });
    (prisma.stockMovement.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), itemId: uuidv4(), type: 'PURCHASE', quantity: 50, unitCost: 300,
    });

    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set(getAuthHeader(token))
      .send({ itemId: uuidv4(), type: 'PURCHASE', quantity: 50, unitCost: 300, referenceType: 'MANUAL' });

    expect(res.status).toBe(201);
    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 50, referenceType: 'MANUAL' }),
      })
    );
  });

  it('rejects a consumption movement when stock is insufficient', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), restaurantId: restaurant.id });
    (prisma.stockMovement.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 5 } });

    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set(getAuthHeader(token))
      .send({ itemId: uuidv4(), type: 'WASTE', quantity: -10, referenceType: 'MANUAL' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects consumption movements with a positive quantity', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), restaurantId: restaurant.id });

    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set(getAuthHeader(token))
      .send({ itemId: uuidv4(), type: 'SALE', quantity: 10, referenceType: 'MANUAL' });

    expect(res.status).toBe(422);
  });
});

describe('SUPPLIERS', () => {
  it('creates and lists suppliers tenant-scoped', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.supplier.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), restaurantId: restaurant.id, name: 'Coast Fresh Foods',
    });
    (prisma.supplier.findMany as jest.Mock).mockResolvedValue([]);

    const create = await request(app)
      .post('/api/v1/inventory/suppliers')
      .set(getAuthHeader(token))
      .send({ name: 'Coast Fresh Foods', phone: '+254700000000' });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get('/api/v1/inventory/suppliers')
      .set(getAuthHeader(token));
    expect(list.status).toBe(200);
  });
});

describe('PURCHASE ORDERS', () => {
  it('creates a purchase order with items', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue({
      id: 'po-1', restaurantId: restaurant.id, orderNumber: 'PO-ORD-1', status: 'DRAFT',
    });
    (prisma.purchaseOrderItem.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/v1/inventory/purchase-orders')
      .set(getAuthHeader(token))
      .send({
        supplierId: null,
        items: [{ itemId: uuidv4(), quantity: 20, unitCost: 350 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('receiving a purchase order creates purchase movements', async () => {
    const { restaurant, token } = await setupTenant();
    const poId = uuidv4();
    const itemId = uuidv4();
    const poItemId = uuidv4();

    (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
      id: poId, restaurantId: restaurant.id, status: 'ORDERED', orderNumber: 'PO-100',
      items: [{ id: poItemId, itemId, quantity: 20, unitCost: 350, receivedQty: 0 }],
    });
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: itemId, restaurantId: restaurant.id });
    (prisma.stockMovement.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), itemId, type: 'PURCHASE', quantity: 20,
    });
    (prisma.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
      id: poId, status: 'RECEIVED', items: [], supplier: null,
    });

    const res = await request(app)
      .post(`/api/v1/inventory/purchase-orders/${poId}/receive`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(prisma.stockMovement.create).toHaveBeenCalledTimes(1);
    const movementData = (prisma.stockMovement.create as jest.Mock).mock.calls[0][0].data;
    expect(movementData.type).toBe('PURCHASE');
    expect(movementData.quantity).toBe(20);
    expect(movementData.unitCost).toBe(350);
    expect(movementData.referenceType).toBe('PURCHASE_ORDER');
    expect(movementData.referenceId).toBe('PO-100');
  });
});
