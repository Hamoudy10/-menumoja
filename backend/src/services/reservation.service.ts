import { prisma } from '@/config/database';
import { NotFoundError, ConflictError, AppError } from '@/utils/errors';
import { upsertCustomer } from './customer.service';
import { sendTransactional } from './whatsapp.service';
import logger from '@/utils/logger';

/**
 * Reservations & waitlist.
 *
 * Table integration: assigning a table to a reservation marks it RESERVED;
 * check-in marks it OCCUPIED; cancel/no-show frees it. Waitlist seating
 * marks the chosen table OCCUPIED.
 *
 * Documented simplifications: party details live on the reservation row
 * (partySize) instead of a separate ReservationParty model; assignments are
 * a tableId on the row instead of a TableAssignment model.
 */

const WAIT_PER_PARTY_MINUTES = 15;

export async function createReservation(
  restaurantId: string,
  data: { customerName: string; customerPhone: string; partySize: number; reservedAt: string; notes?: string; source?: string }
): Promise<any> {
  if (!data.customerName?.trim() || !data.customerPhone?.trim()) {
    throw AppError.validation('Customer name and phone are required', 'Jina na nambari ya simu ya mteja zinahitajika');
  }
  if (data.partySize < 1 || data.partySize > 100) {
    throw AppError.validation('Party size must be between 1 and 100', 'Idadi ya wageni lazima iwe kati ya 1 na 100');
  }

  const reservedAt = new Date(data.reservedAt);
  if (isNaN(reservedAt.getTime())) {
    throw AppError.validation('Invalid reservation time', 'Muda batili wa kuhifadhi');
  }
  if (reservedAt.getTime() < Date.now() - 5 * 60000) {
    throw AppError.validation('Reservation time must be in the future', 'Muda wa kuhifadhi lazima uwe wa baadaye');
  }

  let customer = null;
  try {
    customer = await upsertCustomer(restaurantId, {
      phone: data.customerPhone,
      name: data.customerName,
      source: (data.source as any) || 'MANUAL',
    });
  } catch (error) {
    logger.warn('Customer upsert failed during reservation', { error: (error as Error).message, restaurantId });
  }

  // Suggest a free table large enough for the party
  const candidate = await prisma.restaurantTable.findFirst({
    where: {
      restaurantId,
      status: { in: ['FREE', 'RESERVED'] },
      OR: [{ capacity: null }, { capacity: { gte: data.partySize } }],
    },
    orderBy: [{ status: 'asc' }, { capacity: 'asc' }],
    select: { id: true, label: true, status: true },
  });

  let tableId: string | null = null;
  if (candidate && candidate.status === 'FREE') {
    tableId = candidate.id;
    await prisma.restaurantTable.update({
      where: { id: candidate.id },
      data: { status: 'RESERVED' },
    });
  }

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId,
      customerId: customer?.id || null,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      partySize: data.partySize,
      reservedAt,
      tableId,
      notes: data.notes || null,
      source: data.source || 'MANUAL',
    },
    include: { table: { select: { id: true, label: true, tableNumber: true } } },
  });

  // consent-gated WhatsApp confirmation
  try {
    await sendTransactional(restaurantId, 'reservation_confirm', data.customerPhone, {
      customerName: data.customerName.trim(),
      reservedAt: reservedAt.toLocaleString('en-KE', { hour12: true }),
      partySize: data.partySize,
    });
  } catch (error) {
    logger.warn('Reservation WhatsApp notify failed', { error: (error as Error).message, restaurantId });
  }

  logger.info('Reservation created', { reservationId: reservation.id, restaurantId, partySize: data.partySize, tableId });
  return reservation;
}

export async function listReservations(restaurantId: string, date?: string): Promise<any[]> {
  const where: any = { restaurantId };
  if (date) {
    const day = new Date(date);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.reservedAt = { gte: start, lt: end };
  }

  return prisma.reservation.findMany({
    where,
    orderBy: [{ reservedAt: 'asc' }, { createdAt: 'asc' }],
    include: { table: { select: { id: true, label: true, tableNumber: true } } },
    take: 100,
  });
}

async function getReservation(restaurantId: string, id: string): Promise<any> {
  const reservation = await prisma.reservation.findFirst({ where: { id, restaurantId } });
  if (!reservation) throw new NotFoundError('Reservation not found', 'Uhifadhi haukupatikana');
  return reservation;
}

async function freeTable(reservation: any): Promise<void> {
  if (!reservation.tableId) return;
  await prisma.restaurantTable.updateMany({
    where: { id: reservation.tableId, status: 'RESERVED' },
    data: { status: 'FREE' },
  });
}

