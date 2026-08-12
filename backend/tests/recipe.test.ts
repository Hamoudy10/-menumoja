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

describe('RECIPE VERSIONING', () => {
  it('creates version 1 for a menu item without an active recipe', async () => {
    const { restaurant, token } = await setupTenant();
    const menuItem = await createTestMenuItem(uuidv4(), restaurant.id);
    const invA = uuidv4();
    const invB = uuidv4();

    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(menuItem);
    (prisma.recipe.findFirst as jest.Mock).mockResolvedValue(null); // no active recipe
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: invA });
    (prisma.stockMovement.findFirst as jest.Mock).mockResolvedValue({ unitCost: 350 }); // snapshot cost
    (prisma.recipe.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), menuItemId: menuItem.id, version: 1, isActive: true, ingredients: [],
    });

    const res = await request(app)
      .post('/api/v1/recipes')
      .set(getAuthHeader(token))
      .send({
        menuItemId: menuItem.id,
        ingredients: [
          { inventoryItemId: invA, quantity: 0.5 },
          { inventoryItemId: invB, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.version).toBe(1);
    // the cost snapshot must be captured into the ingredient rows
    const createdData = (prisma.recipe.create as jest.Mock).mock.calls[0][0].data;
    expect(createdData.ingredients.create[0].unitCostSnapshot).toBe(350);
  });

  it('saves a new version (v2) and preserves the previous one', async () => {
    const { restaurant, token } = await setupTenant();
    const menuItem = await createTestMenuItem(uuidv4(), restaurant.id);
    const invA = uuidv4();

    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(menuItem);
    (prisma.recipe.findFirst as jest.Mock).mockResolvedValue({ version: 1 }); // latest = v1
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: invA });
    (prisma.stockMovement.findFirst as jest.Mock).mockResolvedValue({ unitCost: 400 });
    (prisma.recipe.updateMany as jest.Mock).mockResolvedValue({ count: 1 }); // deactivate v1
    (prisma.recipe.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), menuItemId: menuItem.id, version: 2, isActive: true, ingredients: [],
    });

    const res = await request(app)
      .put(`/api/v1/recipes/items/${menuItem.id}`)
      .set(getAuthHeader(token))
      .send({ ingredients: [{ inventoryItemId: invA, quantity: 0.25 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);
    // v1 must be deactivated (not deleted)
    expect(prisma.recipe.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });

  it('rejects creating a recipe when one is already active', async () => {
    const { restaurant, token } = await setupTenant();
    const menuItem = await createTestMenuItem(uuidv4(), restaurant.id);

    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(menuItem);
    (prisma.recipe.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), isActive: true });

    const res = await request(app)
      .post('/api/v1/recipes')
      .set(getAuthHeader(token))
      .send({ menuItemId: menuItem.id, ingredients: [{ inventoryItemId: uuidv4(), quantity: 1 }] });

    expect(res.status).toBe(409);
  });
});

describe('FOOD COSTING', () => {
  it('computes cost, contribution and margin for an item with a recipe', async () => {
    const { restaurant, token } = await setupTenant();
    const menuItem = await createTestMenuItem(uuidv4(), restaurant.id, { price: 1000 });
    const recipeId = uuidv4();

    // menuItem used by getMenuItemCosting
    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(menuItem);
    // active recipe: 2 ingredients → 0.5 × 350 + 1 × 200 = 375
    (prisma.recipe.findFirst as jest.Mock).mockResolvedValue({
      id: recipeId,
      menuItemId: menuItem.id,
      version: 3,
      isActive: true,
      ingredients: [
        { quantity: 0.5, unitCostSnapshot: 350 },
        { quantity: 1, unitCostSnapshot: 200 },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/recipes/items/${menuItem.id}/costing`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.cost).toBe(375);
    expect(res.body.data.contribution).toBe(625);
    expect(res.body.data.marginPct).toBe(62.5);
    expect(res.body.data.hasRecipe).toBe(true);
    expect(res.body.data.recipeVersion).toBe(3);
  });

  it('returns zero cost and no recipe flag for items without a recipe', async () => {
    const { restaurant, token } = await setupTenant();
    const menuItem = await createTestMenuItem(uuidv4(), restaurant.id, { price: 800 });

    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(menuItem);
    (prisma.recipe.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/recipes/items/${menuItem.id}/costing`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.cost).toBe(0);
    expect(res.body.data.hasRecipe).toBe(false);
    expect(res.body.data.contribution).toBe(800);
  });

  it('returns costing for every menu item via /status', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), name: 'Chicken Burger', price: 900 },
      { id: uuidv4(), name: 'Plain Fries', price: 300 },
    ]);
    (prisma.recipe.findMany as jest.Mock).mockResolvedValue([
      {
        id: uuidv4(),
        menuItemId: 'match-none', // no match → cost 0 for both
        version: 1,
        isActive: true,
        ingredients: [{ quantity: 2, unitCostSnapshot: 100 }],
      },
    ]);

    const res = await request(app)
      .get('/api/v1/recipes/status')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].hasRecipe).toBe(false);
  });

  it('scopes recipe lookups to the tenant restaurant', async () => {
    const { restaurant, token } = await setupTenant();
    const menuItem = await createTestMenuItem(uuidv4(), restaurant.id, { price: 500 });

    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(menuItem);
    (prisma.recipe.findFirst as jest.Mock).mockResolvedValue(null);

    await request(app)
      .get(`/api/v1/recipes/items/${menuItem.id}/costing`)
      .set(getAuthHeader(token));

    const where = (prisma.menuItem.findFirst as jest.Mock).mock.calls[0][0].where;
    expect(where.restaurantId).toBe(restaurant.id);
  });
});
