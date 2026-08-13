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
import { assertCanCreateMenuItem, assertCanCreateTable, getSubscriptionSummary } from '../src/services/subscription.service';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

async function setupTenant() {
  const owner = await createTestOwner();
  const restaurant = await createTestRestaurant(owner.id);
  const token = generateTestToken(owner.id, 'owner', restaurant.id);
  return { owner, restaurant, token };
}

describe('PLAN ENFORCEMENT', () => {
  it('rejects creating a menu item beyond the plan limit (409)', async () => {
    const { restaurant, token } = await setupTenant();
    const planId = uuidv4();

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: restaurant.id, planId, subscriptionStatus: 'ACTIVE', trialEndsAt: null, planExpiresAt: null, isSuspended: false,
    });
    (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({
      id: planId, name: 'Starter', maxMenuItems: 20, maxTables: 10,
      hasOrdering: true, hasAnalytics: false, hasSurveillance: false, hasUssd: false, hasMultiBranch: false,
    });
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(20);

    const res = await request(app)
      .post('/api/v1/menu/items')
      .set(getAuthHeader(token))
      .send({ categoryId: uuidv4(), name: 'Extra Item', description: 'd', price: 100 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(prisma.menuItem.create).not.toHaveBeenCalled();
  });

  it('allows creating a menu item within the plan limit', async () => {
    const { restaurant, token } = await setupTenant();
    const planId = uuidv4();

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: restaurant.id, planId, subscriptionStatus: 'ACTIVE', trialEndsAt: null, planExpiresAt: null, isSuspended: false,
    });
    (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({
      id: planId, name: 'Business', maxMenuItems: 50, maxTables: 25,
      hasOrdering: true, hasAnalytics: true, hasSurveillance: false, hasUssd: false, hasMultiBranch: false,
    });
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(10);
    (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), restaurantId: restaurant.id });
    (prisma.menuItem.aggregate as jest.Mock).mockResolvedValue({ _max: { sortOrder: 0 } });
    (prisma.menuItem.create as jest.Mock).mockResolvedValue({ id: uuidv4(), name: 'Ok Item' });

    const res = await request(app)
      .post('/api/v1/menu/items')
      .set(getAuthHeader(token))
      .send({ categoryId: uuidv4(), name: 'Ok Item', description: 'd', price: 100 });

    expect(res.status).toBe(201);
  });

  it('rejects creating a table beyond the plan limit (409)', async () => {
    const { restaurant, token } = await setupTenant();
    const planId = uuidv4();

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: restaurant.id, planId, subscriptionStatus: 'ACTIVE', trialEndsAt: null, planExpiresAt: null, isSuspended: false,
    });
    (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({
      id: planId, name: 'Starter', maxMenuItems: 20, maxTables: 10,
      hasOrdering: true, hasAnalytics: false, hasSurveillance: false, hasUssd: false, hasMultiBranch: false,
    });
    (prisma.restaurantTable.count as jest.Mock).mockResolvedValue(10);

    const res = await request(app)
      .post('/api/v1/restaurant/me/tables')
      .set(getAuthHeader(token))
      .send({ tableNumber: 11, label: 'Table 11', capacity: 4 });

    expect(res.status).toBe(409);
    expect(prisma.restaurantTable.create).not.toHaveBeenCalled();
  });

  it('blocks creation when the restaurant is suspended', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: restaurant.id, planId: uuidv4(), subscriptionStatus: 'SUSPENDED', trialEndsAt: null, planExpiresAt: null, isSuspended: true,
    });

    const res = await request(app)
      .post('/api/v1/menu/items')
      .set(getAuthHeader(token))
      .send({ categoryId: uuidv4(), name: 'Blocked', description: 'd', price: 100 });

    expect(res.status).toBe(409);
  });
});

describe('SUBSCRIPTION SUMMARY', () => {
  it('returns plan, limits and usage', async () => {
    const { restaurant, token } = await setupTenant();
    const planId = uuidv4();

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: restaurant.id, planId, subscriptionStatus: 'ACTIVE', trialEndsAt: new Date(), planExpiresAt: new Date(), isSuspended: false,
    });
    (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({
      id: planId, name: 'Business', priceMonthlyKes: 3500, priceYearlyKes: 35000,
      maxMenuItems: 50, maxTables: 25, hasOrdering: true, hasAnalytics: true, hasSurveillance: true, hasUssd: true, hasMultiBranch: false,
    });
    (prisma.menuItem.count as jest.Mock).mockResolvedValue(14);
    (prisma.restaurantTable.count as jest.Mock).mockResolvedValue(9);
    (prisma.restaurantBranch.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/restaurant/me/subscription')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.plan.name).toBe('Business');
    expect(res.body.data.plan.priceMonthlyKes).toBe(3500);
    expect(res.body.data.usage.menuItems).toBe(14);
    expect(res.body.data.usage.tables).toBe(9);
    expect(res.body.data.plan.features.analytics).toBe(true);
  });
});

describe('PUBLIC PLANS', () => {
  it('returns active plans without authentication', async () => {
    (prisma.subscriptionPlan.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), name: 'Starter', priceMonthlyKes: 1500, priceYearlyKes: 15000, maxMenuItems: 20, maxTables: 10, hasOrdering: true, hasAnalytics: false, hasSurveillance: false, hasUssd: false, hasMultiBranch: false, isActive: true },
    ]);

    const res = await request(app).get('/api/v1/menu/public/plans');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].priceMonthlyKes).toBe(1500);
  });
});
