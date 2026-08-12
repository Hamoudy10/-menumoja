import { Router } from 'express';
import { asyncHandler, AppError, generateSlug, hashPassword, generatePin } from '@/utils';
import { authenticate, enforceRestaurantScope, validate, auditLog } from '@/middleware';
import { updateRestaurantSchema, updateSettingsSchema, openingHoursSchema, createBranchSchema, createTableSchema, updateTableSchema, updateTableStatusSchema, updateTableSessionSchema, createZoneSchema, updateZoneSchema, createPromotionSchema, updatePromotionSchema, createStaffSchema, updateStaffSchema, uploadImageSchema } from '@/utils/validation';
import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { emitTableStatusChanged } from '@/hooks/socket';
import { invalidateMenuCache } from '@/utils/cache';

const router = Router();

router.use(authenticate);
router.use(enforceRestaurantScope);

// GET /me - Get authenticated owner's restaurant
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const userId = req.user!.userId;

    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId, ownerId: userId, isActive: true },
      include: {
        settings: true,
        openingHours: { orderBy: { dayOfWeek: 'asc' } },
        tables: { orderBy: { tableNumber: 'asc' } },
        _count: {
          select: {
            staff: true,
            menuCategories: true,
            menuItems: true,
            branches: true,
            qrCodes: true,
          },
        },
        plan: true,
      },
    });

    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    if (restaurant.isSuspended) {
      throw new AppError(403, 'RESTAURANT_SUSPENDED', 'Restaurant is suspended. Reason: ' + (restaurant.suspensionReason || 'N/A'), 'Mgahawa umesimamishwa. Sababu: ' + (restaurant.suspensionReason || 'Haijulikani'));
    }

    res.json({
      success: true,
      data: restaurant,
    });
  })
);

// PUT /me - Update restaurant profile
router.put(
  '/me',
  auditLog,
  validate(updateRestaurantSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const userId = req.user!.userId;
    const data = req.body;

    const existing = await prisma.restaurant.findFirst({
      where: { id: restaurantId, ownerId: userId },
    });
    if (!existing) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    if (data.name) {
      data.slug = await (async () => {
        let slug = generateSlug(data.name);
        let conflict = await prisma.restaurant.findFirst({
          where: { slug, id: { not: restaurantId } },
        });
        let counter = 1;
        while (conflict) {
          slug = `${generateSlug(data.name)}-${counter}`;
          conflict = await prisma.restaurant.findFirst({
            where: { slug, id: { not: restaurantId } },
          });
          counter++;
          if (counter > 1000) {
            throw new AppError(409, 'SLUG_GENERATION_FAILED', 'Could not generate a unique slug', 'Imeshindwa kutengeneza slug ya kipekee');
          }
        }
        return slug;
      })();
    }

    const { brandColor, fontStyle, gradientStart, gradientEnd, useGradient, headingFont, bodyFont, accentFont, cuisine, ownerName, location, ...restaurantData } = data;
    if (location) restaurantData.address = location;
    if (restaurantData.logoUrl === '') restaurantData.logoUrl = null;
    if (restaurantData.coverPhotoUrl === '') restaurantData.coverPhotoUrl = null;

    const oldSlug = existing.slug;
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: restaurantData,
    });

    if (restaurantData.slug && restaurantData.slug !== oldSlug) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'https://menumoja.app';
      const qrCodes = await prisma.qrCode.findMany({
        where: { restaurantId },
        select: { id: true, targetUrl: true },
      });
      await Promise.all(
        qrCodes.map((qr) =>
          prisma.qrCode.update({
            where: { id: qr.id },
            data: {
              targetUrl: qr.targetUrl.replace(
                `/menu/${oldSlug}`,
                `/menu/${restaurantData.slug}`
              ),
            },
          })
        )
      );
    }

    if (brandColor !== undefined || fontStyle !== undefined || gradientStart !== undefined || gradientEnd !== undefined || useGradient !== undefined || headingFont !== undefined || bodyFont !== undefined || accentFont !== undefined) {
      const settingsUpdate: any = {};
      if (brandColor !== undefined) settingsUpdate.primaryColor = brandColor;
      if (fontStyle !== undefined) settingsUpdate.fontFamily = fontStyle;
      if (gradientStart !== undefined) settingsUpdate.gradientStart = gradientStart;
      if (gradientEnd !== undefined) settingsUpdate.gradientEnd = gradientEnd;
      if (useGradient !== undefined) settingsUpdate.useGradient = useGradient;
      if (headingFont !== undefined) settingsUpdate.headingFont = headingFont;
      if (bodyFont !== undefined) settingsUpdate.bodyFont = bodyFont;
      if (accentFont !== undefined) settingsUpdate.accentFont = accentFont;
      await prisma.restaurantSettings.upsert({
        where: { restaurantId },
        create: { restaurantId, ...settingsUpdate },
        update: settingsUpdate,
      });
    }

    logger.info('Restaurant updated', { restaurantId, userId });

    res.json({
      success: true,
      data: restaurant,
    });
  })
);

