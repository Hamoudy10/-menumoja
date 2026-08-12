import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  redis,
  createTestOwner,
  createTestRestaurant,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';
import {
  verifyGrounding,
  computeMenuFingerprint,
  estimateCostKes,
  estimateTokens,
  isWithinDailyBudget,
  getCachedReply,
  setCachedReply,
} from '../src/services/ai-usage.service';

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

describe('GROUNDING VERIFICATION', () => {
  it('passes replies whose prices exist in the menu', () => {
    const prices = [500, 850, 1200];
    expect(verifyGrounding('Our biryani is KES 850 — a favourite!', prices)).toBe(true);
    expect(verifyGrounding('The platter costs KES 1,200 for two.', prices)).toBe(true);
    expect(verifyGrounding('No price mentioned at all.', prices)).toBe(true);
  });

  it('rejects invented prices', () => {
    const prices = [500, 850, 1200];
    expect(verifyGrounding('Try our special for only KES 300!', prices)).toBe(false);
    expect(verifyGrounding('The combo is KES 2,500.', prices)).toBe(false);
  });
});

describe('COST ESTIMATION', () => {
  it('estimates tokens and KES cost from usage', () => {
    expect(estimateTokens('abcd')).toBe(1);
    const cost = estimateCostKes('deepseek', 1000, 200);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.1); // deepseek is cheap
  });
});

describe('CACHE', () => {
  it('round-trips replies through the cache', async () => {
    (redis.get as jest.Mock).mockResolvedValue('cached reply');
    expect(await getCachedReply('k')).toBe('cached reply');

    await setCachedReply('k2', 'hello');
    expect(redis.set).toHaveBeenCalledWith('k2', 'hello', 'EX', 3600);
  });

  it('produces a stable fingerprint that changes when the menu changes', () => {
    const a = computeMenuFingerprint([{ name: 'Biryani', price: 850 }, { name: 'Chai', price: 100 }]);
    const b = computeMenuFingerprint([{ name: 'Biryani', price: 850 }, { name: 'Chai', price: 100 }]);
    const c = computeMenuFingerprint([{ name: 'Biryani', price: 900 }, { name: 'Chai', price: 100 }]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('DAILY BUDGET', () => {
  it('is within budget when usage is below the cap', async () => {
    const { restaurant } = await setupTenant();
    (prisma.aiUsageLog.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalTokens: 10_000 } });
    expect(await isWithinDailyBudget(restaurant.id)).toBe(true);
  });

  it('blocks the LLM when the daily budget is exhausted', async () => {
    const { restaurant } = await setupTenant();
    (prisma.aiUsageLog.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalTokens: 500_000 } });
    expect(await isWithinDailyBudget(restaurant.id)).toBe(false);
  });
});

describe('USAGE API', () => {
  it('returns a scoped token/cost summary for the owner', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.aiUsageLog.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalTokens: 12000, estimatedCostKes: 0.034 },
      _count: { id: 8 },
    });
    (prisma.aiUsageLog.groupBy as jest.Mock).mockResolvedValue([
      { feature: 'CUSTOMER_CHAT', _count: { id: 7 }, _sum: { totalTokens: 11000, estimatedCostKes: 0.03 } },
      { feature: 'DESCRIPTION', _count: { id: 1 }, _sum: { totalTokens: 1000, estimatedCostKes: 0.004 } },
    ]);

    const res = await request(app)
      .get('/api/v1/ai/usage?period=week')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.requests).toBe(8);
    expect(res.body.data.totalTokens).toBe(12000);
    expect(res.body.data.byFeature).toHaveLength(2);
    expect(res.body.data.dailyTokenBudget).toBeGreaterThan(0);
  });

  it('is tenant-scoped', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.aiUsageLog.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalTokens: 0, estimatedCostKes: 0 }, _count: { id: 0 } });
    (prisma.aiUsageLog.groupBy as jest.Mock).mockResolvedValue([]);

    await request(app)
      .get('/api/v1/ai/usage')
      .set(getAuthHeader(token));

    const where = (prisma.aiUsageLog.aggregate as jest.Mock).mock.calls[0][0].where;
    expect(where.restaurantId).toBe(restaurant.id);
  });
});

describe('USAGE LOGGING', () => {
  it('logs every LLM call with tokens and cost', async () => {
    const { restaurant } = await setupTenant();
    const { recordAiUsage } = await import('../src/services/ai-usage.service');
    (prisma.aiUsageLog.create as jest.Mock).mockResolvedValue({});

    await recordAiUsage({
      restaurantId: restaurant.id,
      feature: 'CUSTOMER_CHAT',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 1000,
      completionTokens: 200,
      latencyMs: 512,
    });

    expect(prisma.aiUsageLog.create).toHaveBeenCalledTimes(1);
    const data = (prisma.aiUsageLog.create as jest.Mock).mock.calls[0][0].data;
    expect(data.totalTokens).toBe(1200);
    expect(data.promptVersion).toBeDefined();
    expect(data.cached).toBe(false);
  });
});
