import { Router } from 'express';
import { z } from 'zod';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateParams, asyncHandler } from '@/middleware';
import { buildPaginationMeta } from '@/utils/helpers';
import {
  getSettings,
  saveSettings,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCampaigns,
  createCampaign,
  getCampaign,
  sendCampaign,
  deleteCampaign,
} from '@/services/whatsapp.service';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const idParamSchema = z.object({ id: z.string().uuid('Invalid ID') });

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  businessPhone: z.string().max(30).optional().nullable(),
}).strict();

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(4000),
  isActive: z.boolean().optional(),
}).strict();

const templateUpdateSchema = templateSchema.partial().strict();

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  audienceSegment: z.string().max(50).optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
}).strict();

// ── Settings ──

router.get('/settings', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await getSettings(restaurantId) });
}));

router.put('/settings', auditLog, validate(settingsSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await saveSettings(restaurantId, req.body) });
}));

// ── Templates ──

router.get('/templates', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await listTemplates(restaurantId) });
}));

router.post('/templates', auditLog, validate(templateSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const template = await createTemplate(restaurantId, req.body);
  res.status(201).json({ success: true, data: template });
}));

router.put('/templates/:id', auditLog, validate(templateUpdateSchema), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await updateTemplate(restaurantId, String(req.params.id), req.body) });
}));

router.delete('/templates/:id', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  await deleteTemplate(restaurantId, String(req.params.id));
  res.json({ success: true, data: { message: 'Template deleted' } });
}));

// ── Campaigns ──

router.get('/campaigns', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await listCampaigns(restaurantId) });
}));

router.post('/campaigns', auditLog, validate(campaignSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const campaign = await createCampaign(restaurantId, req.body);
  res.status(201).json({ success: true, data: campaign });
}));

router.get('/campaigns/:id', validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const campaign = await getCampaign(restaurantId, String(req.params.id));
  res.json({
    success: true,
    data: {
      ...campaign,
      revenueAttributed: campaign.events.reduce((sum: number, e: any) => sum + Number(e.value), 0),
      conversions: campaign.events.filter((e: any) => e.type === 'ORDER').length,
    },
  });
}));

router.post('/campaigns/:id/send', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const campaign = await sendCampaign(restaurantId, String(req.params.id));
  res.json({ success: true, data: campaign });
}));

router.delete('/campaigns/:id', auditLog, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  await deleteCampaign(restaurantId, String(req.params.id));
  res.json({ success: true, data: { message: 'Campaign deleted' } });
}));

export default router;
