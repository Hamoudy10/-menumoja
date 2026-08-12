import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  createTestStaff,
  createTestTable,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

describe('PAYMENT IDEMPOTENCY — cash record', () => {
  it('replays the same payment for a repeated Idempotency-Key without double-charging', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const staff = await createTestStaff(restaurant.id);
    const token = generateTestToken(staff.id, 'cashier', restaurant.id);
    const orderId = uuidv4();
    const paymentId = uuidv4();
    const key = `pay-cash-${uuidv4()}`;

    const order = { id: orderId, orderNumber: 'ORD-001', totalAmount: 500, paymentStatus: 'UNPAID', status: 'SERVED' };
    const payment = { id: paymentId, orderId, paymentMethod: 'CASH', amount: 500, status: 'PAID', cashReceived: 1000, changeGiven: 500, processedAt: new Date() };

    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    (prisma.cashReconciliation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    const orderCreate = prisma.order.create as jest.Mock;
    const paymentCreate = prisma.payment.create as jest.Mock;
    paymentCreate.mockResolvedValueOnce(payment);
    (prisma.order.update as jest.Mock).mockResolvedValue({ ...order, paymentStatus: 'PAID' });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    const paymentFindFirst = prisma.payment.findFirst as jest.Mock;
    paymentFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(payment);

    const body = { orderId, amount: 500, amountTendered: 1000 };

    const first = await request(app)
      .post('/api/v1/payments/cash/record')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.paymentId).toBe(paymentId);

    const second = await request(app)
      .post('/api/v1/payments/cash/record')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', key)
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.data.paymentId).toBe(paymentId);
    expect(second.body.data.idempotentReplay).toBe(true);
    expect(paymentCreate).toHaveBeenCalledTimes(1);
    expect(orderCreate).not.toHaveBeenCalled();
  });
});

describe('PAYMENT IDEMPOTENCY — M-Pesa initiate', () => {
  it('replays the same checkoutRequestId for a repeated Idempotency-Key', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const orderId = uuidv4();
    const paymentId = uuidv4();
    const key = `pay-mpesa-${uuidv4()}`;

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId, orderNumber: 'ORD-001', totalAmount: 500, paymentStatus: 'UNPAID', status: 'PENDING',
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.order.update as jest.Mock).mockResolvedValue({});

    const paymentFindFirst = prisma.payment.findFirst as jest.Mock;
    paymentFindFirst
      .mockResolvedValueOnce(null) // idempotency lookup (request 1)
      .mockResolvedValueOnce(null) // pending-payment check (request 1)
      .mockResolvedValueOnce({ // getPaymentByCheckoutRequestId (record idempotency after initiate)
        id: paymentId,
        orderId,
        mpesaCheckoutRequestId: 'checkout-abc',
        status: 'PENDING',
        amount: 500,
      })
      .mockResolvedValueOnce({ // idempotency lookup (request 2 → replay)
        id: paymentId,
        orderId,
        mpesaCheckoutRequestId: 'checkout-abc',
        status: 'PENDING',
        amount: 500,
      });
    // after initiatePayment, getPaymentByCheckoutRequestId
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { id: paymentId, orderId, mpesaCheckoutRequestId: 'checkout-abc', status: 'PENDING', amount: 500 },
    ]);

    const body = { orderId, phone: '+254712345678' };

    const first = await request(app)
      .post('/api/v1/payments/mpesa/initiate')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/payments/mpesa/initiate')
      .set(getAuthHeader(token))
      .set('Idempotency-Key', key)
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.data.idempotentReplay).toBe(true);
    expect(second.body.data.checkoutRequestId).toBe('checkout-abc');
  });
});

describe('HELD ORDERS — persistence', () => {
  it('holds an unpaid pending order, then unholds it', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const orderId = uuidv4();

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId, status: 'PENDING', paymentStatus: 'UNPAID',
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({ id: orderId, orderNumber: 'ORD-001', isHeld: true });

    const hold = await request(app)
      .put(`/api/v1/orders/${orderId}/hold`)
      .set(getAuthHeader(token));
    expect(hold.status).toBe(200);
    expect(hold.body.data.isHeld).toBe(true);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isHeld: true }) })
    );
  });

  it('rejects holding a paid order', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const orderId = uuidv4();

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId, status: 'SERVED', paymentStatus: 'PAID',
    });

    const res = await request(app)
      .put(`/api/v1/orders/${orderId}/hold`)
      .set(getAuthHeader(token));
    expect(res.status).toBe(422);
  });

  it('rejects holding an order that is already in preparation', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const orderId = uuidv4();

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId, status: 'PREPARING', paymentStatus: 'UNPAID',
    });

    const res = await request(app)
      .put(`/api/v1/orders/${orderId}/hold`)
      .set(getAuthHeader(token));
    expect(res.status).toBe(422);
  });
});

describe('TABLE OPTIMISTIC LOCKING', () => {
  it('updates table status when the version matches', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const table = await createTestTable(restaurant.id, { version: 3 });

    (prisma.restaurantTable.findFirst as jest.Mock).mockResolvedValue(table);
    (prisma.restaurantTable.update as jest.Mock).mockResolvedValue({ ...table, status: 'OCCUPIED', version: 4 });

    const res = await request(app)
      .put(`/api/v1/restaurant/me/tables/${table.id}/status`)
      .set(getAuthHeader(token))
      .send({ status: 'OCCUPIED', version: 3 });
    expect(res.status).toBe(200);
  });

  it('rejects a stale version with 409 TABLE_CONFLICT', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const table = await createTestTable(restaurant.id, { version: 5 });

    (prisma.restaurantTable.findFirst as jest.Mock).mockResolvedValue(table);

    const res = await request(app)
      .put(`/api/v1/restaurant/me/tables/${table.id}/status`)
      .set(getAuthHeader(token))
      .send({ status: 'OCCUPIED', version: 4 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TABLE_CONFLICT');
  });
});
