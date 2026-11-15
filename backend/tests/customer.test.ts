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
import { classifyCustomer, upsertCustomer, recordCustomerSpend, reverseCustomerSpend } from '../src/services/customer.service';

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

describe('CUSTOMER LIST & DETAIL', () => {
  it('lists customers with search and segment counts', async () => {
    const { restaurant, token } = await setupTenant();
    const named = [
      { id: uuidv4(), restaurantId: restaurant.id, phone: '254712345678', name: 'Jane Doe', email: null, totalVisits: 8, totalSpend: 25000, firstVisit: new Date(Date.now() - 100 * 86400000), lastVisit: new Date(), averageSpend: 3125, consentMarketing: false, isOptedOut: false, preferredChannel: null },
    ];
    (prisma.customer.findMany as jest.Mock).mockResolvedValue(named);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/customers?search=Jane')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Jane Doe');
    expect(res.body.data[0].segments).toEqual(expect.arrayContaining(['VIP', 'Frequent', 'High spender']));
    expect(res.body.meta.total).toBe(1);
    expect(res.body.segments.VIP).toBe(1);
  });

  it('normalizes phone searches and filters segments across the whole dataset', async () => {
    const { restaurant, token } = await setupTenant();
    const customers = [
      { id: uuidv4(), restaurantId: restaurant.id, phone: '254712345678', name: 'Jane Doe', email: 'jane@example.com', totalVisits: 8, totalSpend: 25000, firstVisit: new Date(Date.now() - 100 * 86400000), lastVisit: new Date(), averageSpend: 3125 },
      { id: uuidv4(), restaurantId: restaurant.id, phone: '254700000002', name: 'John Doe', email: null, totalVisits: 1, totalSpend: 500, firstVisit: new Date(), lastVisit: new Date(), averageSpend: 500 },
      { id: uuidv4(), restaurantId: restaurant.id, phone: '254700000003', name: 'Mary Doe', email: null, totalVisits: 6, totalSpend: 12000, firstVisit: new Date(Date.now() - 200 * 86400000), lastVisit: new Date(), averageSpend: 2000 },
    ];
    (prisma.customer.findMany as jest.Mock).mockResolvedValue(customers);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      // Jane buys lunch regularly -> Lunch customer
      { customerPhone: '0712345678', createdAt: new Date('2026-11-02T12:30:00+03:00'), items: [] },
      { customerPhone: '+254712345678', createdAt: new Date('2026-11-03T12:30:00+03:00'), items: [] },
    ]);

    const search = await request(app)
      .get('/api/v1/customers?search=0712')
      .set(getAuthHeader(token));

    expect(search.status).toBe(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].phone).toBe('254712345678');

    const filtered = await request(app)
      .get('/api/v1/customers?segment=lunch%20customer&perPage=2')
      .set(getAuthHeader(token));

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].name).toBe('Jane Doe');
    expect(filtered.body.meta.total).toBe(1);
    expect(filtered.body.segments['Lunch customer']).toBe(1);
  });

  it('returns favourites, segments and recent orders for a customer', async () => {
    const { restaurant, token } = await setupTenant();
    const customerId = uuidv4();
    const itemId = uuidv4();

    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
      id: customerId, restaurantId: restaurant.id, phone: '254700000001', name: 'VIP Guest',
      totalVisits: 10, totalSpend: 30000, averageSpend: 3000,
      firstVisit: new Date(Date.now() - 200 * 86400000), lastVisit: new Date(),
    });
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), createdAt: new Date(), totalAmount: 1000, items: [{ itemName: 'Biryani', quantity: 1 }] },
    ]);
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([{ menuItemId: itemId, _sum: { quantity: 4 } }]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([{ id: itemId, name: 'Biryani', category: { name: 'Main Course' } }]);

    const res = await request(app)
      .get(`/api/v1/customers/${customerId}`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.favouriteItems).toContain('Biryani');
    expect(res.body.data.favouriteCategories).toContain('Main Course');
    expect(res.body.data.segment).toContain('VIP');
    expect(res.body.data.segment).toContain('Frequent');
    expect(res.body.data.recentOrders).toHaveLength(1);
  });
});

describe('CUSTOMER CONSENT & PRIVACY', () => {
  it('updates marketing consent and opt-out flags', async () => {
    const { restaurant, token } = await setupTenant();
    const customerId = uuidv4();

    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: customerId, restaurantId: restaurant.id, consentCollectedAt: null });
    (prisma.customer.update as jest.Mock).mockResolvedValue({ id: customerId, consentMarketing: true });

    const res = await request(app)
      .put(`/api/v1/customers/${customerId}`)
      .set(getAuthHeader(token))
      .send({ consentMarketing: true, preferredChannel: 'whatsapp' });

    expect(res.status).toBe(200);
    const updateData = (prisma.customer.update as jest.Mock).mock.calls[0][0].data;
    expect(updateData.consentMarketing).toBe(true);
    expect(updateData.consentCollectedAt).toBeDefined();
    expect(updateData.preferredChannel).toBe('whatsapp');
  });

  it('anonymizes related order and payment PII on privacy deletion', async () => {
    const { restaurant, token } = await setupTenant();
    const customerId = uuidv4();

    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: customerId, restaurantId: restaurant.id, phone: '254712345678' });
    (prisma.order.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
    (prisma.payment.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.customer.delete as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .delete(`/api/v1/customers/${customerId}`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(prisma.order.updateMany).toHaveBeenCalled();
    const orderWhere = (prisma.order.updateMany as jest.Mock).mock.calls[0][0].where;
    expect(orderWhere.customerPhone.in).toEqual(expect.arrayContaining(['254712345678', '+254712345678', '0712345678']));
    const orderData = (prisma.order.updateMany as jest.Mock).mock.calls[0][0].data;
    expect(orderData.customerPhone).toBeNull();
    expect(prisma.reservation.updateMany).toHaveBeenCalled();
    expect(prisma.waitlistEntry.updateMany).toHaveBeenCalled();
    expect(prisma.campaignDelivery.updateMany).toHaveBeenCalled();
    expect(prisma.customer.delete).toHaveBeenCalledTimes(1);
  });

  it('exports all stored customer data', async () => {
    const { restaurant, token } = await setupTenant();
    const customerId = uuidv4();

    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: customerId, restaurantId: restaurant.id, phone: '254712345678', name: 'Jane' });
    (prisma.order.findMany as jest.Mock).mockResolvedValue([
      { id: uuidv4(), orderNumber: 'ORD-1', createdAt: new Date(), totalAmount: 500, status: 'SERVED', paymentStatus: 'PAID', items: [] },
    ]);

    const res = await request(app)
      .get(`/api/v1/customers/${customerId}/export`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe('Jane');
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.exportedAt).toBeDefined();
  });
});

