import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, AppError } from '@/utils';
import { generalLimiter, optionalAuth } from '@/middleware';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/utils/logger';
import { getUpsellSuggestions } from '@/services/upsell.service';
import { getPersonalizedMenu } from '@/services/menu-personalization.service';
import { listPlans } from '@/services/subscription.service';
import { toPublicSettings } from '@/utils/settings';

const router = Router();

router.use(generalLimiter);

// GET /plans - public pricing (frontend never hard-codes prices)
router.get('/plans', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await listPlans() });
}));

/**
 * Record a QR scan without blocking the menu response.
 *
 * Runs *before* the public-menu cache lookup so cached responses still count
 * scans (previously only the first request per cache window was recorded).
 * Reloads from the same browser session within 30 minutes are not double
 * counted, which keeps the scans metric close to real customer arrivals.
 */
async function trackQrScan(
  req: any,
  restaurantSlug: string,
  device: { deviceType: string; browser: string }
): Promise<void> {
  const qrCodeId = req.headers['x-qr-code-id'] as string | undefined;
  // Legacy QR codes printed without `?qr=` can still be attributed by table.
  const tableNumber = Number(req.query?.table);
  if (!qrCodeId && !(Number.isInteger(tableNumber) && tableNumber > 0)) return;

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
      select: { id: true },
    });
    if (!restaurant) return;

    const qrCode = qrCodeId
      ? await prisma.qrCode.findFirst({
          where: { id: qrCodeId, restaurantId: restaurant.id, isActive: true },
          select: { id: true },
        })
      : await prisma.qrCode.findFirst({
          where: { restaurantId: restaurant.id, tableNumber, isActive: true },
          select: { id: true },
        });
    if (!qrCode) return;

    const sessionId = (req.headers['x-session-id'] as string) || uuidv4();
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const recent = await prisma.qrScan.findFirst({
      where: { qrCodeId: qrCode.id, sessionId, scannedAt: { gte: since } },
      select: { id: true },
    });
    if (recent) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.$transaction([
      prisma.qrCode.update({
        where: { id: qrCode.id },
        data: { scanCount: { increment: 1 } },
      }),
      prisma.qrScan.create({
        data: {
          qrCodeId: qrCode.id,
          restaurantId: restaurant.id,
          scannedAt: new Date(),
          deviceType: device.deviceType,
          browser: device.browser,
          ipAddress: req.ip,
          sessionId,
          languageUsed: String(req.headers['accept-language'] || '').split(',')[0]?.trim() || null,
        },
      }),
      prisma.analyticsDaily.upsert({
        where: {
          restaurantId_date: { restaurantId: restaurant.id, date: today },
        },
        create: {
          restaurantId: restaurant.id,
          date: today,
          totalScans: 1,
        },
        update: {
          totalScans: { increment: 1 },
        },
      }),
    ]);

    logger.debug('QR scan tracked', {
      qrCodeId: qrCode.id,
      restaurantId: restaurant.id,
      deviceType: device.deviceType,
      browser: device.browser,
    });
  } catch (err) {
    logger.warn('Failed to track QR scan', { error: err, qrCodeId });
  }
}