// POST /me/upload-image - Upload restaurant logo / cover image
router.post(
  '/me/upload-image',
  auditLog,
  validate(uploadImageSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { dataUrl, folder } = req.body;

    const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) {
      throw new AppError(400, 'INVALID_IMAGE', 'Invalid image data — expected a base64 image', 'Data ya picha si sahihi');
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      throw new AppError(400, 'IMAGE_TOO_LARGE', 'Image too large (max 3MB)', 'Picha ni kubwa sana (upeo MB 3)');
    }

    try {
      const { uploadImage: cloudinaryUpload } = await import('@/integrations/cloudinary');
      const uploaded = await cloudinaryUpload(buffer, folder || `logos/${restaurantId}`);
      res.json({ success: true, data: { url: uploaded.url } });
    } catch (error) {
      logger.warn('Cloudinary upload failed, storing image as-is', { error, restaurantId });
      res.json({ success: true, data: { url: dataUrl } });
    }
  })
);

// PUT /me/settings - Update restaurant settings
router.put(
  '/me/settings',
  auditLog,
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const body = req.body;

    const MODEL_FIELDS = [
      'primaryColor', 'secondaryColor', 'fontFamily', 'gradientStart', 'gradientEnd',
      'useGradient', 'headingFont', 'bodyFont', 'accentFont', 'layoutStyle',
      'welcomeMessage', 'welcomeMessageSw', 'announcement', 'announcementActive',
      'languageEnglish', 'languageSwahili', 'languageArabic', 'showPrices',
      'allowOrdering', 'allowCashPayment', 'allowMpesaPayment', 'tipEnabled',
      'tipPercentages', 'serviceChargePercent', 'taxPercent',
      'mpesaShortcode', 'mpesaPasskey', 'mpesaBusinessName',
    ];

    const settingsData: any = {};
    for (const key of MODEL_FIELDS) {
      if (body[key] !== undefined) settingsData[key] = body[key];
    }

    const paymentSettings = body.paymentSettings;
    if (paymentSettings && typeof paymentSettings === 'object') {
      if (typeof paymentSettings.mpesaEnabled === 'boolean') settingsData.allowMpesaPayment = paymentSettings.mpesaEnabled;
      if (typeof paymentSettings.cashEnabled === 'boolean') settingsData.allowCashPayment = paymentSettings.cashEnabled;
      const shortcode = paymentSettings.mpesaShortcode || paymentSettings.tillNumber || paymentSettings.paybillNumber || '';
      if (shortcode) settingsData.mpesaShortcode = String(shortcode).trim();
      if (paymentSettings.mpesaPasskey) settingsData.mpesaPasskey = String(paymentSettings.mpesaPasskey).trim();
      if (paymentSettings.businessName) settingsData.mpesaBusinessName = String(paymentSettings.businessName).trim();
    }

    const settings = await prisma.restaurantSettings.upsert({
      where: { restaurantId },
      create: { restaurantId, ...settingsData },
      update: settingsData,
    });

    logger.info('Restaurant settings updated', { restaurantId });

    res.json({
      success: true,
      data: settings,
    });
  })
);

