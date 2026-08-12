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
import { mpesaService } from '../src/services';
import { initiatePayment } from '../src/services/mpesa.service';
import * as mpesa from '../src/integrations/mpesa';

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

const buildCallback = (checkoutRequestId: string, resultCode = 0, amount = 500) => ({
  Body: {
    stkCallback: {
      MerchantRequestID: 'mid-1',
      CheckoutRequestID: checkoutRequestId,
      ResultCode: resultCode,
      ResultDesc: resultCode === 0 ? 'The service request is processed successfully.' : 'Request cancelled by user',
      CallbackMetadata: resultCode === 0
        ? {
            Item: [
              { Name: 'Amount', Value: amount },
              { Name: 'MpesaReceiptNumber', Value: 'NEF1234567' },
              { Name: 'TransactionDate', Value: 20250115120000 },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          }
        : undefined,
    },
  },
});

describe('M-PESA PAYMENT ATTEMPTS', () => {
  it('records a PaymentAttempt when a payment is initiated', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const orderId = uuidv4();
    const paymentId = uuidv4();

    const orderService = {
      getOrderById: jest.fn().mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-001',
        amount: 500,
        customerPhone: '+254712345678',
        restaurantId: restaurant.id,
        status: 'pending',
      }),
      updateOrderPayment: jest.fn(),
      updateOrderStatus: jest.fn(),
      getCustomerPhone: jest.fn(),
      getRestaurantName: jest.fn(),
      getOwnerPhone: jest.fn(),
    };
    const paymentService = {
      createPayment: jest.fn().mockResolvedValue({
        id: paymentId, orderId, amount: 500, phone: '+254712345678', method: 'mpesa', status: 'pending', checkoutRequestId: 'checkout-1',
      }),
      updatePayment: jest.fn(),
      getPaymentByCheckoutRequestId: jest.fn(),
      getPendingPaymentsOlderThan: jest.fn(),
    };
    (prisma.paymentAttempt.create as jest.Mock).mockResolvedValue({});
    (mpesa.stkPush as jest.Mock).mockResolvedValue({
      checkoutRequestId: 'checkout-1',
      MerchantRequestID: 'mid-1',
      ResponseDescription: 'Success',
    });

    await initiatePayment(orderId, orderService as any, paymentService as any);

    expect(prisma.paymentAttempt.create).toHaveBeenCalledTimes(1);
    const attemptData = (prisma.paymentAttempt.create as jest.Mock).mock.calls[0][0].data;
    expect(attemptData.checkoutRequestId).toBe('checkout-1');
    expect(attemptData.status).toBe('PENDING');
    expect(attemptData.paymentId).toBe(paymentId);
    expect(attemptData.restaurantId).toBe(restaurant.id);
  });
});

describe('M-PESA CALLBACK — attempt lifecycle', () => {
  it('marks the attempt SUCCESS on a successful callback', async () => {
    const checkoutRequestId = uuidv4();
    (prisma.paymentWebhookEvent.create as jest.Mock).mockResolvedValue({});
    (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mpesaService.handleCallback as jest.Mock).mockResolvedValue({ success: true, message: 'Payment processed' });

    // route: checkIdempotency → 'new' (default mock), then webhook event, then handleCallback mock
    const res = await request(app)
      .post('/api/v1/payments/mpesa/callback')
      .send(buildCallback(checkoutRequestId));
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);

    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledTimes(1);
    const eventData = (prisma.paymentWebhookEvent.create as jest.Mock).mock.calls[0][0].data;
    expect(eventData.checkoutRequestId).toBe(checkoutRequestId);
    expect(eventData.isDuplicate).toBe(false);
    expect(eventData.processed).toBe(true);
  });

  it('logs duplicate callbacks as webhook events with isDuplicate=true', async () => {
    const checkoutRequestId = uuidv4();
    (mpesa.checkIdempotency as jest.Mock).mockResolvedValue('completed');
    (prisma.paymentWebhookEvent.create as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/payments/mpesa/callback')
      .send(buildCallback(checkoutRequestId));
    expect(res.status).toBe(200);

    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledTimes(1);
    const eventData = (prisma.paymentWebhookEvent.create as jest.Mock).mock.calls[0][0].data;
    expect(eventData.isDuplicate).toBe(true);
    expect(eventData.processed).toBe(false);
  });
});

describe('M-PESA RECONCILIATION', () => {
  it('computes and persists a reconciliation record for the day', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    // paymentAttempt.updateMany (expire stale) → 0 expired
    (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    // payment.aggregate ×2 (expected, received)
    (prisma.payment.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: 1500 } })
      .mockResolvedValueOnce({ _sum: { amount: 1400 } });
    // attempts statuses
    (prisma.paymentAttempt.findMany as jest.Mock).mockResolvedValue([
      { status: 'SUCCESS' }, // unmatched
      { status: 'FAILED' },
      { status: 'EXPIRED' },
    ]);
    // duplicate webhook events count
    (prisma.paymentWebhookEvent.count as jest.Mock).mockResolvedValue(2);
    (prisma.reconciliationRecord.upsert as jest.Mock).mockResolvedValue({
      id: uuidv4(),
      restaurantId: restaurant.id,
      date: new Date(),
      expectedMpesa: 1500,
      receivedMpesa: 1400,
      difference: 100,
      unmatched: 1,
      duplicate: 2,
      failed: 1,
      expired: 1,
      reversed: 0,
    });

    const res = await request(app)
      .post('/api/v1/payments/reconciliation/run')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.expectedMpesa).toBe(1500);
    expect(res.body.data.receivedMpesa).toBe(1400);
    expect(res.body.data.difference).toBe(100);
    expect(res.body.data.unmatched).toBe(1);
    expect(res.body.data.duplicate).toBe(2);
    expect(res.body.data.persisted).toBe(true);
  });

  it('expires stale pending attempts during a reconciliation run', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.paymentAttempt.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
    (prisma.payment.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: 0 } })
      .mockResolvedValueOnce({ _sum: { amount: 0 } });
    (prisma.paymentAttempt.findMany as jest.Mock).mockResolvedValue([{ status: 'EXPIRED' }]);
    (prisma.paymentWebhookEvent.count as jest.Mock).mockResolvedValue(0);
    (prisma.reconciliationRecord.upsert as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/payments/reconciliation/run')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledTimes(1);
    const updateWhere = (prisma.paymentAttempt.updateMany as jest.Mock).mock.calls[0][0].where;
    expect(updateWhere.status).toBe('PENDING');
    expect(updateWhere.initiatedAt.lt).toBeDefined();
    const updateData = (prisma.paymentAttempt.updateMany as jest.Mock).mock.calls[0][0].data;
    expect(updateData.status).toBe('EXPIRED');
    expect(res.body.data.expired).toBe(1);
  });

  it('lists reconciliation history', async () => {
    const owner = await createTestOwner();
    const restaurant = await createTestRestaurant(owner.id);
    const token = generateTestToken(owner.id, 'owner', restaurant.id);

    (prisma.reconciliationRecord.findMany as jest.Mock).mockResolvedValue([
      {
        id: uuidv4(),
        restaurantId: restaurant.id,
        date: new Date(),
        expectedMpesa: 500,
        receivedMpesa: 500,
        difference: 0,
        unmatched: 0,
        duplicate: 0,
        failed: 0,
        expired: 0,
        reversed: 0,
      },
    ]);
    (prisma.reconciliationRecord.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/payments/reconciliation/history')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].receivedMpesa).toBe(500);
  });
});
