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
import { getCombinationStats, getUpsellSuggestions } from '../src/services/upsell.service';
import { getPersonalizedMenu } from '../src/services/menu-personalization.service';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
  // reset Once queues so no cross-test pollution
  (prisma.menuItem.findMany as jest.Mock).mockReset();
  (prisma.orderItem.groupBy as jest.Mock).mockReset();
  (prisma.orderItem.findMany as jest.Mock).mockReset();
  (prisma.promotion.findMany as jest.Mock).mockReset().mockResolvedValue([]);
  (prisma.stockMovement.findMany as jest.Mock).mockReset().mockResolvedValue([]);
  (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
});

async function setupTenant() {
  const owner = await createTestOwner();
  const restaurant = await createTestRestaurant(owner.id);
  return { owner, restaurant };
}

describe('BASKET ANALYSIS', () => {
  it('computes co-occurrence percentages for companions', async () => {
    const { restaurant } = await setupTenant();
    const burgerId = uuidv4();
    const friesId = uuidv4();
    const juiceId = uuidv4();

    // 10 orders contain the burger; fries appear in 6, juice in 3
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 10 }, () => ({ orderId: uuidv4() }))
    );
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
      { menuItemId: friesId, _count: { id: 6 } },
      { menuItemId: juiceId, _count: { id: 3 } },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: friesId, name: 'Fries' },
      { id: juiceId, name: 'Juice' },
    ]);

    const stats = await getCombinationStats(restaurant.id, burgerId, 4);

    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({ name: 'Fries', percentage: 60 });
    expect(stats[1]).toMatchObject({ name: 'Juice', percentage: 30 });
  });

  it('excludes cart items and unavailable items from suggestions', async () => {
    const { restaurant } = await setupTenant();
    const burgerId = uuidv4();
    const friesId = uuidv4();
    const juiceId = uuidv4();

    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([
      { orderId: uuidv4() }, { orderId: uuidv4() }, { orderId: uuidv4() }, { orderId: uuidv4() },
    ]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([
      { menuItemId: friesId, _count: { id: 3 } },
      { menuItemId: juiceId, _count: { id: 2 } },
    ]);
    // call 1 (cart=[burger]): names(burger) + availability → [fries]
    // call 2 (cart=[burger,fries]): names(burger) + names(fries) + availability
    (prisma.menuItem.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }, { id: juiceId, name: 'Juice' }])
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }])
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }, { id: juiceId, name: 'Juice' }])
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }, { id: juiceId, name: 'Juice' }])
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }]);

    // cart = [burger] only — fries is a valid companion
    const suggestions = await getUpsellSuggestions(restaurant.id, [burgerId], 3);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].name).toBe('Fries');

    // cart = [burger, fries] — fries is excluded as an existing cart item
    const suggestionsWithFriesInCart = await getUpsellSuggestions(restaurant.id, [burgerId, friesId], 3);
    expect(suggestionsWithFriesInCart).toHaveLength(0);
  });
});

describe('PERSONALIZED MENU', () => {
  it('returns aggregate sections for anonymous sessions only', async () => {
    const { restaurant } = await setupTenant();
    const itemId = uuidv4();

    (prisma.menuItem.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: itemId, name: 'Popular Dish', price: 500 }]) // mostPopular
      .mockResolvedValueOnce([{ id: itemId, name: 'New Dish', price: 400 }]); // newItems
    (prisma.promotion.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([{ id: itemId, name: 'Popular Dish', price: 500 }]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);

    const sections = await getPersonalizedMenu(restaurant.id, {});

    expect(sections.mostPopular).toHaveLength(1);
    // anonymous: no recommendation, no complete-your-meal
    expect(sections.recommendedForYou).toBeNull();
    expect(sections.completeYourMeal).toBeNull();
  });

  it('computes recommendations from the session order history', async () => {
    const { restaurant } = await setupTenant();
    const categoryId = uuidv4();
    const orderedItem = uuidv4();
    const candidateItem = uuidv4();

    // session orders → one order in the category
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { items: [{ menuItemId: orderedItem, menuItem: { categoryId } }] },
    ]);
    // recommended items query
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([
      { id: candidateItem, name: 'Suggested Dish', price: 600 },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([{ id: candidateItem, name: 'Suggested Dish', price: 600 }]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([{ id: candidateItem, name: 'Suggested Dish', price: 600 }]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([{ id: candidateItem, name: 'Suggested Dish', price: 600 }]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([{ id: candidateItem, name: 'Suggested Dish', price: 600 }]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValueOnce([{ id: candidateItem, name: 'Suggested Dish', price: 600 }]);
    (prisma.promotion.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);

    const sections = await getPersonalizedMenu(restaurant.id, { sessionId: 'session-1' });

    expect(sections.recommendedForYou).not.toBeNull();
    expect(sections.recommendedForYou![0].name).toBe('Suggested Dish');
  });
});

describe('PUBLIC API', () => {
  it('serves upsell suggestions for a cart', async () => {
    const { restaurant } = await setupTenant();
    const friesId = uuidv4();

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({ id: restaurant.id });
    (prisma.orderItem.findMany as jest.Mock).mockResolvedValue([{ orderId: uuidv4() }]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([{ menuItemId: friesId, _count: { id: 1 } }]);
    // names for stats → availability filter → final items for the response
    (prisma.menuItem.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }])
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries' }])
      .mockResolvedValueOnce([{ id: friesId, name: 'Fries', price: 250 }]);

    const res = await request(app)
      .get(`/api/v1/menu/public/test-restaurant/upsells?itemIds=${uuidv4()}`)
      .set('x-session-id', 'session-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].price).toBe(250);
  });
});
