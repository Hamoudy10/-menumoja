import { prisma, setupTestApp, createTestOwner, generateTestToken, getAuthHeader, cleanupTestData } from './helpers';
import request from 'supertest';
import {
  createInvoice,
  markInvoicePaid,
  voidInvoice,
  runExpirySweep,
} from '../src/services/billing.service';

const app = setupTestApp();

const RESTAURANT_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  cleanupTestData();
});

describe('billing service — invoices', () => {
  it('creates an invoice from the plan price and notifies the owner', async () => {
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: RESTAURANT_ID,
      ownerId: OWNER_ID,
      plan: { id: 'plan-1', name: 'Starter', priceMonthlyKes: 1500 },
    });
    (prisma.subscriptionInvoice.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.subscriptionInvoice.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'inv-1', ...data }));

    const invoice = await createInvoice({ restaurantId: RESTAURANT_ID, notes: 'November' });

    expect(invoice.amountKes).toBe(1500);
    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          restaurantId: RESTAURANT_ID,
          amountKes: 1500,
          invoiceNumber: expect.stringMatching(/^INV-/),
        }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ restaurantId: RESTAURANT_ID, recipientType: 'OWNER' }) })
    );
  });

  it('rejects an invalid period', async () => {
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: RESTAURANT_ID,
      ownerId: OWNER_ID,
      plan: { id: 'plan-1', name: 'Starter', priceMonthlyKes: 1500 },
    });
    const start = new Date('2026-12-01');
    await expect(
      createInvoice({ restaurantId: RESTAURANT_ID, periodStart: start, periodEnd: start })
    ).rejects.toThrow();
  });

  it('marks an invoice paid and extends the plan expiry', async () => {
    const periodEnd = new Date('2026-12-31');
    (prisma.subscriptionInvoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      invoiceNumber: 'INV-1',
      reference: null,
      notes: null,
      periodEnd,
      restaurantId: RESTAURANT_ID,
      restaurant: { id: RESTAURANT_ID, ownerId: OWNER_ID, planExpiresAt: null },
    });
    (prisma.subscriptionInvoice.update as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'PAID' });
    (prisma.restaurant.update as jest.Mock).mockResolvedValue({});

    const result = await markInvoicePaid('inv-1', { method: 'MPESA', reference: 'QWE123' });

    expect(result.planExpiresAt).toEqual(periodEnd);
    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESTAURANT_ID },
        data: expect.objectContaining({ subscriptionStatus: 'ACTIVE', planExpiresAt: periodEnd }),
      })
    );
  });

  it('refuses to pay an already-paid invoice', async () => {
    (prisma.subscriptionInvoice.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      status: 'PAID',
      restaurant: { id: RESTAURANT_ID, ownerId: OWNER_ID, planExpiresAt: null },
    });
    await expect(markInvoicePaid('inv-1', { method: 'MPESA' })).rejects.toThrow();
  });

  it('voids a pending invoice', async () => {
    (prisma.subscriptionInvoice.findUnique as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'PENDING', notes: null });
    (prisma.subscriptionInvoice.update as jest.Mock).mockResolvedValue({ id: 'inv-1', status: 'VOID' });
    const result = await voidInvoice('inv-1', 'Duplicate');
    expect(result.status).toBe('VOID');
  });
});

describe('billing service — expiry sweep', () => {
  it('expires past-due trials and plans and marks invoices overdue', async () => {
    (prisma.restaurant.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'r-1', ownerId: 'o-1', name: 'A', trialEndsAt: new Date('2026-01-01') }])
      .mockResolvedValueOnce([{ id: 'r-2', ownerId: 'o-2', name: 'B', planExpiresAt: new Date('2026-01-01') }]);
    (prisma.restaurant.update as jest.Mock).mockResolvedValue({});
    (prisma.subscriptionInvoice.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const result = await runExpirySweep(new Date('2026-11-12'));

    expect(result).toEqual({ expiredTrials: 1, expiredPlans: 1, markedOverdue: 2 });
    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscriptionStatus: 'EXPIRED' } })
    );
  });
});

describe('billing routes — authorization', () => {
  it('rejects unauthenticated access to billing (401)', async () => {
    const res = await request(app).get('/api/v1/billing/overview');
    expect(res.status).toBe(401);
  });

  it('rejects staff from viewing owner billing (403)', async () => {
    const token = generateTestToken('staff-1', 'cashier', RESTAURANT_ID);
    const res = await request(app)
      .get('/api/v1/billing/overview')
      .set(getAuthHeader(token));
    expect(res.status).toBe(403);
  });

  it('returns the owner billing overview', async () => {
    const owner = await createTestOwner({ id: OWNER_ID });
    const token = generateTestToken(owner.id, 'owner', RESTAURANT_ID);

    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      subscriptionStatus: 'TRIAL',
      trialEndsAt: null,
      planExpiresAt: null,
      plan: { id: 'plan-1', name: 'Starter', priceMonthlyKes: 1500, priceYearlyKes: 15000 },
    });
    (prisma.subscriptionInvoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subscriptionInvoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { amountKes: 0 }, _count: { id: 0 } });

    const res = await request(app)
      .get('/api/v1/billing/overview')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.subscription.status).toBe('TRIAL');
    expect(res.body.data.subscription.plan.priceMonthlyKes).toBe(1500);
  });
});

describe('admin billing routes', () => {
  it('lists invoices for a super admin', async () => {
    const token = generateTestToken('admin-1', 'SUPER_ADMIN');
    (prisma.subscriptionInvoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subscriptionInvoice.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/admin/billing/invoices')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('blocks a non-admin from admin billing (403)', async () => {
    const token = generateTestToken(OWNER_ID, 'owner', RESTAURANT_ID);
    const res = await request(app)
      .get('/api/v1/admin/billing/invoices')
      .set(getAuthHeader(token));
    expect(res.status).toBe(403);
  });

  it('creates an invoice via the admin route (201)', async () => {
    const token = generateTestToken('admin-1', 'SUPER_ADMIN');
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
      id: RESTAURANT_ID,
      ownerId: OWNER_ID,
      plan: { id: 'plan-1', name: 'Starter', priceMonthlyKes: 1500 },
    });
    (prisma.subscriptionInvoice.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.subscriptionInvoice.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'inv-1', ...data }));

    const res = await request(app)
      .post('/api/v1/admin/billing/invoices')
      .set(getAuthHeader(token))
      .send({ restaurantId: RESTAURANT_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.amountKes).toBe(1500);
  });
});
