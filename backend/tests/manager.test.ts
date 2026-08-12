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
import { detectIntent, getForecast } from '../src/services/manager.service';
import { generateDailyBriefing, answerQuestion } from '../src/services/ai-manager.service';

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

describe('INTENT DETECTION', () => {
  it('maps questions to the right tools', () => {
    expect(detectIntent('How did we perform this month?')).toBe('sales');
    expect(detectIntent('What is our most profitable dish?')).toBe('profit');
    expect(detectIntent('Which stock is running low?')).toBe('inventory');
    expect(detectIntent('How many customers came back this month?')).toBe('customers');
    expect(detectIntent('Forecast next week sales')).toBe('forecast');
    expect(detectIntent('How did the campaign perform?')).toBe('campaigns');
    expect(detectIntent('Who served the most orders?')).toBe('staff');
    expect(detectIntent('Tell me a joke')).toBeNull();
  });
});

describe('MANAGER ANSWER', () => {
  it('returns a helpful menu for unknown intents without calling the LLM', async () => {
    const { restaurant } = await setupTenant();
    const result = await answerQuestion(restaurant.id, 'What is the meaning of life?');
    expect(result.toolUsed).toBeNull();
    expect(result.source).toBe('tool');
    expect(result.reply).toContain('sales');
    expect(prisma.aiUsageLog.create).not.toHaveBeenCalled();
  });

  it('runs the tool and returns structured data for a known intent', async () => {
    const { restaurant } = await setupTenant();
    // sales summary path: order aggregates + top items + menu items
    (prisma.order.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { totalAmount: 25000 }, _count: { id: 40 } }) // current
      .mockResolvedValueOnce({ _sum: { totalAmount: 20000 }, _count: { id: 35 } }); // previous
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
      { menuItemId: 'item-1', _sum: { quantity: 30 } },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([{ id: 'item-1', name: 'Biryani' }]);
    // budget check
    (prisma.aiUsageLog.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalTokens: 1000 } });

    const result = await answerQuestion(restaurant.id, 'How much did we make this month?');

    expect(result.toolUsed).toBe('sales');
    expect(result.reply).toContain('Biryani');
  });
});

describe('DAILY BRIEFING', () => {
  it('produces insights with reasons and sources', async () => {
    const { restaurant } = await setupTenant();
    const itemId = uuidv4();

    (prisma.order.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { totalAmount: 87420 }, _count: { id: 76 } }) // yesterday
      .mockResolvedValueOnce({ _sum: { totalAmount: 80600 }, _count: { id: 70 } }); // week ago
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
      { menuItemId: itemId, _sum: { quantity: 24 } },
    ]);
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([
      { menuItemId: itemId, isActive: true, ingredients: [{ quantity: 1, unitCostSnapshot: 400 }] },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: itemId, name: 'Chicken Shawarma', price: 900 },
    ]);
    // inventory low stock
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);

    const briefing = await generateDailyBriefing(restaurant.id, new Date());

    expect(briefing.revenue).toBe(87420);
    expect(briefing.orders).toBe(76);
    expect(briefing.changePct).toBe(8.5); // 87420 vs 80600
    const insightTitles = briefing.insights.map((i: any) => i.title).join(' | ');
    expect(insightTitles).toContain('Chicken Shawarma');
    expect(briefing.insights[0].reason).toBeDefined();
    expect(briefing.insights[0].source).toBeDefined();
  });
});

describe('FORECAST', () => {
  it('returns day-by-day estimates with confidence levels', async () => {
    const { restaurant } = await setupTenant();
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 5000 } });

    const forecast = await getForecast(restaurant.id, 3);

    expect(forecast.days).toHaveLength(3);
    expect(forecast.days[0]).toHaveProperty('expected');
    expect(forecast.days[0]).toHaveProperty('confidence');
    expect(['High', 'Moderate', 'Low']).toContain(forecast.days[0].confidence);
  });
});

describe('MANAGER API', () => {
  it('answers via POST /ai/manager/ask', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.order.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { totalAmount: 1000 }, _count: { id: 5 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 800 }, _count: { id: 4 } });
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.aiUsageLog.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalTokens: 500 } });

    const res = await request(app)
      .post('/api/v1/ai/manager/ask')
      .set(getAuthHeader(token))
      .send({ message: 'How did sales go this month?' });

    expect(res.status).toBe(200);
    expect(res.body.data.toolUsed).toBe('sales');
  });

  it('returns the briefing via GET /ai/manager/briefing', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.order.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { totalAmount: 0 }, _count: { id: 0 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/ai/manager/briefing')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.insights).toBeDefined();
    expect(res.body.data.date).toBeDefined();
  });
});
