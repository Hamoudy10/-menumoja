import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import {
  setupTestApp,
  prisma,
  redis,
  createTestOwner,
  createTestRestaurant,
  createTestMenuItem,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';
import * as mpesa from '../src/integrations/mpesa';
import { mpesaService } from '../src/services';

const app = setupTestApp();

function refreshTokenFor(userId: string): string {
  const secret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-jest';
  return jwt.sign({ userId, role: 'owner', type: 'refresh', tokenId: uuidv4() }, secret, { expiresIn: '30d' });
}

beforeEach(() => {
  cleanupTestData();
});

describe('AUTHENTICATION — invalid/malformed tokens', () => {
  it('rejects requests without a token (401)', async () => {
    const res = await request(app).get('/api/v1/restaurant/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed token (401)', async () => {
    const res = await request(app)
      .get('/api/v1/restaurant/me')
      .set(getAuthHeader('not-a-real-token'));
    expect(res.status).toBe(401);
  });

  it('rejects a refresh token used as an access token (401)', async () => {
    const owner = await createTestOwner();
    const res = await request(app)
      .get('/api/v1/restaurant/me')
      .set(getAuthHeader(refreshTokenFor(owner.id)));
    expect(res.status).toBe(401);
  });

  it('rejects an expired token (401)', async () => {
    const owner = await createTestOwner();
    const secret = process.env.JWT_ACCESS_SECRET || 'test-access-secret-for-jest';
    const expired = jwt.sign(
      { userId: owner.id, role: 'owner', type: 'access' },
      secret,
      { expiresIn: '-10s' }
    );
    const res = await request(app)
      .get('/api/v1/restaurant/me')
      .set(getAuthHeader(expired));
    expect(res.status).toBe(401);
  });
});

describe('TENANT ISOLATION — cross-tenant access', () => {
  it('scopes list queries to the token restaurantId — never another tenant', async () => {
    const restaurantA = await createTestRestaurant(uuidv4(), { id: uuidv4(), name: 'Restaurant A' });
    const tokenA = generateTestToken(uuidv4(), 'owner', restaurantA.id);

    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    await request(app)
      .get('/api/v1/orders')
      .set(getAuthHeader(tokenA));

    const where = (prisma.order.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where).toBeDefined();
    expect(where.restaurantId).toBe(restaurantA.id);
    expect(where.restaurantId).not.toBe('some-other-tenant-id');
  });

  it('rejects requests from a token without a restaurant scope (400)', async () => {
    const token = generateTestToken(uuidv4(), 'owner', undefined);
    const res = await request(app)
      .get('/api/v1/orders')
      .set(getAuthHeader(token));
    expect(res.status).toBe(400);
  });

  it('blocks access to a suspended restaurant (403)', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id, {
      isSuspended: true,
      suspensionReason: 'Non-payment',
      isActive: true,
    });
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValue(restaurant);

    const res = await request(app)
      .get('/api/v1/restaurant/me')
      .set(getAuthHeader(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('RESTAURANT_SUSPENDED');
    expect(res.body.error.message).toContain('Non-payment');
  });
});

describe('RBAC — role escalation', () => {
  it('denies waiter access to the kitchen display (403)', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const waiterToken = generateTestToken(uuidv4(), 'waiter', restaurant.id);

    const res = await request(app)
      .get('/api/v1/orders/kitchen')
      .set(getAuthHeader(waiterToken));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows kitchen role access to the kitchen display (200)', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const kitchenToken = generateTestToken(uuidv4(), 'kitchen', restaurant.id);

    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/orders/kitchen')
      .set(getAuthHeader(kitchenToken));
    expect(res.status).toBe(200);
  });
});

describe('VALIDATION — malicious / malformed payloads', () => {
  it('rejects invalid UUIDs in paths (422)', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    const res = await request(app)
      .put(`/api/v1/orders/not-a-uuid/status`)
      .set(getAuthHeader(token))
      .send({ status: 'confirmed' });
    expect(res.status).toBe(422);
  });

  it('rejects malformed order payloads (422)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/public/create')
      .send({ items: 'not-an-array', total: -5 });
    expect(res.status).toBe(422);
  });

  it('rejects an unknown status transition (422)', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'manager', restaurant.id);

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      restaurantId: restaurant.id,
      status: 'SERVED',
      payments: [],
    });

    const res = await request(app)
      .put(`/api/v1/orders/${uuidv4()}/status`)
      .set(getAuthHeader(token))
      .send({ status: 'preparing' });
    expect(res.status).toBe(422);
  });

  it('never creates an order from the anti-spam honeypot field', async () => {
    const orderCreate = prisma.order.create as jest.Mock;
    const res = await request(app)
      .post('/api/v1/orders/public/create')
      .send({
        restaurantId: uuidv4(),
        sessionId: uuidv4(),
        items: [{ menuItemId: uuidv4(), quantity: 1 }],
        paymentMethod: 'cash',
        website: 'http://spam.example.com',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBe('SPAM');
    expect(orderCreate).not.toHaveBeenCalled();
  });
});

