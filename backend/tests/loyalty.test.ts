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
import { processPaidOrder, redeemReward, applyPoints } from '../src/services/loyalty.service';

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

const baseCustomer = {
  customerId: 'cust-1',
  totalVisits: 10,
  totalSpend: 25000,
  firstVisit: new Date(Date.now() - 300 * 86400000),
  lastVisit: new Date(Date.now() - 1 * 86400000),
  dateOfBirth: null,
};

describe('LOYALTY PROGRAM & RULES', () => {
  it('creates and updates the loyalty program', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.loyaltyProgram.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.loyaltyProgram.create as jest.Mock).mockResolvedValue({ id: uuidv4(), restaurantId: restaurant.id, pointsPerKes: 1 });
    (prisma.loyaltyProgram.update as jest.Mock).mockResolvedValue({ id: uuidv4(), pointsPerKes: 2 });

    const get = await request(app)
      .get('/api/v1/loyalty/program')
      .set(getAuthHeader(token));
    expect(get.status).toBe(200);

    const put = await request(app)
      .put('/api/v1/loyalty/program')
      .set(getAuthHeader(token))
      .send({ pointsPerKes: 2, name: 'Bahari Rewards' });
    expect(put.status).toBe(200);
  });

  it('creates a rule with trigger/reward/usage limit', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.loyaltyRule.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), restaurantId: restaurant.id, name: '5th Visit Free Chai', triggerType: 'VISIT_COUNT', triggerValue: '5', rewardType: 'FREE_ITEM', rewardValue: '0', usageLimit: 1,
    });

    const res = await request(app)
      .post('/api/v1/loyalty/rules')
      .set(getAuthHeader(token))
      .send({ name: '5th Visit Free Chai', triggerType: 'VISIT_COUNT', triggerValue: 5, rewardType: 'FREE_ITEM', rewardValue: 0, usageLimit: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.triggerType).toBe('VISIT_COUNT');
  });
});

