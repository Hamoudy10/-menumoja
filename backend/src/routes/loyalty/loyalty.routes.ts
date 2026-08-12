import { Router } from 'express';
import { z } from 'zod';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateParams, asyncHandler } from '@/middleware';
import { NotFoundError } from '@/utils/errors';
import {
  getOrCreateProgram,
  updateProgram,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  listAccounts,
  getAccountDetail,
  manualAdjust,
  listRewards,
  redeemReward,
  cancelReward,
} from '@/services/loyalty.service';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const customerParamSchema = z.object({ customerId: z.string().uuid('Invalid customer ID') });
const rewardParamSchema = z.object({ rewardId: z.string().uuid('Invalid reward ID') });
const ruleParamSchema = z.object({ id: z.string().uuid('Invalid rule ID') });

const programSchema = z.object({
  name: z.string().max(100).optional(),
  pointsPerKes: z.number().min(0).max(100000).optional(),
  pointsExpiryDays: z.number().int().min(1).max(3650).optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  triggerType: z.enum(['VISIT_COUNT', 'SPEND_THRESHOLD', 'ITEM_COUNT', 'CATEGORY_PURCHASE', 'INACTIVITY', 'BIRTHDAY']),
  triggerValue: z.union([z.string(), z.number()]),
  rewardType: z.enum(['FREE_ITEM', 'DISCOUNT', 'FIXED_AMOUNT', 'PERCENTAGE', 'POINTS', 'BUNDLE']),
  rewardValue: z.union([z.string(), z.number()]),
  rewardItemId: z.string().uuid().optional().nullable(),
  rewardQuantity: z.number().int().min(1).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  usageLimit: z.number().int().min(1).max(1000).optional(),
}).strict();

const ruleUpdateSchema = ruleSchema.partial().extend({ isActive: z.boolean().optional() }).strict();

const adjustSchema = z.object({
  points: z.number().int().min(-1000000).max(1000000).refine((v) => v !== 0, 'Points must be non-zero'),
  reason: z.string().min(1).max(300),
}).strict();

// ── Program ──

router.get('/program', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const program = await getOrCreateProgram(restaurantId);
  res.json({ success: true, data: program });
}));

router.put('/program', auditLog, validate(programSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const program = await updateProgram(restaurantId, req.body);
  res.json({ success: true, data: program });
}));

// ── Rules ──

router.get('/rules', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await listRules(restaurantId) });
}));

router.post('/rules', auditLog, validate(ruleSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const rule = await createRule(restaurantId, req.body);
  res.status(201).json({ success: true, data: rule });
}));

router.put('/rules/:id', auditLog, validate(ruleUpdateSchema), validateParams(ruleParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const rule = await updateRule(restaurantId, String(req.params.id), req.body);
  res.json({ success: true, data: rule });
}));

router.delete('/rules/:id', auditLog, validateParams(ruleParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  await deleteRule(restaurantId, String(req.params.id));
  res.json({ success: true, data: { message: 'Rule deleted' } });
}));

// ── Accounts ──

router.get('/accounts', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await listAccounts(restaurantId) });
}));

router.get('/accounts/:customerId', validateParams(customerParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const detail = await getAccountDetail(restaurantId, String(req.params.customerId));
  res.json({ success: true, data: detail });
}));

router.post('/accounts/:customerId/adjust', auditLog, validate(adjustSchema), validateParams(customerParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const { points, reason } = req.body;
  const account = await manualAdjust(restaurantId, String(req.params.customerId), points, reason, req.user?.userId);
  res.json({ success: true, data: account });
}));

// ── Rewards ──

router.get('/rewards', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  res.json({ success: true, data: await listRewards(restaurantId, customerId) });
}));

router.post('/rewards/:rewardId/redeem', auditLog, validateParams(rewardParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const reward = await redeemReward(restaurantId, String(req.params.rewardId));
  res.json({ success: true, data: reward });
}));

router.post('/rewards/:rewardId/cancel', auditLog, validateParams(rewardParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const reward = await cancelReward(restaurantId, String(req.params.rewardId));
  res.json({ success: true, data: reward });
}));

export default router;
