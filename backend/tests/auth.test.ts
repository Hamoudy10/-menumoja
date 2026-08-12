import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  redis,
  createTestOwner,
  createTestRestaurant,
  createTestStaff,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

const validOwner = {
  name: 'John Doe',
  email: 'john@menumoja.co.ke',
  phone: '+254712345678',
  password: 'TestPass123',
  restaurantName: 'John Restaurant',
};

beforeEach(() => {
  cleanupTestData();
  (prisma.subscriptionPlan.findFirst as jest.Mock).mockResolvedValue({
    id: uuidv4(),
    name: 'Free Trial',
    priceMonthlyKes: 0,
    priceYearlyKes: 0,
    hasOrdering: true,
    hasAnalytics: true,
    maxMenuItems: 50,
    maxTables: 20,
    isActive: true,
  });
});

describe('POST /api/v1/auth/register', () => {
  it('should create owner, return userId', async () => {
    (prisma.owner.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.owner.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      fullName: validOwner.name,
      email: validOwner.email,
      phone: validOwner.phone,
      isVerified: false,
      createdAt: new Date(),
    });
    (prisma.restaurant.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      name: validOwner.restaurantName,
      slug: 'john-restaurant',
    });
    (prisma.restaurantSettings.create as jest.Mock).mockResolvedValue({});
    (prisma.openingHour.createMany as jest.Mock).mockResolvedValue({ count: 7 });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validOwner)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('should fail with duplicate email', async () => {
    (prisma.owner.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), email: validOwner.email });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validOwner)
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_EXISTS');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('should return tokens with valid credentials', async () => {
    const owner = await createTestOwner({ email: validOwner.email, phone: validOwner.phone });
    const restaurant = await createTestRestaurant(owner.id);
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(1);
    (prisma.owner.findFirst as jest.Mock).mockResolvedValue(owner);
    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValue(restaurant);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validOwner.email, password: validOwner.password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
  });

  it('should fail with wrong password', async () => {
    const owner = await createTestOwner({ email: validOwner.email });
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (prisma.owner.findFirst as jest.Mock).mockResolvedValue(owner);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validOwner.email, password: 'WrongPass123' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should fail after too many attempts (rate limiting)', async () => {
    const owner = await createTestOwner({ email: validOwner.email });
    (redis.incr as jest.Mock).mockResolvedValue(6);
    (redis.ttl as jest.Mock).mockResolvedValue(300);
    (prisma.owner.findFirst as jest.Mock).mockResolvedValue(owner);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validOwner.email, password: validOwner.password })
      .expect(429);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('POST /api/v1/auth/refresh-token', () => {
  it('should return new access token', async () => {
    const owner = await createTestOwner();
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-jest';
    const refreshToken = (await import('jsonwebtoken')).default.sign(
      { userId: owner.id, role: 'owner', type: 'refresh', tokenId: uuidv4() },
      refreshSecret,
      { expiresIn: '30d' }
    );
    (redis.get as jest.Mock).mockResolvedValue(refreshToken);

    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });
});

describe('POST /api/v1/auth/staff/login', () => {
  it('should return staff token with valid PIN', async () => {
    const restaurant = await createTestRestaurant(uuidv4());
    const staff = await createTestStaff(restaurant.id);

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(restaurant);
    (prisma.staff.findMany as jest.Mock).mockResolvedValue([staff]);

    const res = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ pin: '123456', restaurantSlug: restaurant.slug })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.staff).toBeDefined();
    expect(res.body.data.tokens.accessToken).toBeDefined();
  });

  it('should fail with wrong PIN', async () => {
    const restaurant = await createTestRestaurant(uuidv4());
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(restaurant);
    (prisma.staff.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ pin: '000000', restaurantSlug: restaurant.slug })
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
