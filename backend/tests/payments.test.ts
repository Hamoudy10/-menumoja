import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  createTestStaff,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

describe('POST /api/v1/payments/mpesa/initiate', () => {
  it('should initiate STK Push', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);
    const orderId = uuidv4();

    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: orderId,
      orderNumber: 'ORD-001',
      totalAmount: 500,
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      customerPhone: '+254712345678',
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/payments/mpesa/initiate')
      .set(getAuthHeader(token))
      .send({ orderId, phone: '+254712345678' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.checkoutRequestId).toBeDefined();
  });
});

describe('POST /api/v1/payments/cash/record', () => {
  it('should record cash payment', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const staff = await createTestStaff(restaurant.id);
    const token = generateTestToken(staff.id, 'cashier', restaurant.id);
    const orderId = uuidv4();

    const order = {
      id: orderId,
      orderNumber: 'ORD-001',
      totalAmount: 500,
      paymentStatus: 'UNPAID',
      status: 'SERVED',
    };

    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    (prisma.payment.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      orderId,
      paymentMethod: 'CASH',
      amount: 500,
      status: 'PAID',
      cashReceived: 1000,
      changeGiven: 500,
      processedAt: new Date(),
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({ ...order, paymentStatus: 'PAID' });
    (prisma.cashReconciliation.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/payments/cash/record')
      .set(getAuthHeader(token))
      .send({ orderId, amount: 500, amountTendered: 1000 })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentId).toBeDefined();
    expect(res.body.data.amount).toBe(500);
  });
});

describe('GET /api/v1/payments/summary/today', () => {
  it('should return summary', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { paymentMethod: 'MPESA', amount: 1500 },
      { paymentMethod: 'CASH', amount: 800 },
      { paymentMethod: 'MPESA', amount: 2000 },
    ]);
    (prisma.order.count as jest.Mock).mockResolvedValue(3);
    (prisma.cashReconciliation.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/payments/summary/today')
      .set(getAuthHeader(token))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRevenue).toBe(4300);
    expect(res.body.data.mpesaTotal).toBe(3500);
    expect(res.body.data.cashTotal).toBe(800);
  });
});

describe('POST /api/v1/payments/cash/open-shift', () => {
  it('should open shift', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const staff = await createTestStaff(restaurant.id);
    const token = generateTestToken(staff.id, 'cashier', restaurant.id);

    (prisma.staff.findFirst as jest.Mock).mockResolvedValue(staff);
    (prisma.cashReconciliation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.cashReconciliation.create as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      cashierId: staff.id,
      shiftStart: new Date(),
      expectedCash: 0,
      status: 'OPEN',
    });

    const res = await request(app)
      .post('/api/v1/payments/cash/open-shift')
      .set(getAuthHeader(token))
      .send({ cashierId: staff.id })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('OPEN');
  });
});

describe('POST /api/v1/payments/cash/close-shift', () => {
  it('should close with discrepancy', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const staff = await createTestStaff(restaurant.id);
    const token = generateTestToken(staff.id, 'cashier', restaurant.id);
    const shiftId = uuidv4();

    (prisma.cashReconciliation.findFirst as jest.Mock).mockResolvedValue({
      id: shiftId,
      restaurantId: restaurant.id,
      cashierId: staff.id,
      status: 'OPEN',
      expectedCash: 5000,
      shiftStart: new Date(),
      cashier: { id: staff.id, fullName: staff.fullName },
    });
    (prisma.cashReconciliation.update as jest.Mock).mockResolvedValue({
      id: shiftId,
      expectedCash: 5000,
      actualCash: 4800,
      discrepancy: -200,
      status: 'DISCREPANCY_FLAGGED',
      shiftStart: new Date(),
      shiftEnd: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/payments/cash/close-shift')
      .set(getAuthHeader(token))
      .send({ shiftId, actualCash: 4800 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isFlagged).toBe(true);
  });
});
