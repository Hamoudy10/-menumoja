import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  createTestTable,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

describe('GET /api/v1/restaurant/me', () => {
  it('should return owner restaurant', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValue({
      ...restaurant,
      settings: { id: uuidv4(), restaurantId: restaurant.id, primaryColor: '#2563EB' },
      openingHours: [],
      tables: [],
      _count: { staff: 2, menuCategories: 3, menuItems: 10, branches: 0, qrCodes: 1 },
      plan: { id: uuidv4(), name: 'Free Trial', priceMonthlyKes: 0 },
    });

    const res = await request(app)
      .get('/api/v1/restaurant/me')
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(restaurant.name);
  });
});

describe('PUT /api/v1/restaurant/me', () => {
  it('should update restaurant', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValueOnce(restaurant);
    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.qrCode.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.restaurant.update as jest.Mock).mockResolvedValue({ ...restaurant, name: 'Updated Restaurant', slug: 'updated-restaurant' });

    const res = await request(app)
      .put('/api/v1/restaurant/me')
      .set(getAuthHeader(token))
      .send({ name: 'Updated Restaurant' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Restaurant');
  });
});

describe('PUT /api/v1/restaurant/me/settings', () => {
  it('should update settings', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurantSettings.upsert as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      restaurantId: restaurant.id,
      primaryColor: '#FF0000',
      allowOrdering: true,
    });

    const res = await request(app)
      .put('/api/v1/restaurant/me/settings')
      .set(getAuthHeader(token))
      .send({ primaryColor: '#FF0000', allowOrdering: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.primaryColor).toBe('#FF0000');
  });
});

describe('GET /api/v1/restaurant/me/tables', () => {
  it('should list tables', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurantTable.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), tableNumber: 1, label: 'Table 1', capacity: 4, status: 'FREE', qrCode: null, _count: { orders: 0 } },
      { id: uuidv4(), tableNumber: 2, label: 'Table 2', capacity: 6, status: 'OCCUPIED', qrCode: null, _count: { orders: 1 } },
    ]);

    const res = await request(app)
      .get('/api/v1/restaurant/me/tables')
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('POST /api/v1/restaurant/me/tables', () => {
  it('should create table', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurantTable.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.restaurantTable.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      restaurantId: restaurant.id,
      tableNumber: 5,
      label: 'Table 5',
      capacity: 4,
    });

    const res = await request(app)
      .post('/api/v1/restaurant/me/tables')
      .set(getAuthHeader(token))
      .send({ tableNumber: 5, label: 'Table 5', capacity: 4 })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tableNumber).toBe(5);
  });
});

describe('DELETE /api/v1/restaurant/me/tables/:id', () => {
  it('should delete table', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const table = await createTestTable(restaurant.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurantTable.findFirst as jest.Mock).mockResolvedValue({
      ...table,
      _count: { orders: 0 },
    });

    (prisma.restaurantTable.delete as jest.Mock).mockResolvedValue(table);

    const res = await request(app)
      .delete(`/api/v1/restaurant/me/tables/${table.id}`)
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
