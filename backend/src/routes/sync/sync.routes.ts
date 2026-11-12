import { Router } from 'express';
import { authenticate, enforceRestaurantScope, asyncHandler } from '@/middleware';
import { listChanges } from '@/services/sync.service';

const router = Router();

// GET /sync/changes?status=PENDING|APPLIED|all&take=50 - audit the offline-first
// sync/outbox log for this restaurant (device-originated transactions).
router.get('/changes',
  authenticate,
  enforceRestaurantScope,
  asyncHandler(async (req: any, res: any) => {
    const restaurantId = (req as any).restaurantId;
    const status = ['PENDING', 'APPLIED', 'all'].includes(String(req.query.status)) ? String(req.query.status) as any : 'all';
    const take = Math.min(Number(req.query.take) || 50, 200);
    const changes = await listChanges(restaurantId, status, take);
    res.json({ success: true, data: changes });
  })
);

export default router;