describe('SEGMENT CLASSIFICATION', () => {
  it('classifies VIP, frequent, new, dormant and time-based segments', () => {
    const now = Date.now();
    const vip = classifyCustomer({
      totalSpend: 25000, totalVisits: 10,
      firstVisit: new Date(now - 300 * 86400000), lastVisit: new Date(now - 2 * 86400000),
      lunchShare: 0.6, dinnerShare: 0.1, weekendShare: 0.2, topCategoryShare: 0.7,
    });
    expect(vip).toContain('VIP');
    expect(vip).toContain('Frequent');
    expect(vip).toContain('High spender');
    expect(vip).toContain('Lunch customer');
    expect(vip).toContain('Category-loyal');
    expect(vip).not.toContain('Dormant');

    const newbie = classifyCustomer({
      totalSpend: 800, totalVisits: 1,
      firstVisit: new Date(now - 5 * 86400000), lastVisit: new Date(now - 5 * 86400000),
      lunchShare: 0, dinnerShare: 0, weekendShare: 0, topCategoryShare: 0,
    });
    expect(newbie).toContain('New');
    expect(newbie).not.toContain('VIP');

    const dormant = classifyCustomer({
      totalSpend: 5000, totalVisits: 4,
      firstVisit: new Date(now - 400 * 86400000), lastVisit: new Date(now - 120 * 86400000),
      lunchShare: 0, dinnerShare: 0.6, weekendShare: 0.5, topCategoryShare: 0,
    });
    expect(dormant).toContain('Dormant');
    expect(dormant).toContain('Dinner customer');
    expect(dormant).toContain('Weekend customer');
  });
});

describe('CUSTOMER IDENTITY & METRICS', () => {
  it('counts a visit at most once per Kenya calendar day', async () => {
    const { restaurant } = await setupTenant();
    const base = {
      id: uuidv4(), restaurantId: restaurant.id, phone: '254712345678',
      firstVisit: new Date(Date.now() - 30 * 86400000), consentMarketing: false, consentCollectedAt: null,
    };

    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
      ...base, lastVisit: new Date(), lastVisitCountedAt: new Date(), totalVisits: 3,
    });
    (prisma.customer.update as jest.Mock).mockResolvedValue({});

    await upsertCustomer(restaurant.id, { phone: '0712345678' }, { countVisit: true });

    let updateData = (prisma.customer.update as jest.Mock).mock.calls.at(-1)[0].data;
    expect(updateData.totalVisits).toBeUndefined();
    expect(updateData.lastVisit).toBeInstanceOf(Date);

    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
      ...base, lastVisit: new Date(Date.now() - 2 * 86400000), lastVisitCountedAt: new Date(Date.now() - 2 * 86400000), totalVisits: 3,
    });

    await upsertCustomer(restaurant.id, { phone: '0712345678' }, { countVisit: true });

    updateData = (prisma.customer.update as jest.Mock).mock.calls.at(-1)[0].data;
    expect(updateData.totalVisits).toEqual({ increment: 1 });
    expect(updateData.lastVisitCountedAt).toBeInstanceOf(Date);
  });

  it('does not create customers for invalid phone numbers', async () => {
    const { restaurant } = await setupTenant();
    const result = await upsertCustomer(restaurant.id, { phone: 'not-a-phone' });
    expect(result).toBeNull();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('accrues and reverses spend without going negative', async () => {
    const { restaurant } = await setupTenant();
    (prisma.customer.findFirst as jest.Mock).mockResolvedValue({ id: 'cust-1', totalSpend: 1000, totalVisits: 2 });
    (prisma.customer.update as jest.Mock).mockResolvedValue({});

    await recordCustomerSpend(restaurant.id, '0712345678', 500);
    let data = (prisma.customer.update as jest.Mock).mock.calls.at(-1)[0].data;
    expect(data.totalSpend).toBe(1500);
    expect(data.averageSpend).toBe(750);

    await reverseCustomerSpend(restaurant.id, '0712345678', 5000);
    data = (prisma.customer.update as jest.Mock).mock.calls.at(-1)[0].data;
    expect(data.totalSpend).toBe(0);
    expect(data.averageSpend).toBe(0);
  });
});
