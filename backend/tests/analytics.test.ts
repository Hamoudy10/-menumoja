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

describe('GET /api/v1/analytics/overview', () => {
  it('should return metrics', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), restaurantId: restaurant.id, totalAmount: 1200, createdAt: new Date(), status: 'SERVED' },
      { id: uuidv4(), restaurantId: restaurant.id, totalAmount: 800, createdAt: new Date(), status: 'SERVED' },
    ]);
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), restaurantId: restaurant.id, amount: 1200, paymentMethod: 'MPESA', createdAt: new Date() },
      { id: uuidv4(), restaurantId: restaurant.id, amount: 800, paymentMethod: 'CASH', createdAt: new Date() },
    ]);
    (prisma.qrScan.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), restaurantId: restaurant.id, scannedAt: new Date(), sessionId: 'sess-1', deviceType: 'mobile' },
      { id: uuidv4(), restaurantId: restaurant.id, scannedAt: new Date(), sessionId: 'sess-2', deviceType: 'desktop' },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), name: 'Pilau', totalOrders: 25 },
    ]);
    (prisma.analyticsDaily.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set(getAuthHeader(token))
      .query({ period: 'month' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.metrics.totalRevenue).toBe(2000);
    expect(res.body.data.metrics.totalOrders).toBe(2);
    expect(res.body.data.metrics.totalScans).toBe(2);
  });
});

describe('GET /api/v1/analytics/revenue', () => {
  it('should return revenue data', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: uuidv4(),
        restaurantId: restaurant.id,
        amount: 5000,
        paymentMethod: 'MPESA',
        createdAt: new Date('2025-01-15T10:00:00Z'),
      },
      {
        id: uuidv4(),
        restaurantId: restaurant.id,
        amount: 3000,
        paymentMethod: 'CASH',
        createdAt: new Date('2025-01-15T14:00:00Z'),
      },
      {
        id: uuidv4(),
        restaurantId: restaurant.id,
        amount: 2000,
        paymentMethod: 'MPESA',
        createdAt: new Date('2025-01-16T12:00:00Z'),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .set(getAuthHeader(token))
      .query({
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-31T23:59:59.999Z',
        groupBy: 'day',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
