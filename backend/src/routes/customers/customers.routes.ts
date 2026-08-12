import { Router } from 'express';
import { z } from 'zod';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateQuery, validateParams, asyncHandler } from '@/middleware';
import { buildPaginationMeta } from '@/utils/helpers';
import {
  upsertCustomer,
  recordCustomerSpend,
  getCustomer,
  listCustomers,
  updateCustomer,
  exportCustomer,
  deleteCustomer,
} from '@/services/customer.service';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const idParamSchema = z.object({ id: z.string().uuid('Invalid customer ID') });

const customerListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  segment: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().max(500).optional().nullable(),
  preferredChannel: z.string().max(50).optional().nullable(),
  consentMarketing: z.boolean().optional(),
  isOptedOut: z.boolean().optional(),
}).strict();

// GET /customers - list with search + segment filter
router.get('/', validateQuery(customerListQuerySchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const { search, segment, page, perPage } = req.query as any;

  const result = await listCustomers(restaurantId, {
    search: search || undefined,
    segment: segment || undefined,
    page: Math.max(1, Number(page) || 1),
    perPage: Math.min(100, Math.max(1, Number(perPage) || 20)),
  });

  res.json({
    success: true,
    data: result.customers,
    meta: buildPaginationMeta(result.total, Number(page) || 1, Number(perPage) || 20),
    segments: result.segments,
  });
}));

// GET /customers/:id - detail with favourites + segments + recent orders
router.get('/:id', validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const customer = await getCustomer(restaurantId, String(req.params.id));
  res.json({ success: true, data: customer });
}));

// PUT /customers/:id - profile + marketing consent updates
router.put('/:id', auditLog, validate(updateCustomerSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const customer = await updateCustomer(restaurantId, String(req.params.id), {
    ...req.body,
    email: req.body.email === '' ? null : req.body.email,
  });
  res.json({ success: true, data: customer });
}));

// GET /customers/:id/export - privacy data export
router.get('/:id/export', validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const data = await exportCustomer(restaurantId, String(req.params.id));
  res.json({ success: true, data });
}));

// DELETE /customers/:id - privacy deletion (anonymizes related orders/payments)
router.delete('/:id', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  await deleteCustomer(restaurantId, String(req.params.id));
  res.json({ success: true, data: { message: 'Customer deleted' } });
}));

export default router;
