import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateParams, validateQuery, asyncHandler } from '@/middleware';
import { AppError, NotFoundError } from '@/utils/errors';
import { normalizeKenyanPhone, phoneQueryVariants } from '@/utils/phone';
import {
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
} from '@/services/reservation.service';

const router = Router();

// --- Public (customer-facing) reservation endpoints ---

const publicCreateSchema = z.object({
  restaurantSlug: z.string().optional(),
  restaurantId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(7).max(20),
  partySize: z.coerce.number().int().min(1).max(100),
  reservedAt: z.string(),
  tableId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
}).refine((d) => d.restaurantSlug || d.restaurantId, { message: 'restaurantSlug or restaurantId required' });

router.get('/public/tables/:slug', asyncHandler(async (req, res) => {
  const slug = String(req.params.slug);
  const restaurant = await prisma.restaurant.findUnique({ where: { slug, isActive: true }, select: { id: true } });
  if (!restaurant) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, tableNumber: true, label: true, capacity: true, status: true },
    orderBy: { tableNumber: 'asc' },
  });
  res.json({ success: true, data: tables });
}));

router.post('/public', validate(publicCreateSchema), asyncHandler(async (req, res) => {
  const { restaurantSlug, restaurantId, customerName, customerPhone, partySize, reservedAt, tableId, notes } = req.body;
  let rid = restaurantId;
  if (!rid) {
    const r = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug, isActive: true }, select: { id: true } });
    rid = r?.id;
  }
  if (!rid) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
  const reservation = await createReservation(rid, {
    customerName, customerPhone, partySize, reservedAt, tableId, notes, source: 'QR',
  });
  res.status(201).json({ success: true, data: reservation });
}));

router.post('/public/:id/cancel', asyncHandler(async (req, res) => {
  const phone = String(req.body?.phone || '');
  const reservation = await prisma.reservation.findUnique({ where: { id: String(req.params.id) } });
  if (!reservation) throw new NotFoundError('Reservation not found', 'Uhifadhi haukupatikana');
  const variants = phoneQueryVariants(phone);
  if (!variants.includes(reservation.customerPhone)) {
    throw new AppError(403, 'FORBIDDEN', 'Phone does not match reservation', 'Nambari ya simu haifanani na uhifadhi');
  }
  const updated = await cancelReservation(reservation.restaurantId, reservation.id);
  res.json({ success: true, data: updated });
}));

router.use(authenticate, enforceRestaurantScope);

const idParamSchema = z.object({ id: z.string().uuid('Invalid ID') });

const reservationQuerySchema = z.object({
  date: z.string().optional(),
}).strict();

const createReservationSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(1).max(30),
  partySize: z.number().int().min(1).max(100),
  reservedAt: z.string().min(1),
  notes: z.string().max(500).optional(),
  source: z.string().max(50).optional(),
}).strict();

const updateReservationSchema = z.object({
  status: z.enum(['CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED']).optional(),
  tableId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
}).strict();

const waitlistCreateSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(1).max(30),
  partySize: z.number().int().min(1).max(100),
}).strict();

const seatSchema = z.object({
  tableId: z.string().uuid('Invalid table ID'),
}).strict();

// ── Reservations ──

router.get('/', validateQuery(reservationQuerySchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const date = req.query.date ? String(req.query.date) : undefined;
  res.json({ success: true, data: await listReservations(restaurantId, date) });
}));

router.post('/', auditLog, validate(createReservationSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const reservation = await createReservation(restaurantId, req.body);
  res.status(201).json({ success: true, data: reservation });
}));

router.put('/:id', auditLog, validate(updateReservationSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const reservation = await updateReservation(restaurantId, String(req.params.id), req.body);
  res.json({ success: true, data: reservation });
}));

router.post('/:id/check-in', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await checkInReservation(restaurantId, String(req.params.id)) });
}));

router.post('/:id/cancel', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await cancelReservation(restaurantId, String(req.params.id)) });
}));

router.post('/:id/no-show', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await markNoShow(restaurantId, String(req.params.id)) });
}));

// ── Waitlist ──

router.get('/waitlist', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await listWaitlist(restaurantId) });
}));

router.post('/waitlist', auditLog, validate(waitlistCreateSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const entry = await addToWaitlist(restaurantId, req.body);
  res.status(201).json({ success: true, data: entry });
}));

router.post('/waitlist/:id/seat', auditLog, validate(seatSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const entry = await seatFromWaitlist(restaurantId, String(req.params.id), req.body.tableId);
  res.json({ success: true, data: entry });
}));

router.post('/waitlist/:id/cancel', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await cancelWaitlist(restaurantId, String(req.params.id)) });
}));

export default router;