// GET /me/opening-hours - Get opening hours
router.get(
  '/me/opening-hours',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const hours = await prisma.openingHour.findMany({
      where: { restaurantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({
      success: true,
      data: hours,
    });
  })
);

// PUT /me/opening-hours - Bulk update opening hours
router.put(
  '/me/opening-hours',
  auditLog,
  validate(openingHoursSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const hours = req.body as Array<{ dayOfWeek: string; openTime: string; closeTime: string; isClosed?: boolean }>;

    if (!Array.isArray(hours) || hours.length === 0) {
      throw new AppError(400, 'INVALID_HOURS', 'Opening hours data is required', 'Data ya saa za kufungua inahitajika');
    }

    const validDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    for (const h of hours) {
      if (!validDays.includes(h.dayOfWeek)) {
        throw new AppError(400, 'INVALID_DAY', `Invalid day: ${h.dayOfWeek}`, `Siku batili: ${h.dayOfWeek}`);
      }
    }

    await prisma.$transaction(
      hours.map((h) =>
        prisma.openingHour.upsert({
          where: {
            restaurantId_dayOfWeek: {
              restaurantId,
              dayOfWeek: h.dayOfWeek as any,
            },
          },
          create: {
            restaurantId,
            dayOfWeek: h.dayOfWeek as any,
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed ?? false,
          },
          update: {
            openTime: h.openTime,
            closeTime: h.closeTime,
            isClosed: h.isClosed ?? false,
          },
        })
      )
    );

    const updated = await prisma.openingHour.findMany({
      where: { restaurantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

// POST /me/branches - Add branch
router.post(
  '/me/branches',
  auditLog,
  validate(createBranchSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const branch = await prisma.restaurantBranch.create({
      data: { restaurantId, ...req.body },
    });

    logger.info('Branch created', { restaurantId, branchId: branch.id });

    res.status(201).json({
      success: true,
      data: branch,
    });
  })
);

// GET /me/branches - List all branches
router.get(
  '/me/branches',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const branches = await prisma.restaurantBranch.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: branches,
    });
  })
);

// GET /me/tables - List restaurant tables
router.get(
  '/me/tables',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
      include: {
        zone: { select: { id: true, name: true, color: true, positionX: true, positionY: true, width: true, height: true } },
        sessions: { where: { endedAt: null }, orderBy: { startedAt: 'desc' }, take: 1 },
        qrCode: { select: { id: true, label: true, qrImageUrl: true, scanCount: true } },
        _count: { select: { orders: true } },
      },
    });

    res.json({
      success: true,
      data: tables,
    });
  })
);

// POST /me/tables - Create table
router.post(
  '/me/tables',
  auditLog,
  validate(createTableSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { tableNumber, label, capacity, shape, positionX, positionY, width, height, rotation, zoneId } = req.body;

    const existing = await prisma.restaurantTable.findUnique({
      where: { restaurantId_tableNumber: { restaurantId, tableNumber } },
    });
    if (existing) {
      throw new AppError(409, 'TABLE_EXISTS', `Table ${tableNumber} already exists`, `Meza namba ${tableNumber} tayari ipo`);
    }

    if (zoneId) {
      const zone = await prisma.tableZone.findFirst({ where: { id: zoneId, restaurantId } });
      if (!zone) {
        throw new AppError(400, 'ZONE_NOT_FOUND', 'Zone not found', 'Eneo halikupatikana');
      }
    }

    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId,
        tableNumber,
        label: label || `Table ${tableNumber}`,
        capacity: capacity || 4,
        shape: shape || 'ROUND',
        positionX: positionX ?? 0,
        positionY: positionY ?? 0,
        width: width ?? 2,
        height: height ?? 2,
        rotation: rotation ?? 0,
        zoneId: zoneId || null,
      },
    });

    res.status(201).json({
      success: true,
      data: table,
    });
  })
);

