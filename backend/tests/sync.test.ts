// NOTE: `./helpers` must be imported before the service under test. It
// registers the Prisma/Redis module mocks; if the service is imported first it
// binds to the real Prisma client and the tests hit a live database.
import { prisma, cleanupTestData } from './helpers';
import { Prisma } from '@prisma/client';
import {
  recordMutation,
  findOrderByClientTxn,
  findPaymentByClientTxn,
  requireDeviceIdentity,
} from '../src/services/sync.service';

beforeEach(() => {
  cleanupTestData();
});

describe('SYNC ENGINE (offline-first)', () => {
  it('requires device identity for replayed mutations', () => {
    expect(() => requireDeviceIdentity('', '')).toThrow();
    expect(() => requireDeviceIdentity('dev-1', 'txn')).not.toThrow();
  });

  it('skips the durable outbox when no device identity is present', async () => {
    const result = await recordMutation({
      restaurantId: 'r-1',
      deviceId: null,
      clientTransactionId: null,
      entityType: 'ORDER',
      mutationType: 'pos_order',
      payload: {},
    });
    expect(result.change).toBeNull();
    expect(result.isNew).toBe(false);
    expect(prisma.syncChange.create).not.toHaveBeenCalled();
  });

  it('records a mutation into the outbox when device identity is present', async () => {
    (prisma.syncChange.create as jest.Mock).mockResolvedValue({ id: 'change-1', status: 'PENDING' });
    const result = await recordMutation({
      restaurantId: 'r-1',
      deviceId: 'dev-1',
      clientTransactionId: 'txn-1',
      entityType: 'ORDER',
      mutationType: 'pos_order',
      payload: { orderId: 'o-1' },
    });
    expect(result.isNew).toBe(true);
    expect(prisma.syncChange.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ restaurantId: 'r-1', deviceId: 'dev-1', clientTransactionId: 'txn-1' }),
    }));
  });

  it('returns the existing change on a unique-violation replay (idempotent)', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.0' });
    (prisma.syncChange.create as jest.Mock).mockRejectedValue(error);
    (prisma.syncChange.findUnique as jest.Mock).mockResolvedValue({ id: 'change-1', status: 'PENDING' });

    const result = await recordMutation({
      restaurantId: 'r-1',
      deviceId: 'dev-1',
      clientTransactionId: 'txn-1',
      entityType: 'ORDER',
      mutationType: 'pos_order',
      payload: {},
    });
    expect(result.isNew).toBe(false);
    expect(result.change?.id).toBe('change-1');
  });

  it('looks up an existing order by device+transaction for idempotent replay', async () => {
    const order = { id: 'o-1', orderNumber: 'OR-001' };
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    const found = await findOrderByClientTxn('r-1', 'dev-1', 'txn-1');
    expect(found?.id).toBe('o-1');
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantId: 'r-1', deviceId: 'dev-1', clientTransactionId: 'txn-1' },
    }));
  });

  it('looks up an existing payment by device+transaction', async () => {
    const payment = { id: 'p-1', orderId: 'o-1' };
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(payment);
    const found = await findPaymentByClientTxn('r-1', 'dev-1', 'txn-1');
    expect(found?.id).toBe('p-1');
  });
});
