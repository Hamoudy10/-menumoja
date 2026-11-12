import { prisma, cleanupTestData } from './helpers';
import {
  detectLowStock,
  detectWaitingOrders,
  detectExpiringSubscription,
  pushDailyBriefing,
  runProactiveChecks,
} from '../src/services/proactive.service';
import { generateDailyBriefing } from '../src/services/ai-manager.service';

jest.mock('@/services/ai-manager.service', () => ({
  generateDailyBriefing: jest.fn(),
}));

const restaurant = {
  id: '11111111-1111-1111-1111-111111111111',
  ownerId: '22222222-2222-2222-2222-222222222222',
  name: 'Test Restaurant',
  subscriptionStatus: 'TRIAL',
  trialEndsAt: null as Date | null,
  planExpiresAt: null as Date | null,
};

const DAY = 24 * 60 * 60 * 1000;

function prime() {
  (prisma.notification.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.notification.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'notif-1', ...data }));
  (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.restaurant.findMany as jest.Mock).mockResolvedValue([restaurant]);
  (generateDailyBriefing as jest.Mock).mockResolvedValue({
    revenue: 5000,
    orders: 10,
    changePct: 12.5,
    insights: [{ title: 'Revenue up 12.5%' }, { title: 'Top seller: Tilapia' }],
  });
}

beforeEach(() => {
  cleanupTestData();
  prime();
});

describe('proactive detector — low stock', () => {
  it('creates one LOW_STOCK alert with pre-wired actions', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'i-1', name: 'Tilapia', unit: 'kg', isActive: true, reorderLevel: 5 },
    ]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([
      { itemId: 'i-1', _sum: { quantity: 3 } },
    ]);

    const created = await detectLowStock(restaurant);

    expect(created).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'LOW_STOCK',
          recipientType: 'OWNER',
          recipientId: restaurant.ownerId,
          data: expect.objectContaining({
            kind: 'low_stock',
            actions: expect.arrayContaining([
              expect.objectContaining({ kind: 'navigate', to: '/dashboard/inventory' }),
              expect.objectContaining({ kind: 'command' }),
            ]),
          }),
        }),
      })
    );
  });

  it('does not repeat within the dedupe window', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'i-1', name: 'Tilapia', unit: 'kg', isActive: true, reorderLevel: 5 },
    ]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([
      { itemId: 'i-1', _sum: { quantity: 3 } },
    ]);
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

    const created = await detectLowStock(restaurant);

    expect(created).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('proactive detector — waiting orders', () => {
  it('alerts on orders older than the threshold', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'o-1',
        orderNumber: 'ORD-1234',
        tableNumber: 5,
        status: 'PREPARING',
        createdAt: new Date(Date.now() - 35 * 60_000),
      },
    ]);

    const created = await detectWaitingOrders(restaurant);

    expect(created).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'ORDER_WAITING',
          data: expect.objectContaining({ kind: 'waiting_orders' }),
        }),
      })
    );
  });

  it('does nothing when there are no old orders', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    const created = await detectWaitingOrders(restaurant);
    expect(created).toBe(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('proactive detector — subscription expiry', () => {
  it('alerts when a paid plan expires within the window', async () => {
    const created = await detectExpiringSubscription({
      ...restaurant,
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: new Date(Date.now() + 2 * DAY),
    });

    expect(created).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'SUBSCRIPTION_EXPIRING' }),
      })
    );
  });

  it('ignores plans further out than the window', async () => {
    const created = await detectExpiringSubscription({
      ...restaurant,
      subscriptionStatus: 'ACTIVE',
      planExpiresAt: new Date(Date.now() + 30 * DAY),
    });
    expect(created).toBe(0);
  });
});

describe('proactive detector — daily briefing', () => {
  it('pushes one deterministic briefing per day after the configured hour', async () => {
    const now = new Date(2026, 10, 12, 9, 0, 0);
    const created = await pushDailyBriefing(restaurant, now);

    expect(created).toBe(1);
    expect(generateDailyBriefing).toHaveBeenCalledWith(restaurant.id, now);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DAILY_BRIEFING',
          data: expect.objectContaining({ kind: 'daily_briefing' }),
        }),
      })
    );
  });

  it('does not push before the configured hour', async () => {
    const now = new Date(2026, 10, 12, 5, 0, 0);
    const created = await pushDailyBriefing(restaurant, now);
    expect(created).toBe(0);
    expect(generateDailyBriefing).not.toHaveBeenCalled();
  });
});

describe('runProactiveChecks', () => {
  it('runs all detectors and returns counts', async () => {
    const now = new Date(2026, 10, 12, 9, 0, 0);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'i-1', name: 'Tilapia', unit: 'kg', isActive: true, reorderLevel: 5 },
    ]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([
      { itemId: 'i-1', _sum: { quantity: 1 } },
    ]);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'o-1',
        orderNumber: 'ORD-1',
        tableNumber: 2,
        status: 'PENDING',
        createdAt: new Date(now.getTime() - 40 * 60_000),
      },
    ]);
    (prisma.restaurant.findMany as jest.Mock).mockResolvedValue([
      {
        ...restaurant,
        subscriptionStatus: 'ACTIVE',
        planExpiresAt: new Date(now.getTime() + DAY),
      },
    ]);

    const result = await runProactiveChecks(now);

    expect(result.restaurants).toBe(1);
    expect(result.lowStock).toBe(1);
    expect(result.waitingOrders).toBe(1);
    expect(result.expiringSubscriptions).toBe(1);
    expect(result.dailyBriefings).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledTimes(4);
  });
});