// PUT /me/tables/:tableId - Update table
router.put(
  '/me/tables/:tableId',
  auditLog,
  validate(updateTableSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const tableId = String(req.params.tableId);
    const data = req.body;

    const table = await prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found', 'Meza haikupatikana');
    }

    if (data.version !== undefined && table.version !== data.version) {
      throw new AppError(409, 'TABLE_CONFLICT', 'Table was modified by another device. Refresh and try again.', 'Meza imebadilishwa na kifaa kingine. Onyesha upya na ujaribu tena.');
    }

    if (data.tableNumber && data.tableNumber !== table.tableNumber) {
      const conflict = await prisma.restaurantTable.findUnique({
        where: { restaurantId_tableNumber: { restaurantId, tableNumber: data.tableNumber } },
      });
      if (conflict) {
        throw new AppError(409, 'TABLE_EXISTS', `Table ${data.tableNumber} already exists`, `Meza namba ${data.tableNumber} tayari ipo`);
      }
    }

    if (data.zoneId) {
      const zone = await prisma.tableZone.findFirst({ where: { id: data.zoneId, restaurantId } });
      if (!zone) {
        throw new AppError(400, 'ZONE_NOT_FOUND', 'Zone not found', 'Eneo halikupatikana');
      }
    }

    const { version, ...tableData } = data;

    const updated = await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { ...tableData, version: { increment: 1 } },
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

// DELETE /me/tables/:tableId - Delete table
router.delete(
  '/me/tables/:tableId',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const tableId = String(req.params.tableId);

    const table = await prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      include: {
        _count: {
          select: {
            orders: {
              where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] } },
            },
          },
        },
      },
    });

    if (!table) {
      throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found', 'Meza haikupatikana');
    }

    if (table._count.orders > 0) {
      throw new AppError(409, 'TABLE_HAS_ACTIVE_ORDERS', 'Cannot delete table with active orders. Clear all orders first.', 'Haiwezi kufuta meza yenye maagizo hai. Futa maagizo yote kwanza.');
    }

    await prisma.restaurantTable.delete({ where: { id: tableId } });

    logger.info('Table deleted', { restaurantId, tableId });

    res.json({
      success: true,
      data: { message: 'Table deleted successfully', messageSwahili: 'Meza imefutwa kwa mafanikio' },
    });
  })
);

// PUT /me/tables/:tableId/status - Manually set table status (waiter/floor actions)
router.put(
  '/me/tables/:tableId/status',
  auditLog,
  validate(updateTableStatusSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const tableId = String(req.params.tableId);
    const { status, version } = req.body;

    const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId } });
    if (!table) {
      throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found', 'Meza haikupatikana');
    }

    if (version !== undefined && table.version !== version) {
      throw new AppError(409, 'TABLE_CONFLICT', 'Table was modified by another device. Refresh and try again.', 'Meza imebadilishwa na kifaa kingine. Onyesha upya na ujaribu tena.');
    }

    const updated = await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status, version: { increment: 1 } },
    });

    if (status === 'FREE') {
      await prisma.tableSession.updateMany({
        where: { tableId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }

    try {
      emitTableStatusChanged(restaurantId, String(tableId), status);
    } catch (socketError) {
      logger.error('Failed to emit table status change', { error: socketError, tableId });
    }

    res.json({ success: true, data: updated });
  })
);

// PUT /me/tables/:tableId/session - Start or end a table seating session
router.put(
  '/me/tables/:tableId/session',
  auditLog,
  validate(updateTableSessionSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const tableId = String(req.params.tableId);
    const { action, guestCount, version } = req.body;

    const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId } });
    if (!table) {
      throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found', 'Meza haikupatikana');
    }

    if (version !== undefined && table.version !== version) {
      throw new AppError(409, 'TABLE_CONFLICT', 'Table was modified by another device. Refresh and try again.', 'Meza imebadilishwa na kifaa kingine. Onyesha upya na ujaribu tena.');
    }

    let session;
    if (action === 'START') {
      const active = await prisma.tableSession.findFirst({ where: { tableId, endedAt: null } });
      if (active) {
        session = await prisma.tableSession.update({
          where: { id: active.id },
          data: { guestCount: guestCount ?? active.guestCount },
        });
      } else {
        session = await prisma.tableSession.create({
          data: { restaurantId, tableId, guestCount: guestCount ?? null },
        });
      }
      const updated = await prisma.restaurantTable.update({
        where: { id: tableId },
        data: { status: table.status === 'FREE' ? 'OCCUPIED' : table.status, version: { increment: 1 } },
      });
      if (updated.status !== table.status) {
        try {
          emitTableStatusChanged(restaurantId, String(tableId), updated.status);
        } catch (socketError) {
          logger.error('Failed to emit table status change', { error: socketError, tableId });
        }
      }
      res.json({ success: true, data: { session, table: updated } });
      return;
    }

    session = await prisma.tableSession.updateMany({
      where: { tableId, endedAt: null },
      data: { endedAt: new Date() },
    });

    res.json({ success: true, data: { closed: session.count } });
  })
);

// GET /me/zones - List floor plan zones
router.get(
  '/me/zones',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const zones = await prisma.tableZone.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { tables: true } } },
    });

    res.json({ success: true, data: zones });
  })
);

