import express, { Express, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../src/middleware/errorHandler';

process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-jest';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-jest';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/menumoja_test';

import { authRoutes } from '../src/routes';
import { restaurantRoutes } from '../src/routes';
import { menuRoutes } from '../src/routes';
import { publicRoutes } from '../src/routes';
import { orderRoutes } from '../src/routes';
import { paymentRoutes } from '../src/routes';
import { analyticsRoutes } from '../src/routes';

jest.mock('../src/config/database', () => {
  const mockPrisma = {
    owner: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    restaurant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    subscriptionPlan: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    restaurantSettings: {
      upsert: jest.fn(),
      create: jest.fn(),
    },
    openingHour: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    menuCategory: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    menuItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    restaurantTable: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    cashReconciliation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    staff: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    qrCode: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    qrScan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    analyticsDaily: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    searchAnalytics: {
      create: jest.fn(),
      groupBy: jest.fn(),
    },
    aiConversation: {
      findMany: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    menuItemAnalytics: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

jest.mock('../src/config/redis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(600),
    keys: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  return { redis: mockRedis };
});

jest.mock('../src/config', () => ({
  config: {
    nodeEnv: 'test',
    port: 3001,
    frontendUrl: 'http://localhost:5173',
    redisUrl: 'redis://localhost:6379',
    sentryDsn: '',
    jwtAccessSecret: 'test-access-secret-for-jest',
    jwtRefreshSecret: 'test-refresh-secret-for-jest',
  },
}));

jest.mock('../src/hooks/socket', () => ({
  io: {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    on: jest.fn(),
  },
  setIO: jest.fn(),
  emitOrderNew: jest.fn(),
  emitOrderStatusChanged: jest.fn(),
  emitPaymentConfirmed: jest.fn(),
  emitTableStatusChanged: jest.fn(),
  emitCameraAlert: jest.fn(),
  emitNotification: jest.fn(),
}));

jest.mock('../src/services', () => ({
  mpesaService: {
    initiatePayment: jest.fn().mockResolvedValue({
      MerchantRequestID: 'test-mid',
      CheckoutRequestID: 'test-checkout',
      ResponseDescription: 'Success. Request accepted for processing',
    }),
    handleCallback: jest.fn().mockResolvedValue({ success: true, message: 'Payment processed' }),
    initiateRefund: jest.fn().mockResolvedValue({ success: true }),
  },
  aiService: {
    processCustomerMessage: jest.fn(),
    processOwnerSetup: jest.fn(),
  },
  authService: {},
}));

jest.mock('../src/integrations/mpesa', () => ({
  checkIdempotency: jest.fn().mockResolvedValue('new'),
  queryStatus: jest.fn().mockResolvedValue({ ResultCode: 0 }),
}));

import { prisma } from '../src/config/database';
import { redis } from '../src/config/redis';

export { prisma, redis };

const testDataStore: {
  owner?: any;
  restaurant?: any;
  category?: any;
  menuItem?: any;
  staff?: any;
  table?: any;
} = {};

export function getTestData() {
  return testDataStore;
}

export function setupTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).requestId = uuidv4();
    next();
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/restaurant', restaurantRoutes);
  app.use('/api/v1/menu', menuRoutes);
  app.use('/api/v1/menu/public', publicRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(), version: '1.0.0' });
  });
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found', messageSwahili: 'Haikupatikana' } });
  });
  app.use(errorHandler);

  return app;
}

export async function createTestOwner(overrides: Record<string, any> = {}): Promise<any> {
  const id = uuidv4();
  const restaurantId = uuidv4();
  const owner = {
    id,
    fullName: 'Test Owner',
    email: 'test@menumoja.co.ke',
    phone: '+254712345678',
    passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1Qlq5GzYK5mBx5s5L5z5k5L5z5kO',
    isVerified: true,
    role: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  testDataStore.owner = owner;
  return owner;
}

export async function createTestRestaurant(ownerId: string, overrides: Record<string, any> = {}): Promise<any> {
  const id = uuidv4();
  const restaurant = {
    id,
    ownerId,
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    description: 'A test restaurant',
    descriptionSw: null,
    logoUrl: null,
    coverPhotoUrl: null,
    coverVideoUrl: null,
    address: '123 Test Street',
    city: 'Mombasa',
    latitude: null,
    longitude: null,
    phone: '+254712345678',
    whatsapp: null,
    email: null,
    website: null,
    currency: 'KES',
    isHalalCertified: false,
    dietaryOptions: [],
    isActive: true,
    isSuspended: false,
    suspensionReason: null,
    planId: uuidv4(),
    subscriptionStatus: 'TRIAL',
    trialEndsAt: null,
    planExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  testDataStore.restaurant = restaurant;
  return restaurant;
}

export async function createTestCategory(restaurantId: string, overrides: Record<string, any> = {}): Promise<any> {
  const id = uuidv4();
  const category = {
    id,
    restaurantId,
    name: 'Test Category',
    nameSw: null,
    nameAr: null,
    description: 'A test category',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  testDataStore.category = category;
  return category;
}

export async function createTestMenuItem(categoryId: string, restaurantId: string, overrides: Record<string, any> = {}): Promise<any> {
  const id = uuidv4();
  const item = {
    id,
    restaurantId,
    categoryId,
    name: 'Test Item',
    nameSw: null,
    nameAr: null,
    description: 'A test menu item',
    descriptionSw: null,
    descriptionAr: null,
    price: 500,
    currency: 'KES',
    photoUrl: null,
    photoUrls: [],
    photoGeneratedByAi: false,
    isAvailable: true,
    isTodaysSpecial: false,
    isFeatured: false,
    isNew: false,
    preparationTimeMinutes: 15,
    calories: null,
    isHalal: false,
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    spiceLevel: 'NONE',
    containsNuts: false,
    containsDairy: false,
    containsSeafood: false,
    allergenNotes: null,
    ingredients: [],
    sortOrder: 0,
    totalOrders: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  testDataStore.menuItem = item;
  return item;
}

export async function createTestStaff(restaurantId: string, overrides: Record<string, any> = {}): Promise<any> {
  const id = uuidv4();
  const staff = {
    id,
    restaurantId,
    fullName: 'Test Staff',
    phone: '+254723456789',
    pinHash: '$2a$12$LJ3m4ys3Lk0TSwHnbfOMiOXPm1Qlq5GzYK5mBx5s5L5z5k5L5z5kO',
    role: 'WAITER',
    isActive: true,
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  testDataStore.staff = staff;
  return staff;
}

export async function createTestTable(restaurantId: string, overrides: Record<string, any> = {}): Promise<any> {
  const id = uuidv4();
  const table = {
    id,
    restaurantId,
    tableNumber: 1,
    label: 'Table 1',
    capacity: 4,
    status: 'FREE',
    currentSessionId: null,
    qrCodeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  testDataStore.table = table;
  return table;
}

export function generateTestToken(userId: string, role: string, restaurantId?: string): string {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-access-secret-for-jest';
  return jwt.sign(
    { userId, role, type: 'access', restaurantId: restaurantId || null },
    secret,
    { expiresIn: '15m' }
  );
}

export function getAuthHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function cleanupTestData(): void {
  jest.clearAllMocks();
  Object.keys(testDataStore).forEach((key) => delete (testDataStore as any)[key]);
}