describe('IDEMPOTENCY — duplicate POS order creation', () => {
  const posPayload = {
    items: [{ name: 'Free-text Item', price: 250, quantity: 1 }],
    paymentMethod: 'cash',
  };

  it('returns the same order for a repeated Idempotency-Key without creating twice', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const key = `pos-test-${uuidv4()}`;
    const orderId = uuidv4();
    const createdOrder = { id: orderId, orderNumber: 'ORD-0001', estimatedPrepMinutes: 10, totalAmount: 262.5, items: [] };

    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    const orderCreate = prisma.order.create as jest.Mock;
    const orderFindFirst = prisma.order.findFirst as jest.Mock;
    orderFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(createdOrder);
    orderCreate.mockResolvedValueOnce(createdOrder);

    const first = await request(app)
      .post('/api/v1/orders')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', key)
      .send(posPayload);
    expect(first.status).toBe(201);
    expect(first.body.data.orderId).toBe(orderId);

    const second = await request(app)
      .post('/api/v1/orders')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', key)
      .send(posPayload);
    expect(second.status).toBe(201);
    expect(second.body.data.orderId).toBe(orderId);
    expect(second.body.data.idempotentReplay).toBe(true);
    expect(orderCreate).toHaveBeenCalledTimes(1);
  });

  it('treats different keys as different orders', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);
    const orderCreate = prisma.order.create as jest.Mock;
    orderCreate
      .mockResolvedValueOnce({ id: uuidv4(), orderNumber: 'ORD-1', estimatedPrepMinutes: 10, totalAmount: 262.5, items: [] })
      .mockResolvedValueOnce({ id: uuidv4(), orderNumber: 'ORD-2', estimatedPrepMinutes: 10, totalAmount: 262.5, items: [] });

    const first = await request(app)
      .post('/api/v1/orders')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', `key-a-${uuidv4()}`)
      .send(posPayload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/orders')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', `key-b-${uuidv4()}`)
      .send(posPayload);
    expect(second.status).toBe(201);

    expect(orderCreate).toHaveBeenCalledTimes(2);
    expect(first.body.data.orderId).not.toBe(second.body.data.orderId);
  });
});

describe('M-PESA WEBHOOK — idempotency and validation', () => {
  const buildCallback = (checkoutRequestId: string, resultCode = 0) => ({
    Body: {
      stkCallback: {
        MerchantRequestID: 'mid-1',
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? 'The service request is processed successfully.' : 'Request cancelled by user',
        CallbackMetadata: resultCode === 0
          ? {
              Item: [
                { Name: 'Amount', Value: 500 },
                { Name: 'MpesaReceiptNumber', Value: 'NEF1234567' },
                { Name: 'TransactionDate', Value: 20250115120000 },
                { Name: 'PhoneNumber', Value: 254712345678 },
              ],
            }
          : undefined,
      },
    },
  });

  it('rejects a malformed callback structure (Safaricom-style failure response)', async () => {
    const res = await request(app)
      .post('/api/v1/payments/mpesa/callback')
      .send({ Body: {} });
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(1);
  });

  it('ignores a duplicate callback without reprocessing', async () => {
    const checkoutRequestId = uuidv4();
    (mpesa.checkIdempotency as jest.Mock).mockResolvedValue('completed');
    const handleCallback = mpesaService.handleCallback as jest.Mock;

    const res = await request(app)
      .post('/api/v1/payments/mpesa/callback')
      .send(buildCallback(checkoutRequestId));
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);
    expect(handleCallback).not.toHaveBeenCalled();
  });

  it('processes a new callback exactly once and reports success', async () => {
    const checkoutRequestId = uuidv4();
    (mpesa.checkIdempotency as jest.Mock).mockResolvedValue('new');
    (mpesaService.handleCallback as jest.Mock).mockResolvedValue({ success: true, message: 'Payment processed' });

    const res = await request(app)
      .post('/api/v1/payments/mpesa/callback')
      .send(buildCallback(checkoutRequestId));
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);
    expect(mpesaService.handleCallback).toHaveBeenCalledTimes(1);
  });

  it('reports processing failure to Safaricom without throwing', async () => {
    const checkoutRequestId = uuidv4();
    (mpesa.checkIdempotency as jest.Mock).mockResolvedValue('new');
    (mpesaService.handleCallback as jest.Mock).mockResolvedValue({ success: false, message: 'Amount mismatch' });

    const res = await request(app)
      .post('/api/v1/payments/mpesa/callback')
      .send(buildCallback(checkoutRequestId));
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(1);
  });
});

describe('RATE LIMITING — brute force protection', () => {
  it('locks an account after repeated failed logins (429)', async () => {
    const owner = await createTestOwner();
    (redis.incr as jest.Mock).mockResolvedValue(6);
    (redis.ttl as jest.Mock).mockResolvedValue(300);
    (prisma.owner.findFirst as jest.Mock).mockResolvedValue(owner);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'Whatever123' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});