// POST /me/zones - Create zone
router.post(
  '/me/zones',
  auditLog,
  validate(createZoneSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { name, color, positionX, positionY, width, height } = req.body;

    const zone = await prisma.tableZone.create({
      data: {
        restaurantId,
        name,
        color: color || '#E2E8F0',
        positionX: positionX ?? 0,
        positionY: positionY ?? 0,
        width: width ?? 12,
        height: height ?? 8,
      },
    });

    res.status(201).json({ success: true, data: zone });
  })
);

// PUT /me/zones/:zoneId - Update zone
router.put(
  '/me/zones/:zoneId',
  auditLog,
  validate(updateZoneSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const zoneId = String(req.params.zoneId);

    const zone = await prisma.tableZone.findFirst({ where: { id: zoneId, restaurantId } });
    if (!zone) {
      throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found', 'Eneo halikupatikana');
    }

    const updated = await prisma.tableZone.update({
      where: { id: zoneId },
      data: req.body,
    });

    res.json({ success: true, data: updated });
  })
);

// DELETE /me/zones/:zoneId - Delete zone (tables keep their area label)
router.delete(
  '/me/zones/:zoneId',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const zoneId = String(req.params.zoneId);

    const zone = await prisma.tableZone.findFirst({ where: { id: zoneId, restaurantId } });
    if (!zone) {
      throw new AppError(404, 'ZONE_NOT_FOUND', 'Zone not found', 'Eneo halikupatikana');
    }

    await prisma.$transaction([
      prisma.restaurantTable.updateMany({
        where: { zoneId },
        data: { zoneId: null },
      }),
      prisma.tableZone.delete({ where: { id: zoneId } }),
    ]);

    res.json({ success: true, data: { message: 'Zone deleted successfully', messageSwahili: 'Eneo limefutwa kwa mafanikio' } });
  })
);

// ── Promotions (Specials / Offers / Events / Giveaways) ──

// GET /me/promotions - List promotions
router.get(
  '/me/promotions',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const promotions = await prisma.promotion.findMany({
      where: { restaurantId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        menuItem: { select: { id: true, name: true, price: true, photoUrl: true } },
      },
    });

    res.json({
      success: true,
      data: promotions.map((p) => ({
        ...p,
        specialPrice: p.specialPrice ? Number(p.specialPrice) : null,
        menuItem: p.menuItem ? { ...p.menuItem, price: Number(p.menuItem.price) } : null,
      })),
    });
  })
);

// POST /me/promotions - Create promotion
router.post(
  '/me/promotions',
  auditLog,
  validate(createPromotionSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { type, title, description, descriptionSw, menuItemId, specialPrice, imageUrl, startsAt, endsAt, isActive } = req.body;

    if (menuItemId) {
      const item = await prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId } });
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
      }
    }

    const promotion = await prisma.promotion.create({
      data: {
        restaurantId,
        type,
        title,
        description: description || null,
        descriptionSw: descriptionSw || null,
        menuItemId: menuItemId || null,
        specialPrice: specialPrice ?? null,
        imageUrl: imageUrl || null,
        startsAt: startsAt ?? null,
        endsAt: endsAt ?? null,
        isActive: isActive ?? true,
      },
      include: {
        menuItem: { select: { id: true, name: true, price: true, photoUrl: true } },
      },
    });

    await invalidateMenuCache(restaurantId);

    res.status(201).json({
      success: true,
      data: { ...promotion, specialPrice: promotion.specialPrice ? Number(promotion.specialPrice) : null },
    });
  })
);

// PUT /me/promotions/:promotionId - Update promotion
router.put(
  '/me/promotions/:promotionId',
  auditLog,
  validate(updatePromotionSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const promotionId = String(req.params.promotionId);
    const data = req.body;

    const promotion = await prisma.promotion.findFirst({ where: { id: promotionId, restaurantId } });
    if (!promotion) {
      throw new AppError(404, 'PROMOTION_NOT_FOUND', 'Promotion not found', 'Ukuzaji haukupatikana');
    }

    if (data.menuItemId) {
      const item = await prisma.menuItem.findFirst({ where: { id: data.menuItemId, restaurantId } });
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
      }
    }

    const updateData: any = { ...data };
    if (updateData.description === '') updateData.description = null;
    if (updateData.descriptionSw === '') updateData.descriptionSw = null;
    if (updateData.imageUrl === '') updateData.imageUrl = null;

    const updated = await prisma.promotion.update({
      where: { id: promotionId },
      data: updateData,
      include: {
        menuItem: { select: { id: true, name: true, price: true, photoUrl: true } },
      },
    });

    await invalidateMenuCache(restaurantId);

    res.json({
      success: true,
      data: { ...updated, specialPrice: updated.specialPrice ? Number(updated.specialPrice) : null },
    });
  })
);

