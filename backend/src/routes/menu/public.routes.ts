import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, AppError } from '@/utils';
import { generalLimiter, optionalAuth } from '@/middleware';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/utils/logger';

const router = Router();

router.use(generalLimiter);

// GET /:restaurantSlug - Full menu for customer
router.get(
  '/:restaurantSlug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { restaurantSlug } = req.params;

    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
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

    // Track QR scan if session header present
    const qrCodeId = req.headers['x-qr-code-id'] as string;
    if (qrCodeId) {
      try {
        const qrCode = await prisma.qrCode.findFirst({
          where: { id: qrCodeId, restaurantId: restaurant.id },
        });

        if (qrCode) {
          await prisma.qrCode.update({
            where: { id: qrCode.id },
            data: { scanCount: { increment: 1 } },
          });

          const sessionId = req.headers['x-session-id'] as string || uuidv4();

          await prisma.qrScan.create({
            data: {
              qrCodeId: qrCode.id,
              restaurantId: restaurant.id,
              scannedAt: new Date(),
              deviceType,
              browser,
              ipAddress: req.ip,
              sessionId,
              languageUsed: acceptLanguage.split(',')[0]?.trim() || null,
            },
          });

          // Update daily analytics
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          await prisma.analyticsDaily.upsert({
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
          });

          logger.debug('QR scan tracked', {
            qrCodeId: qrCode.id,
            restaurantId: restaurant.id,
            deviceType,
            browser,
          });
        }
      } catch (err) {
        logger.warn('Failed to track QR scan', { error: err, qrCodeId });
      }
    }

    const activeCategories = restaurant.menuCategories.filter(
      (c) => c.menuItems.length > 0
    );

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
      settings: restaurant.settings,
      openingHours: restaurant.openingHours,
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
    const { restaurantSlug, itemId } = req.params;

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
    const { restaurantSlug } = req.params;
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

export default router;
