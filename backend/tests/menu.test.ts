import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  redis,
  createTestOwner,
  createTestRestaurant,
  createTestCategory,
  createTestMenuItem,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

describe('GET /api/v1/menu/categories', () => {
  it('should list categories', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.menuCategory.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), restaurantId: restaurant.id, name: 'Beverages', sortOrder: 1, isActive: true, _count: { menuItems: 5 } },
      { id: uuidv4(), restaurantId: restaurant.id, name: 'Main Course', sortOrder: 2, isActive: true, _count: { menuItems: 10 } },
    ]);

    const res = await request(app)
      .get('/api/v1/menu/categories')
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('POST /api/v1/menu/categories', () => {
  it('should create category', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.menuCategory.aggregate as jest.Mock).mockResolvedValue({ _max: { sortOrder: 3 } });
    (prisma.menuCategory.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      restaurantId: restaurant.id,
      name: 'Desserts',
      sortOrder: 4,
      isActive: true,
    });

    const res = await request(app)
      .post('/api/v1/menu/categories')
      .set(getAuthHeader(token))
      .send({ name: 'Desserts' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Desserts');
  });
});

describe('POST /api/v1/menu/items', () => {
  it('should create menu item', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const category = await createTestCategory(restaurant.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue(category);
    (prisma.menuItem.aggregate as jest.Mock).mockResolvedValue({ _max: { sortOrder: 10 } });
    (prisma.menuItem.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Chicken Biryani',
      price: 850,
      isAvailable: true,
      description: 'Delicious biryani',
      currency: 'KES',
      isTodaysSpecial: false,
      ingredients: [],
      sortOrder: 11,
    });

    const res = await request(app)
      .post('/api/v1/menu/items')
      .set(getAuthHeader(token))
      .send({
        name: 'Chicken Biryani',
        price: 850,
        categoryId: category.id,
        description: 'Delicious biryani',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Chicken Biryani');
  });
});

describe('PUT /api/v1/menu/items/:id/toggle', () => {
  it('should toggle availability', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const category = await createTestCategory(restaurant.id);
    const item = await createTestMenuItem(category.id, restaurant.id, { isAvailable: true });
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(item);
    (prisma.menuItem.update as jest.Mock).mockResolvedValue({ ...item, isAvailable: false });

    const res = await request(app)
      .put(`/api/v1/menu/items/${item.id}/toggle`)
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isAvailable).toBe(false);
  });
});

describe('GET /api/v1/menu/public/:slug', () => {
  it('should return public menu', async () => {
    const restaurant = await createTestRestaurant(uuidv4());

    (redis.get as jest.Mock).mockResolvedValue(null);
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      ...restaurant,
      settings: {},
      openingHours: [],
      menuCategories: [
        {
          id: uuidv4(),
          name: 'Beverages',
          sortOrder: 1,
          isActive: true,
          menuItems: [
            { id: uuidv4(), name: 'Fresh Juice', price: 300, currency: 'KES', photoUrl: null, isAvailable: true, isTodaysSpecial: false, isFeatured: false, isNew: false, preparationTimeMinutes: 5, calories: null, spiceLevel: 'NONE', isHalal: true, isVegetarian: true, isVegan: false, isGlutenFree: true, allergenNotes: null, ingredients: [], sortOrder: 1, nameSw: null, descriptionSw: null, description: 'Fresh juice' },
          ],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/menu/public/${restaurant.slug}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.categories).toBeDefined();
    expect(res.body.data.categories.length).toBeGreaterThan(0);
  });

  it('should return 404 for invalid slug', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/menu/public/nonexistent-restaurant')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESTAURANT_NOT_FOUND');
  });
});