// DELETE /me/promotions/:promotionId - Delete promotion
router.delete(
  '/me/promotions/:promotionId',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const promotionId = String(req.params.promotionId);

    const promotion = await prisma.promotion.findFirst({ where: { id: promotionId, restaurantId } });
    if (!promotion) {
      throw new AppError(404, 'PROMOTION_NOT_FOUND', 'Promotion not found', 'Ukuzaji haukupatikana');
    }

    await prisma.promotion.delete({ where: { id: promotionId } });
    await invalidateMenuCache(restaurantId);

    res.json({ success: true, data: { message: 'Promotion deleted successfully', messageSwahili: 'Ukuzaji umefutwa kwa mafanikio' } });
  })
);

// GET /me/staff - List staff members
router.get(
  '/me/staff',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const staff = await prisma.staff.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = staff.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      phone: s.phone,
      email: s.email,
      role: typeof s.role === 'string' ? s.role.toLowerCase() : 'waiter',
      isActive: s.isActive,
      lastLogin: s.lastLogin,
      createdAt: s.createdAt,
      employeeNumber: s.employeeNumber,
      nationalId: s.nationalId,
      kraPin: s.kraPin,
      nhifNumber: s.nhifNumber,
      nssfNumber: s.nssfNumber,
      emergencyName: s.emergencyName,
      emergencyPhone: s.emergencyPhone,
      bankName: s.bankName,
      bankAccount: s.bankAccount,
      monthlySalary: s.monthlySalary ? Number(s.monthlySalary) : undefined,
      leaveDays: s.leaveDays,
    }));

    res.json({
      success: true,
      data: mapped,
    });
  })
);

// POST /me/staff - Create staff member
router.post(
  '/me/staff',
  auditLog,
  validate(createStaffSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { name, email, phone, role, pin, active, isActive, employeeNumber, nationalId, kraPin, nhifNumber, nssfNumber, dateOfBirth, address, emergencyName, emergencyPhone, emergencyRelation, nextOfKin, nextOfKinPhone, nextOfKinRelation, bankName, bankBranch, bankAccount, monthlySalary, hourlyRate, leaveDays, startDate, notes } = req.body;

    const existing = await prisma.staff.findFirst({
      where: { restaurantId, OR: [{ phone }, { fullName: name }] },
    });
    if (existing) {
      throw new AppError(409, 'STAFF_EXISTS', 'A staff member with this name or phone already exists', 'Mfanyakazi mwenye jina au nambari hii ya simu tayari yupo');
    }

    const staffPin = pin || generatePin();
    const pinHash = await hashPassword(staffPin);

    const roleMap: Record<string, string> = {
      manager: 'MANAGER', cashier: 'CASHIER', waiter: 'WAITER', kitchen: 'KITCHEN',
    };

    const staff = await prisma.staff.create({
      data: {
        restaurantId,
        fullName: name,
        phone: phone || '',
        email,
        pinHash,
        role: (roleMap[role] || 'WAITER') as any,
        isActive: isActive ?? active ?? true,
        employeeNumber,
        nationalId,
        kraPin,
        nhifNumber,
        nssfNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address,
        emergencyName,
        emergencyPhone,
        emergencyRelation,
        nextOfKin,
        nextOfKinPhone,
        nextOfKinRelation,
        bankName,
        bankBranch,
        bankAccount,
        monthlySalary: monthlySalary !== undefined ? monthlySalary : undefined,
        hourlyRate: hourlyRate !== undefined ? hourlyRate : undefined,
        leaveDays: leaveDays !== undefined ? leaveDays : 21,
        startDate: startDate ? new Date(startDate) : undefined,
        notes,
      },
    });

    logger.info('Staff created', { restaurantId, staffId: staff.id });

    res.status(201).json({
      success: true,
      data: { ...staff, role: role, pin: staffPin },
    });
  })
);