describe('POINTS LEDGER', () => {
  it('earns points from spend with an immutable ledger row', async () => {
    const { restaurant } = await setupTenant();
    (prisma.loyaltyProgram.findUnique as jest.Mock).mockResolvedValue({ restaurantId: restaurant.id, isActive: true, pointsPerKes: 10 });
    (prisma.loyaltyRule.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.loyaltyAccount.create as jest.Mock).mockResolvedValue({ id: 'account-1', restaurantId: restaurant.id, customerId: 'cust-1', pointsBalance: 0 });
    (prisma.loyaltyTransaction.create as jest.Mock).mockResolvedValue({});
    (prisma.loyaltyAccount.update as jest.Mock).mockResolvedValue({ id: 'account-1', pointsBalance: 80 });

    const result = await processPaidOrder(
      restaurant.id,
      { orderId: 'order-1', orderNumber: 'ORD-1', totalAmount: 850, createdAt: new Date(), items: [] },
      baseCustomer as any
    );

    expect(result.pointsEarned).toBe(85);
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledTimes(1);
    const txData = (prisma.loyaltyTransaction.create as jest.Mock).mock.calls[0][0].data;
    expect(txData.points).toBe(85);
    expect(txData.type).toBe('EARN');
    expect(txData.referenceType).toBe('ORDER');
  });

  it('rejects redemption exceeding the balance', async () => {
    const { restaurant } = await setupTenant();
    (prisma.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', restaurantId: restaurant.id, customerId: 'c1', pointsBalance: 50 });
    (prisma.loyaltyAccount.create as jest.Mock).mockResolvedValue({});

    await expect(applyPoints(restaurant.id, 'c1', -100, 'REDEEM' as any, 'test'))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('RULE EVALUATION & ABUSE PREVENTION', () => {
  it('issues a FREE_ITEM reward when the visit-count rule matches', async () => {
    const { restaurant } = await setupTenant();
    (prisma.loyaltyProgram.findUnique as jest.Mock).mockResolvedValue({ restaurantId: restaurant.id, isActive: true, pointsPerKes: 0 });
    (prisma.loyaltyRule.findMany as jest.Mock).mockResolvedValue([
      { id: 'rule-1', restaurantId: restaurant.id, name: '5th Visit', triggerType: 'VISIT_COUNT', triggerValue: '5', rewardType: 'FREE_ITEM', rewardValue: 'chai-id', rewardItemId: 'chai-id', rewardQuantity: 1, usageLimit: 1, startsAt: null, endsAt: null },
    ]);
    (prisma.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.loyaltyAccount.create as jest.Mock).mockResolvedValue({ id: 'account-1', restaurantId: restaurant.id, customerId: 'cust-1', pointsBalance: 0 });
    (prisma.loyaltyReward.count as jest.Mock).mockResolvedValue(0);
    (prisma.loyaltyReward.create as jest.Mock).mockResolvedValue({});

    const result = await processPaidOrder(
      restaurant.id,
      { orderId: 'order-1', orderNumber: 'ORD-1', totalAmount: 500, createdAt: new Date(), items: [] },
      baseCustomer as any
    );

    expect(result.rewardsIssued).toBe(1);
    const rewardData = (prisma.loyaltyReward.create as jest.Mock).mock.calls[0][0].data;
    expect(rewardData.rewardType).toBe('FREE_ITEM');
    expect(rewardData.itemId).toBe('chai-id');
  });

  it('does not exceed the per-customer usage limit (abuse prevention)', async () => {
    const { restaurant } = await setupTenant();
    (prisma.loyaltyProgram.findUnique as jest.Mock).mockResolvedValue({ restaurantId: restaurant.id, isActive: true, pointsPerKes: 0 });
    (prisma.loyaltyRule.findMany as jest.Mock).mockResolvedValue([
      { id: 'rule-1', restaurantId: restaurant.id, name: 'Win back', triggerType: 'INACTIVITY', triggerValue: '30', rewardType: 'DISCOUNT', rewardValue: '10', usageLimit: 1, startsAt: null, endsAt: null },
    ]);
    // account already exists
    (prisma.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue({ id: 'account-1', restaurantId: restaurant.id, customerId: 'cust-1', pointsBalance: 0 });
    // usage limit already hit
    (prisma.loyaltyReward.count as jest.Mock).mockResolvedValue(1);

    const result = await processPaidOrder(
      restaurant.id,
      { orderId: 'order-1', orderNumber: 'ORD-1', totalAmount: 500, createdAt: new Date(), items: [] },
      { ...baseCustomer, lastVisit: new Date(Date.now() - 45 * 86400000) } as any
    );

    expect(result.rewardsIssued).toBe(0);
    expect(prisma.loyaltyReward.create).not.toHaveBeenCalled();
  });

  it('matches ITEM_COUNT and CATEGORY_PURCHASE triggers from the order', async () => {
    const { restaurant } = await setupTenant();
    (prisma.loyaltyProgram.findUnique as jest.Mock).mockResolvedValue({ restaurantId: restaurant.id, isActive: true, pointsPerKes: 0 });
    (prisma.loyaltyRule.findMany as jest.Mock).mockResolvedValue([
      { id: 'rule-item', restaurantId: restaurant.id, name: 'Buy 2 Burgers', triggerType: 'ITEM_COUNT', triggerValue: 'burger-id', rewardType: 'BUNDLE', rewardValue: 'fries-id', rewardItemId: 'burger-id', rewardQuantity: 2, usageLimit: 1, startsAt: null, endsAt: null },
      { id: 'rule-cat', restaurantId: restaurant.id, name: 'Coffee Order', triggerType: 'CATEGORY_PURCHASE', triggerValue: 'Beverages', rewardType: 'POINTS', rewardValue: '50', usageLimit: 3, startsAt: null, endsAt: null },
    ]);
    (prisma.loyaltyAccount.findUnique as jest.Mock).mockResolvedValue({ id: 'account-1', restaurantId: restaurant.id, customerId: 'cust-1', pointsBalance: 0 });
    (prisma.loyaltyReward.count as jest.Mock).mockResolvedValue(0);
    (prisma.loyaltyReward.create as jest.Mock).mockResolvedValue({});
    (prisma.loyaltyTransaction.create as jest.Mock).mockResolvedValue({});
    (prisma.loyaltyAccount.update as jest.Mock).mockResolvedValue({});

    const result = await processPaidOrder(
      restaurant.id,
      {
        orderId: 'order-1', orderNumber: 'ORD-1', totalAmount: 700, createdAt: new Date(),
        items: [
          { menuItemId: 'burger-id', name: 'Beef Burger', quantity: 2, categoryName: 'Main Course' },
          { menuItemId: 'coffee-id', name: 'Black Coffee', quantity: 1, categoryName: 'Beverages' },
        ],
      },
      baseCustomer as any
    );

    // ITEM_COUNT matches → BUNDLE reward issued; CATEGORY_PURCHASE matches → POINTS credited.
    // Both rules matched, so rewardsIssued = 2; only one LoyaltyReward row + one ledger row.
    expect(result.rewardsIssued).toBe(2);
    expect(prisma.loyaltyReward.create).toHaveBeenCalledTimes(1);
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledTimes(1);
  });
});

describe('REWARD REDEMPTION', () => {
  it('redeems an issued reward exactly once', async () => {
    const { restaurant } = await setupTenant();
    const rewardId = uuidv4();
    (prisma.loyaltyReward.findFirst as jest.Mock).mockResolvedValue({
      id: rewardId, restaurantId: restaurant.id, status: 'ISSUED', expiresAt: null,
    });
    (prisma.loyaltyReward.update as jest.Mock).mockResolvedValue({ id: rewardId, status: 'REDEEMED', redeemedAt: new Date() });

    const res = await request(app)
      .post(`/api/v1/loyalty/rewards/${rewardId}/redeem`)
      .set(getAuthHeader(await setupTenant().then((t) => t.token)));

    expect(res.status).toBe(200);
    expect(prisma.loyaltyReward.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REDEEMED' }) })
    );
  });

  it('rejects double redemption', async () => {
    const { restaurant } = await setupTenant();
    const rewardId = uuidv4();
    (prisma.loyaltyReward.findFirst as jest.Mock).mockResolvedValue({
      id: rewardId, restaurantId: restaurant.id, status: 'REDEEMED', expiresAt: null,
    });

    await expect(redeemReward(restaurant.id, rewardId)).rejects.toMatchObject({ statusCode: 409 });
  });
});
