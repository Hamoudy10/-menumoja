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
import { ensureSubmission, processSubmission } from '../src/services/etims.service';

jest.mock('../src/integrations/etims', () => {
  const actual = jest.requireActual('../src/integrations/etims');
  return {
    ...actual,
    isEtimsConfigured: jest.fn(() => false),
    submitReceipt: jest.fn(),
    buildA1Payload: jest.fn((input: any) => ({ tin: input.restaurant.kraPin, itemList: [] })),
  };
});

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

describe('eTIMS SUBMISSION LIFECYCLE', () => {
  it('creates a PENDING submission row for a receipt (unconfigured → stays pending, never claimed)', async () => {
    const { restaurant } = await setupTenant();
    const receiptId = uuidv4();

    (prisma.etrSubmission.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.etrSubmission.create as jest.Mock).mockResolvedValue({ id: 'sub-1', restaurantId: restaurant.id, receiptId, status: 'PENDING' });

    await ensureSubmission(restaurant.id, receiptId);

    // status is the DB default PENDING — the service creates the tracking row
    const created = (prisma.etrSubmission.create as jest.Mock).mock.calls[0][0].data;
    expect(created.restaurantId).toBe(restaurant.id);
    expect(created.receiptId).toBe(receiptId);
  });

  it('unconfigured submissions stay PENDING (nothing sent to KRA)', async () => {
    const { restaurant } = await setupTenant();
    (prisma.etrSubmission.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1', restaurantId: restaurant.id, receiptId: uuidv4(), status: 'PENDING', attempts: 0,
    });
    (prisma.etrSubmission.update as jest.Mock).mockResolvedValue({});

    const result = await processSubmission('sub-1');

    expect(result.status).toBe('PENDING');
    expect(prisma.etrSubmission.update).not.toHaveBeenCalled();
  });
});

describe('eTIMS API', () => {
  it('returns status counts and unsubmitted receipts', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.etrSubmission.groupBy as jest.Mock).mockResolvedValue([
      { status: 'PENDING', _count: { id: 3 } },
      { status: 'SUBMITTED', _count: { id: 7 } },
    ]);
    (prisma.etrSubmission.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', status: 'PENDING', attempts: 0, lastError: null, receipt: { receiptNumber: 'RCP-1', amount: 500, issueDate: new Date() } },
    ]);

    const res = await request(app)
      .get('/api/v1/etims/status')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.counts.PENDING).toBe(3);
    expect(res.body.data.counts.SUBMITTED).toBe(7);
    expect(res.body.data.total).toBe(10);
    expect(res.body.data.unsubmitted).toHaveLength(1);
    expect(res.body.data.note).toContain('never');
  });

  it('runs the process endpoint without crashing when nothing is pending', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.etrSubmission.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/etims/process')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(0);
  });

  it('is tenant-scoped', async () => {
    const { restaurant, token } = await setupTenant();
    (prisma.etrSubmission.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.etrSubmission.groupBy as jest.Mock).mockResolvedValue([]);

    await request(app)
      .get('/api/v1/etims/status')
      .set(getAuthHeader(token));

    const where = (prisma.etrSubmission.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.restaurantId).toBe(restaurant.id);
  });
});

describe('eTIMS PAYLOAD', () => {
  it('builds an A1 payload with the restaurant TIN and item totals', async () => {
    const { buildA1Payload } = jest.requireActual('../src/integrations/etims');
    const payload = buildA1Payload({
      receipt: {
        amount: 1160,
        vatAmount: 160,
        paymentMethod: 'MPESA',
        issueDate: new Date('2026-08-12T10:00:00Z'),
        items: [
          { itemName: 'Biryani', quantity: 1, itemPrice: 580, subtotal: 580 },
          { itemName: 'Juice', quantity: 1, itemPrice: 580, subtotal: 580 },
        ],
      },
      restaurant: { kraPin: 'P051234567X', name: 'Bahari', address: 'Mombasa', phone: '2547' },
    });

    expect(payload.tin).toBe('P051234567X');
    expect(payload.rcptTotalAmt).toBe(1160);
    expect(payload.vatAmt).toBe(160);
    expect(payload.itemList).toHaveLength(2);
    expect(payload.itemList[0].taxAmt).toBe(80); // 580 × 16/116
  });
});