// PUT /me/staff/:staffId - Update staff
router.put(
  '/me/staff/:staffId',
  auditLog,
  validate(updateStaffSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const staffId = String(req.params.staffId);
    const data = req.body;

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, restaurantId },
    });
    if (!staff) {
      throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found', 'Mfanyakazi hajapatikana');
    }

    const roleMap: Record<string, string> = {
      manager: 'MANAGER', cashier: 'CASHIER', waiter: 'WAITER', kitchen: 'KITCHEN',
    };
    const updateData: any = {};
    if (data.name !== undefined) updateData.fullName = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = roleMap[data.role] || staff.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.pin !== undefined) updateData.pinHash = await hashPassword(data.pin);
    if (data.employeeNumber !== undefined) updateData.employeeNumber = data.employeeNumber;
    if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;
    if (data.kraPin !== undefined) updateData.kraPin = data.kraPin;
    if (data.nhifNumber !== undefined) updateData.nhifNumber = data.nhifNumber;
    if (data.nssfNumber !== undefined) updateData.nssfNumber = data.nssfNumber;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.address !== undefined) updateData.address = data.address;
    if (data.emergencyName !== undefined) updateData.emergencyName = data.emergencyName;
    if (data.emergencyPhone !== undefined) updateData.emergencyPhone = data.emergencyPhone;
    if (data.emergencyRelation !== undefined) updateData.emergencyRelation = data.emergencyRelation;
    if (data.nextOfKin !== undefined) updateData.nextOfKin = data.nextOfKin;
    if (data.nextOfKinPhone !== undefined) updateData.nextOfKinPhone = data.nextOfKinPhone;
    if (data.nextOfKinRelation !== undefined) updateData.nextOfKinRelation = data.nextOfKinRelation;
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
    if (data.bankBranch !== undefined) updateData.bankBranch = data.bankBranch;
    if (data.bankAccount !== undefined) updateData.bankAccount = data.bankAccount;
    if (data.monthlySalary !== undefined) updateData.monthlySalary = data.monthlySalary;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
    if (data.leaveDays !== undefined) updateData.leaveDays = data.leaveDays;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.staff.update({
      where: { id: staffId },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        fullName: updated.fullName,
        phone: updated.phone,
        role: updated.role.toLowerCase(),
        isActive: updated.isActive,
        lastLogin: updated.lastLogin,
      },
    });
  })
);

// DELETE /me/staff/:staffId - Remove staff
router.delete(
  '/me/staff/:staffId',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const staffId = String(req.params.staffId);

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, restaurantId },
      include: {
        _count: {
          select: {
            assignedOrders: { where: { status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } } },
          },
        },
      },
    });

    if (!staff) {
      throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found', 'Mfanyakazi hajapatikana');
    }

    if (staff._count.assignedOrders > 0) {
      throw new AppError(409, 'STAFF_HAS_ACTIVE_ORDERS', 'Cannot delete staff with active orders. Reassign orders first.', 'Haiwezi kufuta mfanyakazi mwenye maagizo hai. Gawanya maagizo kwanza.');
    }

    await prisma.staff.delete({ where: { id: staffId } });

    logger.info('Staff deleted', { restaurantId, staffId });

    res.json({
      success: true,
      data: { message: 'Staff member removed successfully', messageSwahili: 'Mfanyakazi ameondolewa kwa mafanikio' },
    });
  })
);

// POST /me/staff/:staffId/reset-pin - Generate new PIN
router.post(
  '/me/staff/:staffId/reset-pin',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const staffId = String(req.params.staffId);

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, restaurantId },
    });
    if (!staff) {
      throw new AppError(404, 'STAFF_NOT_FOUND', 'Staff member not found', 'Mfanyakazi hajapatikana');
    }

    const newPin = generatePin();
    const pinHash = await hashPassword(newPin);

    await prisma.staff.update({
      where: { id: staffId },
      data: { pinHash },
    });

    logger.info('Staff PIN reset', { restaurantId, staffId });

    res.json({
      success: true,
      data: {
        id: staff.id,
        fullName: staff.fullName,
        pin: newPin,
        message: 'New PIN generated successfully',
        messageSwahili: 'PIN mpya imetolewa kwa mafanikio',
      },
    });
  })
);

export default router;
