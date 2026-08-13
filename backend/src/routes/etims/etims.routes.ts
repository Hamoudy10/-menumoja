import { Router } from 'express';
import { authenticate, enforceRestaurantScope, auditLog, asyncHandler } from '@/middleware';
import { getEtimsStatus, processPendingSubmissions } from '@/services/etims.service';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

// GET /etims/status - submission counts + unsubmitted receipts
router.get('/status', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  res.json({ success: true, data: await getEtimsStatus(restaurantId) });
}));

// POST /etims/process - attempt PENDING/FAILED submissions (manual trigger)
router.post('/process', auditLog, asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const summary = await processPendingSubmissions(restaurantId);
  res.json({ success: true, data: summary });
}));

export default router;