export async function updateReservation(restaurantId: string, id: string, data: { status?: string; tableId?: string; notes?: string }): Promise<any> {
  const reservation = await getReservation(restaurantId, id);

  const update: any = {};
  if (data.notes !== undefined) update.notes = data.notes;

  if (data.status) {
    const next = data.status as string;
    const allowed: Record<string, string[]> = {
      CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
      CHECKED_IN: ['COMPLETED', 'CANCELLED'],
    };
    if (!(allowed[reservation.status] || []).includes(next) && reservation.status !== next) {
      throw new ConflictError(`Cannot transition ${reservation.status} → ${next}`, 'Mabadiliko hayaruhusiwi');
    }
    update.status = next;
    if (next === 'CANCELLED' || next === 'NO_SHOW') await freeTable(reservation);
    if (next === 'CHECKED_IN' && reservation.tableId) {
      await prisma.restaurantTable.update({
        where: { id: reservation.tableId },
        data: { status: 'OCCUPIED' },
      });
    }
  }

  if (data.tableId) {
    const table = await prisma.restaurantTable.findFirst({ where: { id: data.tableId, restaurantId } });
    if (!table) throw new NotFoundError('Table not found', 'Meza haikupatikana');
    if (table.status !== 'FREE') {
      throw new ConflictError('Selected table is not available', 'Meza iliyochaguliwa haipatikani');
    }
    await freeTable(reservation);
    await prisma.restaurantTable.update({ where: { id: table.id }, data: { status: 'RESERVED' } });
    update.tableId = table.id;
  }

  return prisma.reservation.update({ where: { id }, data: update, include: { table: { select: { id: true, label: true, tableNumber: true } } } });
}

export async function checkInReservation(restaurantId: string, id: string): Promise<any> {
  return updateReservation(restaurantId, id, { status: 'CHECKED_IN' });
}

export async function cancelReservation(restaurantId: string, id: string): Promise<any> {
  return updateReservation(restaurantId, id, { status: 'CANCELLED' });
}

export async function markNoShow(restaurantId: string, id: string): Promise<any> {
  return updateReservation(restaurantId, id, { status: 'NO_SHOW' });
}

// ── Waitlist ──

export async function addToWaitlist(
  restaurantId: string,
  data: { customerName: string; customerPhone: string; partySize: number }
): Promise<any> {
  if (!data.customerName?.trim() || !data.customerPhone?.trim() || data.partySize < 1) {
    throw AppError.validation('Name, phone and party size are required', 'Jina, simu na idadi ya wageni zinahitajika');
  }

  const last = await prisma.waitlistEntry.findFirst({
    where: { restaurantId, status: 'WAITING' },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position || 0) + 1;

  let customer = null;
  try {
    customer = await upsertCustomer(restaurantId, { phone: data.customerPhone, name: data.customerName, source: 'QR' });
  } catch (error) {
    logger.warn('Customer upsert failed during waitlist', { error: (error as Error).message, restaurantId });
  }

  return prisma.waitlistEntry.create({
    data: {
      restaurantId,
      customerId: customer?.id || null,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      partySize: data.partySize,
      position,
      estimatedWaitMinutes: position * WAIT_PER_PARTY_MINUTES,
    },
  });
}

export async function listWaitlist(restaurantId: string): Promise<any[]> {
  return prisma.waitlistEntry.findMany({
    where: { restaurantId, status: 'WAITING' },
    orderBy: { position: 'asc' },
  });
}

export async function seatFromWaitlist(restaurantId: string, entryId: string, tableId: string): Promise<any> {
  const entry = await prisma.waitlistEntry.findFirst({ where: { id: entryId, restaurantId } });
  if (!entry) throw new NotFoundError('Waitlist entry not found', 'Ingizo la foleni halikupatikana');
  if (entry.status !== 'WAITING') throw new ConflictError('Entry is not waiting', 'Ingizo haliko kwenye foleni');

  const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId } });
  if (!table) throw new NotFoundError('Table not found', 'Meza haikupatikana');
  if (table.status !== 'FREE') throw new ConflictError('Table is not available', 'Meza haipatikani');

  await prisma.restaurantTable.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });

  return prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: 'SEATED', seatedTableId: table.id, seatedAt: new Date() },
  });
}

export async function cancelWaitlist(restaurantId: string, entryId: string): Promise<any> {
  const entry = await prisma.waitlistEntry.findFirst({ where: { id: entryId, restaurantId } });
  if (!entry) throw new NotFoundError('Waitlist entry not found', 'Ingizo la foleni halikupatikana');
  if (entry.status !== 'WAITING') throw new ConflictError('Entry is not waiting', 'Ingizo haliko kwenye foleni');
  return prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: 'CANCELLED' } });
}

export default {
  createReservation,
  listReservations,
  updateReservation,
  checkInReservation,
  cancelReservation,
  markNoShow,
  addToWaitlist,
  listWaitlist,
  seatFromWaitlist,
  cancelWaitlist,
};
