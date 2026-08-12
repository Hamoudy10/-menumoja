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

describe('RESERVATIONS', () => {
  it('creates a reservation, suggests a free table and marks it RESERVED', async () => {
    const { restaurant, token } = await setupTenant();
    const tableId = uuidv4();

    (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.customer.create as jest.Mock).mockResolvedValue({ id: 'c1', phone: '254712345678' });
    (prisma.restaurantTable.findFirst as jest.Mock).mockResolvedValue({ id: tableId, label: 'Table 1', status: 'FREE', capacity: 4 });
    (prisma.restaurantTable.update as jest.Mock).mockResolvedValue({});
    (prisma.reservation.create as jest.Mock).mockResolvedValue({
      id: uuidv4(), restaurantId: restaurant.id, partySize: 2, status: 'CONFIRMED', table: { id: tableId, label: 'Table 1', tableNumber: 1 },
    });

    const res = await request(app)
      .post('/api/v1/reservations')
      .set(getAuthHeader(token))
      .send({
        customerName: 'Jane Doe',
        customerPhone: '+254712345678',
        partySize: 2,
        reservedAt: new Date(Date.now() + 3600000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('CONFIRMED');
    // the free table must be marked RESERVED
    expect(prisma.restaurantTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RESERVED' }) })
    );
  });

  it('rejects past reservation times', async () => {
    const { restaurant, token } = await setupTenant();
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(getAuthHeader(token))
      .send({
        customerName: 'Jane',
        customerPhone: '+254712345678',
        partySize: 2,
        reservedAt: new Date(Date.now() - 86400000).toISOString(),
      });

    expect(res.status).toBe(422);
    expect(prisma.reservation.create).not.toHaveBeenCalled();
  });

  it('check-in marks the assigned table OCCUPIED', async () => {
    const { restaurant, token } = await setupTenant();
    const reservationId = uuidv4();
    const tableId = uuidv4();

    (prisma.reservation.findFirst as jest.Mock).mockResolvedValue({
      id: reservationId, restaurantId: restaurant.id, status: 'CONFIRMED', tableId,
    });
    (prisma.restaurantTable.update as jest.Mock).mockResolvedValue({});
    (prisma.reservation.update as jest.Mock).mockResolvedValue({ id: reservationId, status: 'CHECKED_IN' });

    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(prisma.restaurantTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: tableId }, data: expect.objectContaining({ status: 'OCCUPIED' }) })
    );
  });

  it('cancel frees a RESERVED table', async () => {
    const { restaurant, token } = await setupTenant();
    const reservationId = uuidv4();
    const tableId = uuidv4();

    (prisma.reservation.findFirst as jest.Mock).mockResolvedValue({
      id: reservationId, restaurantId: restaurant.id, status: 'CONFIRMED', tableId,
    });
    (prisma.restaurantTable.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.reservation.update as jest.Mock).mockResolvedValue({ id: reservationId, status: 'CANCELLED' });

    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    const updateManyData = (prisma.restaurantTable.updateMany as jest.Mock).mock.calls[0][0].data;
    expect(updateManyData.status).toBe('FREE');
  });

  it('rejects invalid transitions', async () => {
    const { restaurant, token } = await setupTenant();
    const reservationId = uuidv4();

    (prisma.reservation.findFirst as jest.Mock).mockResolvedValue({
      id: reservationId, restaurantId: restaurant.id, status: 'CANCELLED', tableId: null,
    });

    const res = await request(app)
      .put(`/api/v1/reservations/${reservationId}`)
      .set(getAuthHeader(token))
      .send({ status: 'CHECKED_IN' });

    expect(res.status).toBe(409);
  });
});

describe('WAITLIST', () => {
  it('assigns position and estimated wait on add', async () => {
    const { restaurant, token } = await setupTenant();

    (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue({ position: 2 });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.customer.create as jest.Mock).mockResolvedValue({ id: 'c2' });
    (prisma.waitlistEntry.create as jest.Mock).mockResolvedValue({ id: uuidv4(), position: 3, estimatedWaitMinutes: 45 });

    const res = await request(app)
      .post('/api/v1/reservations/waitlist')
      .set(getAuthHeader(token))
      .send({ customerName: 'John', customerPhone: '+254722222222', partySize: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.position).toBe(3);
    expect(res.body.data.estimatedWaitMinutes).toBe(45);
  });

  it('seats an entry on a FREE table and marks it OCCUPIED', async () => {
    const { restaurant, token } = await setupTenant();
    const entryId = uuidv4();
    const tableId = uuidv4();

    (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue({ id: entryId, restaurantId: restaurant.id, status: 'WAITING' });
    (prisma.restaurantTable.findFirst as jest.Mock).mockResolvedValue({ id: tableId, restaurantId: restaurant.id, status: 'FREE' });
    (prisma.restaurantTable.update as jest.Mock).mockResolvedValue({});
    (prisma.waitlistEntry.update as jest.Mock).mockResolvedValue({ id: entryId, status: 'SEATED', seatedTableId: tableId });

    const res = await request(app)
      .post(`/api/v1/reservations/waitlist/${entryId}/seat`)
      .set(getAuthHeader(token))
      .send({ tableId });

    expect(res.status).toBe(200);
    expect(prisma.restaurantTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'OCCUPIED' }) })
    );
  });

  it('rejects seating on an unavailable table', async () => {
    const { restaurant, token } = await setupTenant();
    const entryId = uuidv4();

    (prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue({ id: entryId, restaurantId: restaurant.id, status: 'WAITING' });
    (prisma.restaurantTable.findFirst as jest.Mock).mockResolvedValue({ id: uuidv4(), restaurantId: restaurant.id, status: 'OCCUPIED' });

    const res = await request(app)
      .post(`/api/v1/reservations/waitlist/${entryId}/seat`)
      .set(getAuthHeader(token))
      .send({ tableId: uuidv4() });

    expect(res.status).toBe(409);
  });
});
