import { Router } from 'express';
import { z } from 'zod';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateParams, validateQuery, asyncHandler } from '@/middleware';
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
