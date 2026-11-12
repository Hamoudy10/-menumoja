import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticate, enforceRestaurantScope, validate, validateParams, aiChatLimiter, asyncHandler } from '@/middleware';
import { AppError } from '@/utils/errors';
import { prisma } from '@/config/database';
import { handleCommand, confirmCommand, rejectCommand, undoCommand, getConversation } from '@/ai/command.service';
import { isTranscriptionConfigured, transcribeAudio } from '@/integrations/groq';
import type { ToolContext } from '@/ai/tools/types';

/**
 * AI Command ("Jarvis") HTTP surface — Phase A.
 *
 * Authorization context (role, restaurantId, userId) is derived from the JWT
 * by `authenticate` + `enforceRestaurantScope`. The request schema is strict,
 * so a client cannot supply role/restaurantId; doing so is a 422.
 */

const router = Router();

const uiContextSchema = z
  .object({
    route: z.string().max(200).optional(),
    screen: z.string().max(100).optional(),
    entityType: z.string().max(60).optional(),
    entityId: z.string().max(64).optional(),
  })
  .strict();

const commandSchema = z
  .object({
    text: z.string().min(1, 'Command is required').max(1000, 'Command is too long'),
    conversationId: z.string().uuid('Invalid conversation ID').optional(),
    uiContext: uiContextSchema.optional(),
  })
  .strict();

const actionIdParamSchema = z.object({ id: z.string().uuid('Invalid action ID') }).strict();
const conversationIdParamSchema = z.object({ id: z.string().uuid('Invalid conversation ID') }).strict();

function contextFrom(req: any): ToolContext {
  const restaurantId = (req as any).restaurantId;
  // Super-admins bypass enforceRestaurantScope. Fail closed rather than run a
  // command with an undefined tenant (which Prisma would treat as "all tenants").
  if (!restaurantId) {
    throw new AppError(
      400,
      'RESTAURANT_CONTEXT_REQUIRED',
      'Select a restaurant context before using AI commands',
      'Chagua muktadha wa mgahawa kabla ya kutumia amri za AI'
    );
  }
  return {
    restaurantId,
    userId: req.user!.userId,
    role: req.user!.role,
    uiContext: req.body?.uiContext,
  };
}

// POST /ai/command — text in, answer/clarification/proposal out.
router.post(
  '/command',
  authenticate,
  enforceRestaurantScope,
  aiChatLimiter,
  validate(commandSchema),
  asyncHandler(async (req: any, res: any) => {
    const result = await handleCommand(contextFrom(req), {
      text: req.body.text,
      uiContext: req.body.uiContext,
      conversationId: req.body.conversationId,
    });
    res.json({ success: true, data: result });
  })
);

// POST /ai/command/:id/confirm — explicitly execute a proposal.
router.post(
  '/command/:id/confirm',
  authenticate,
  enforceRestaurantScope,
  validateParams(actionIdParamSchema),
  asyncHandler(async (req: any, res: any) => {
    const result = await confirmCommand(contextFrom(req), String(req.params.id));
    res.json({ success: true, data: result });
  })
);

// POST /ai/command/:id/reject — decline a proposal.
router.post(
  '/command/:id/reject',
  authenticate,
  enforceRestaurantScope,
  validateParams(actionIdParamSchema),
  asyncHandler(async (req: any, res: any) => {
    await rejectCommand(contextFrom(req), String(req.params.id));
    res.json({ success: true, data: { message: 'Action rejected.' } });
  })
);

// POST /ai/command/:id/undo — compensating undo inside the window.
router.post(
  '/command/:id/undo',
  authenticate,
  enforceRestaurantScope,
  validateParams(actionIdParamSchema),
  asyncHandler(async (req: any, res: any) => {
    const result = await undoCommand(contextFrom(req), String(req.params.id));
    res.json({ success: true, data: result });
  })
);

// GET /ai/command/conversations/:id — follow-up history (tenant-scoped).
router.get(
  '/command/conversations/:id',
  authenticate,
  enforceRestaurantScope,
  validateParams(conversationIdParamSchema),
  asyncHandler(async (req: any, res: any) => {
    const conversation = await getConversation(contextFrom(req), String(req.params.id));
    res.json({ success: true, data: conversation });
  })
);

// ── Speech-to-text (Phase B surface; requires GROQ_API_KEY) ──

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm';
    if (!ok) {
      cb(new AppError(422, 'INVALID_AUDIO_TYPE', 'Only audio recordings are accepted', 'Rekodi za sauti pekee zinakubaliwa') as any);
      return;
    }
    cb(null, true);
  },
});

function uploadAudio(req: Request, res: Response, next: NextFunction): void {
  upload.single('audio')(req, res, (error: any) => {
    if (!error) return next();
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(422, 'AUDIO_TOO_LARGE', 'Audio must be 5MB or smaller', 'Sauti lazima iwe 5MB au ndogo'));
    }
    return next(error);
  });
}

async function buildTranscriptionPrompt(restaurantId: string): Promise<string> {
  try {
    const [items, tables] = await Promise.all([
      prisma.menuItem.findMany({ where: { restaurantId }, select: { name: true }, take: 25, orderBy: { totalOrders: 'desc' } }),
      prisma.restaurantTable.findMany({ where: { restaurantId }, select: { label: true, tableNumber: true }, take: 25 }),
    ]);
    const menu = items.map((i) => i.name).join(', ');
    const tableLabels = tables.map((t) => t.label || `Table ${t.tableNumber}`).join(', ');
    const swahili = 'chakula, meza, mhudumu, oda, bei, stock, available, unavailable, malipo, risiti';
    return [menu, tableLabels, swahili].filter(Boolean).join('. ').slice(0, 900);
  } catch {
    return '';
  }
}

// POST /ai/command/transcribe — audio → text. Audio is processed in memory and never stored.
router.post(
  '/command/transcribe',
  authenticate,
  enforceRestaurantScope,
  aiChatLimiter,
  uploadAudio,
  asyncHandler(async (req: any, res: any) => {
    if (!isTranscriptionConfigured()) {
      throw new AppError(
        503,
        'TRANSCRIPTION_NOT_CONFIGURED',
        'Voice transcription is not configured yet. Type your command instead.',
        'Uhamishaji wa sauti haujasanidiwa bado. Andika amri yako badala yake.'
      );
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      throw AppError.validation('An audio file is required', 'Faili ya sauti inahitajika');
    }

    const language = typeof req.body?.language === 'string' ? req.body.language.slice(0, 5) : undefined;
    const prompt = await buildTranscriptionPrompt((req as any).restaurantId);

    const result = await transcribeAudio(file.buffer, file.originalname || 'command.webm', { language, prompt });
    res.json({ success: true, data: { text: result.text, provider: result.provider } });
  })
);

export default router;