// GET /:restaurantSlug - Full menu for customer
router.get(
  '/:restaurantSlug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const restaurantSlug = String(req.params.restaurantSlug);

    const userAgent = req.headers['user-agent'] || '';
    let deviceType = 'desktop';
    let browser = 'unknown';

    if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    if (/chrome/i.test(userAgent) && !/edge|opr/i.test(userAgent)) browser = 'chrome';
    else if (/firefox/i.test(userAgent)) browser = 'firefox';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'safari';
    else if (/edge/i.test(userAgent)) browser = 'edge';

    // Track the scan before the cache lookup so cached menus still count.
    await trackQrScan(req, restaurantSlug, { deviceType, browser });

    const cached = await redis.get(`menu:public:${restaurantSlug}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      res.json({ success: true, data: parsed });
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
      include: {
        settings: true,
        openingHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        menuCategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found. Please check the link and try again.', 'Mgahawa haukupatikana. Tafadhali angalia kiungo na ujaribu tena.');
    }

    if (restaurant.isSuspended) {
      throw new AppError(403, 'RESTAURANT_SUSPENDED', 'This restaurant is currently unavailable', 'Mgahawa huu haupatikani kwa sasa');
    }

    const activeCategories = restaurant.menuCategories.filter(
      (c) => c.menuItems.length > 0
    );

    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        restaurantId: restaurant.id,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        menuItem: { select: { id: true, name: true, price: true, photoUrl: true } },
      },
    });

    const responseData = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        description: restaurant.description,
        descriptionSw: restaurant.descriptionSw,
        logoUrl: restaurant.logoUrl,
        coverPhotoUrl: restaurant.coverPhotoUrl,
        phone: restaurant.phone,
        address: restaurant.address,
        city: restaurant.city,
        currency: restaurant.currency,
        isHalalCertified: restaurant.isHalalCertified,
        dietaryOptions: restaurant.dietaryOptions,
      },
      // Whitelisted: never expose payment credentials on a public endpoint.
      settings: toPublicSettings(restaurant.settings as Record<string, unknown> | null),
      openingHours: restaurant.openingHours,
      promotions: promotions.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        description: p.description,
        descriptionSw: p.descriptionSw,
        imageUrl: p.imageUrl,
        specialPrice: p.specialPrice ? Number(p.specialPrice) : null,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        menuItem: p.menuItem
          ? {
              id: p.menuItem.id,
              name: p.menuItem.name,
              price: Number(p.menuItem.price),
              photoUrl: p.menuItem.photoUrl,
            }
          : null,
      })),
      categories: activeCategories.map((c) => ({
        id: c.id,
        name: c.name,
        nameSw: c.nameSw,
        description: c.description,
        sortOrder: c.sortOrder,
        items: c.menuItems.map((item) => ({
          id: item.id,
          name: item.name,
          nameSw: item.nameSw,
          description: item.description,
          descriptionSw: item.descriptionSw,
          price: Number(item.price),
          currency: item.currency,
          photoUrl: item.photoUrl,
          isAvailable: item.isAvailable,
          isTodaysSpecial: item.isTodaysSpecial,
          isFeatured: item.isFeatured,
          isNew: item.isNew,
          preparationTimeMinutes: item.preparationTimeMinutes,
          calories: item.calories,
          spiceLevel: item.spiceLevel,
          dietary: {
            isHalal: item.isHalal,
            isVegetarian: item.isVegetarian,
            isVegan: item.isVegan,
            isGlutenFree: item.isGlutenFree,
          },
          allergens: item.allergenNotes,
          ingredients: item.ingredients,
          sortOrder: item.sortOrder,
        })),
      })),
    };

    await redis.setex(`menu:public:${restaurantSlug}`, 60, JSON.stringify(responseData));

    res.json({
      success: true,
      data: responseData,
    });
  })
);

// GET /:restaurantSlug/item/:itemId - Single item detail
router.get(
  '/:restaurantSlug/item/:itemId',
  asyncHandler(async (req, res) => {
    const restaurantSlug = String(req.params.restaurantSlug);
    const itemId = String(req.params.itemId);

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
      select: { id: true, name: true },
    });

    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId: restaurant.id, isAvailable: true },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found or not available', 'Kipengee cha menyu hakikupatikana au hakipatikani');
    }

    res.json({
      success: true,
      data: {
        ...item,
        price: Number(item.price),
      },
    });
  })
);

// GET /:restaurantSlug/search - Search items
router.get(
  '/:restaurantSlug/search',
  asyncHandler(async (req, res) => {
    const restaurantSlug = String(req.params.restaurantSlug);
    const q = (req.query.q as string) || '';

    if (!q.trim()) {
      throw new AppError(400, 'SEARCH_TERM_REQUIRED', 'Search term is required', 'Neno la utafutaji linahitajika');
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
      select: { id: true, name: true },
    });

    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId: restaurant.id,
        isAvailable: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameSw: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { descriptionSw: { contains: q, mode: 'insensitive' } },
          { ingredients: { has: q } },
        ],
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: 'asc' },
      take: 50,
    });

    await prisma.searchAnalytics.create({
      data: {
        restaurantId: restaurant.id,
        searchTerm: q,
        resultsFound: items.length > 0,
      },
    });

    res.json({
      success: true,
      data: items.map((item) => ({ ...item, price: Number(item.price) })),
      meta: { total: items.length, searchTerm: q },
    });
  })
);

// GET /:restaurantSlug/upsells?itemIds=a,b,c - basket-analysis suggestions
router.get(
  '/:restaurantSlug/upsells',
  asyncHandler(async (req, res) => {
    const restaurantSlug = String(req.params.restaurantSlug);
    const cartItemIds = String(req.query.itemIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
      select: { id: true },
    });
    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    const suggestions = cartItemIds.length > 0
      ? await getUpsellSuggestions(restaurant.id, cartItemIds, 3)
      : [];

    const items = suggestions.length > 0
      ? await prisma.menuItem.findMany({
          where: { restaurantId: restaurant.id, id: { in: suggestions.map((s) => s.itemId) } },
          select: {
            id: true, name: true, price: true, photoUrl: true, description: true,
            isAvailable: true, isTodaysSpecial: true, isFeatured: true, isNew: true,
            category: { select: { name: true } },
          },
        })
      : [];

    res.json({
      success: true,
      data: items.map((item) => {
        const stat = suggestions.find((s) => s.itemId === item.id);
        return { ...item, price: Number(item.price), upsellPercentage: stat?.percentage || 0 };
      }),
    });
  })
);

// GET /:restaurantSlug/personalized?sessionId=&cartItemIds= - storefront sections
router.get(
  '/:restaurantSlug/personalized',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const restaurantSlug = String(req.params.restaurantSlug);
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : undefined;
    const cartItemIds = String(req.query.cartItemIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
      select: { id: true },
    });
    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    const sections = await getPersonalizedMenu(restaurant.id, { sessionId, cartItemIds });

    const serialize = (items: any[]) => items.map((i) => ({ ...i, price: Number(i.price) }));

    res.json({
      success: true,
      data: {
        mostPopular: serialize(sections.mostPopular),
        bestValue: serialize(sections.bestValue),
        newItems: serialize(sections.newItems),
        promotions: sections.promotions.map((p) => ({
          ...p,
          specialPrice: p.specialPrice ? Number(p.specialPrice) : null,
          menuItem: p.menuItem ? { ...p.menuItem, price: Number(p.menuItem.price) } : null,
        })),
        recommendedForYou: sections.recommendedForYou ? serialize(sections.recommendedForYou) : null,
        completeYourMeal: sections.completeYourMeal ? serialize(sections.completeYourMeal) : null,
      },
    });
  })
);

export default router;
