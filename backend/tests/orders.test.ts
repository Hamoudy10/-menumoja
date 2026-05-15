import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  createTestCategory,
  createTestMenuItem,
  createTestTable,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

describe('POST /api/v1/orders/public/create', () => {
  it('should create order', async () => {
    const restaurant = await createTestRestaurant(uuidv4());
    const category = await createTestCategory(restaurant.id);
    const item = await createTestMenuItem(category.id, restaurant.id, {
      price: 500,
      preparationTimeMinutes: 15,
    });

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(restaurant);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: item.id, name: item.name, price: 500, preparationTimeMinutes: 15 },
    ]);
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      orderNumber: 'ORD-TEST-001',
      restaurantId: restaurant.id,
      sessionId: 'test-session',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal: 500,
      serviceCharge: 25,
      taxAmount: 80,
      tipAmount: 0,
      totalAmount: 605,
      specialNotes: null,
      estimatedPrepMinutes: 15,
      createdAt: new Date(),
      items: [{ id: uuidv4(), itemName: item.name, quantity: 1, itemPrice: 500, subtotal: 500 }],
    });

    const res = await request(app)
      .post('/api/v1/orders/public/create')
      .send({
        restaurantId: restaurant.id,
        sessionId: 'test-session',
        items: [{ menuItemId: item.id, quantity: 1 }],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBeDefined();
    expect(res.body.data.orderNumber).toBeDefined();
  });

  it('should fail with invalid item', async () => {
    const restaurant = await createTestRestaurant(uuidv4());
    const invalidItemId = uuidv4();

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(restaurant);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/orders/public/create')
      .send({
        restaurantId: restaurant.id,
        sessionId: 'test-session',
        items: [{ menuItemId: invalidItemId, quantity: 1 }],
      })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/orders/public/:id/status', () => {
  it('should return order status', async () => {
    const orderId = uuidv4();

    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: orderId,
      orderNumber: 'ORD-TEST-001',
      status: 'PREPARING',
      paymentStatus: 'UNPAID',
      estimatedPrepMinutes: 15,
      confirmedAt: new Date(),
      createdAt: new Date(),
      items: [
        { id: uuidv4(), itemName: 'Chicken Biryani', quantity: 1, itemPrice: 500, subtotal: 500 },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/orders/public/${orderId}/status`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PREPARING');
  });
});

describe('GET /api/v1/orders/live', () => {
  it('should return active orders', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'manager', restaurant.id);

    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        id: uuidv4(),
        orderNumber: 'ORD-001',
        tableNumber: 3,
        status: 'PREPARING',
        totalAmount: 1200,
        confirmedAt: new Date(),
        createdAt: new Date(Date.now() - 300000),
        updatedAt: new Date(),
        estimatedPrepMinutes: 15,
        items: [{ id: uuidv4(), itemName: 'Pizza', quantity: 1 }],
        waiter: null,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/orders/live')
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('PUT /api/v1/orders/:id/status', () => {
  it('should update status', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'manager', restaurant.id);
    const orderId = uuidv4();

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId,
      restaurantId: restaurant.id,
      status: 'PENDING',
      payments: [],
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({
      id: orderId,
      orderNumber: 'ORD-001',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      confirmedAt: new Date(),
      preparedAt: null,
      servedAt: null,
      cancelledAt: null,
      cancelledReason: null,
    });

    const res = await request(app)
      .put(`/api/v1/orders/${orderId}/status`)
      .set(getAuthHeader(token))
      .send({ status: 'confirmed' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('should reject invalid transitions', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'manager', restaurant.id);
    const orderId = uuidv4();

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId,
      restaurantId: restaurant.id,
      status: 'SERVED',
      payments: [],
    });

    const res = await request(app)
      .put(`/api/v1/orders/${orderId}/status`)
      .set(getAuthHeader(token))
      .send({ status: 'preparing' })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/orders/export', () => {
  it('should export CSV', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        orderNumber: 'ORD-001',
        tableNumber: 3,
        totalAmount: 1200,
        status: 'SERVED',
        paymentMethod: 'CASH',
        createdAt: new Date('2025-01-15'),
        items: [{ itemName: 'Pizza', quantity: 2 }],
        payments: [{ paymentMethod: 'CASH' }],
      },
    ]);

    const res = await request(app)
      .get('/api/v1/orders/export')
      .set(getAuthHeader(token))
      .query({ startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-31T23:59:59.999Z' })
      .expect(200);

    expect(res.headers['content-type']).toBe('text/csv');
    expect(res.text).toContain('ORD-001');
  });
});
