import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/utils/logger';

export async function invalidateMenuCache(restaurantId: string): Promise<void> {
  try {
    await redis.del(`menu:${restaurantId}`);
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true },
    });
    if (restaurant) {
      await redis.del(`menu:public:${restaurant.slug}`);
    }
  } catch (error) {
    logger.error('Failed to invalidate menu cache', { error, restaurantId });
  }
}
