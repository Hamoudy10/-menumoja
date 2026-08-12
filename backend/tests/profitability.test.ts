import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  createTestMenuItem,
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
  const token = generateTestToken(owner.id, 'owner', restaurant.id);
  return { owner, restaurant, token };
}

describe('PROFITABILITY OVERVIEW', () => {
  it('computes revenue, net sales, estimated COGS, contribution and margin', async () => {
    const { restaurant, token } = await setupTenant();
    const itemA = uuidv4();

    // orderAgg: gross 2500 across 3 paid orders
    (prisma.order.aggregate as jest.Mock).mockResolvedValueOnce({ _sum: { totalAmount: 2500 }, _count: { id: 3 } });
    // paid payments: 2400 (100 discount given)
    (prisma.payment.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: 2400 } }) // paid
      .mockResolvedValueOnce({ _sum: { amount: 200 } }); // refunded
    // order items: 2 × itemA @ qty 2, 1 × itemB (no recipe)
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      { menuItemId: itemA, quantity: 2 },
      { menuItemId: itemA, quantity: 1 },
      { menuItemId: uuidv4(), quantity: 1 },
    ]);
    // active recipe for itemA: cost 200/unit
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), menuItemId: itemA, version: 1, isActive: true, ingredients: [{ quantity: 1, unitCostSnapshot: 200 }] },
    ]);

    const res = await request(app)
      .get('/api/v1/analytics/profitability/overview?period=month')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.grossSales).toBe(2500);
    expect(d.discounts).toBe(100);
    expect(d.refunds).toBe(200);
    expect(d.netSales).toBe(2200);
    expect(d.cogs).toBe(600); // 3 units × 200
    expect(d.contribution).toBe(1600);
    expect(d.marginPct).toBe(72.7); // 1600/2200
    expect(d.orderCount).toBe(3);
    expect(d.unitsSold).toBe(4);
    expect(d.averageOrderValue).toBe(733.33);
  });

  it('handles an empty period without crashing', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { id: 0 } });
    (prisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 0 } });
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/analytics/profitability/overview?period=week')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.netSales).toBe(0);
    expect(res.body.data.marginPct).toBe(0);
  });
});

describe('MENU ENGINEERING', () => {
  it('classifies items into STAR/PLOW HORSE/PUZZLE/DOG', async () => {
    const { restaurant, token } = await setupTenant();
    const starId = uuidv4();
    const plowId = uuidv4();
    const puzzleId = uuidv4();
    const dogId = uuidv4();

    // sales: star 50, plow 40, puzzle 2, dog 1 → popularity median = 21
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
      { menuItemId: starId, _sum: { quantity: 50 } },
      { menuItemId: plowId, _sum: { quantity: 40 } },
      { menuItemId: puzzleId, _sum: { quantity: 2 } },
      { menuItemId: dogId, _sum: { quantity: 1 } },
    ]);
    // prices
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: starId, name: 'Star Dish', price: 1000 },
      { id: plowId, name: 'Plow Dish', price: 500 },
      { id: puzzleId, name: 'Puzzle Dish', price: 2000 },
      { id: dogId, name: 'Dog Dish', price: 300 },
    ]);
    // recipe costs: star 200 (80% margin), plow 450 (10%), puzzle 400 (80%), dog 250 (16.7%)
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), menuItemId: starId, version: 1, isActive: true, ingredients: [{ quantity: 1, unitCostSnapshot: 200 }] },
      { id: uuidv4(), menuItemId: plowId, version: 1, isActive: true, ingredients: [{ quantity: 1, unitCostSnapshot: 450 }] },
      { id: uuidv4(), menuItemId: puzzleId, version: 1, isActive: true, ingredients: [{ quantity: 1, unitCostSnapshot: 400 }] },
      { id: uuidv4(), menuItemId: dogId, version: 1, isActive: true, ingredients: [{ quantity: 1, unitCostSnapshot: 250 }] },
    ]);

    const res = await request(app)
      .get('/api/v1/analytics/profitability/menu-engineering?period=month')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    const matrix = res.body.data.matrix as any[];
    const byId = (id: string) => matrix.find((m) => m.menuItemId === id);

    // popularity median over sold items: [1,2,40,50] → (2+40)/2 = 21
    // margins: [10, 16.7, 80, 80] → (16.7+80)/2 = 48.35
    expect(byId(starId).classification).toBe('STAR');       // 50 >= 21, 80 >= 48.35
    expect(byId(plowId).classification).toBe('PLOW_HORSE'); // 40 >= 21, 10 < 48.35
    expect(byId(puzzleId).classification).toBe('PUZZLE');   // 2 < 21, 80 >= 48.35
    expect(byId(dogId).classification).toBe('DOG');         // 1 < 21, 16.7 < 48.35

    expect(res.body.data.summary.STAR).toBe(1);
    expect(res.body.data.summary.DOG).toBe(1);
    expect(byId(starId).recommendation).toContain('Promote');
  });

  it('marks items without recipes as NO_COST_DATA without guessing', async () => {
    const { restaurant, token } = await setupTenant();
    const itemId = uuidv4();

    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([{ menuItemId: itemId, _sum: { quantity: 10 } }]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([{ id: itemId, name: 'No Recipe Dish', price: 500 }]);
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/analytics/profitability/menu-engineering?period=week')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.matrix[0].classification).toBe('NO_COST_DATA');
    expect(res.body.data.matrix[0].marginPct).toBeNull();
    expect(res.body.data.summary.NO_COST_DATA).toBe(1);
  });
});
