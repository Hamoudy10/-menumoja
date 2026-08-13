import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { asyncHandler, AppError } from '@/utils';
import { authenticate, enforceRestaurantScope, auditLog } from '@/middleware';
import { prisma } from '@/config/database';
import { uploadImage } from '@/integrations/cloudinary';
import logger from '@/utils/logger';

const router = Router();

export const publicQrRoutes = Router();

// POST /scan/:qrCodeId - Record a scan (public, no auth)
publicQrRoutes.post(
  '/scan/:qrCodeId',
  asyncHandler(async (req, res) => {
    const qrCodeId = String(req.params.qrCodeId);
    const { deviceType, browser, sessionId, language } = req.body;

    const qrCode = await prisma.qrCode.findUnique({
      where: { id: qrCodeId },
    });

    if (!qrCode || !qrCode.isActive) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found or inactive', 'Msimbo wa QR haukupatikana au haufanyi kazi');
    }

    const scanSessionId = sessionId || uuidv4();
    const userAgent = req.headers['user-agent'] || '';
    let detectedDevice = deviceType || 'desktop';
    let detectedBrowser = browser || 'unknown';

    if (!deviceType) {
      if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
        detectedDevice = 'mobile';
      } else if (/tablet|ipad/i.test(userAgent)) {
        detectedDevice = 'tablet';
      }
    }

    if (!browser) {
      if (/chrome/i.test(userAgent) && !/edge|opr/i.test(userAgent)) detectedBrowser = 'chrome';
      else if (/firefox/i.test(userAgent)) detectedBrowser = 'firefox';
      else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) detectedBrowser = 'safari';
      else if (/edge/i.test(userAgent)) detectedBrowser = 'edge';
    }

    const scan = await prisma.qrScan.create({
      data: {
        qrCodeId,
        restaurantId: qrCode.restaurantId,
        deviceType: detectedDevice,
        browser: detectedBrowser,
        ipAddress: req.ip,
        sessionId: scanSessionId,
        languageUsed: language || null,
      },
    });

    await prisma.qrCode.update({
      where: { id: qrCodeId },
      data: { scanCount: { increment: 1 } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.analyticsDaily.upsert({
      where: {
        restaurantId_date: { restaurantId: qrCode.restaurantId, date: today },
      },
      create: {
        restaurantId: qrCode.restaurantId,
        date: today,
        totalScans: 1,
      },
      update: {
        totalScans: { increment: 1 },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        scanId: scan.id,
        scannedAt: scan.scannedAt,
        restaurantId: qrCode.restaurantId,
        targetUrl: qrCode.targetUrl,
      },
    });
  })
);

router.use((req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

router.use(authenticate);
router.use(enforceRestaurantScope);

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://menumoja.app';

// GET / - List all QR codes for restaurant
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const qrCodes = await prisma.qrCode.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { scans: true } },
        tables: {
          select: { id: true, tableNumber: true, label: true, status: true },
        },
      },
    });

    const enriched = qrCodes.map((qr) => ({
      ...qr,
      totalScans: qr._count.scans,
      tableInfo: qr.tables[0] || null,
      _count: undefined,
    }));

    res.json({
      success: true,
      data: enriched,
    });
  })
);

// POST /generate - Generate single QR code
router.post(
  '/generate',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { label, tableNumber, type, template } = req.body;

    if (!label) {
      throw new AppError(400, 'LABEL_REQUIRED', 'Label is required', 'Lebo inahitajika');
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true, name: true, settings: true },
    });
    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    const targetUrl = `${FRONTEND_URL}/menu/${restaurant.slug}?table=${tableNumber || 'general'}&source=${type || 'general'}`;

    const qrBuffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      width: 600,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    let qrImageUrl: string | null = null;
    try {
      const uploaded = await uploadImage(qrBuffer, `qr-codes/${restaurantId}`);
      qrImageUrl = uploaded.url;
    } catch (err) {
      logger.warn('Cloudinary upload failed for QR, using local reference', { error: err });
    }

    const qrCode = await prisma.qrCode.create({
      data: {
        restaurantId,
        label,
        tableNumber: tableNumber || null,
        qrType: (type || 'GENERAL').toUpperCase() as any,
        qrImageUrl,
        targetUrl,
        isActive: true,
      },
    });

    // Link or create table if tableNumber provided
    if (tableNumber) {
      let table = await prisma.restaurantTable.findUnique({
        where: { restaurantId_tableNumber: { restaurantId, tableNumber } },
      });

      if (!table) {
        table = await prisma.restaurantTable.create({
          data: {
            restaurantId,
            tableNumber,
            label: label || `Table ${tableNumber}`,
            capacity: 4,
            qrCodeId: qrCode.id,
          },
        });
      } else {
        await prisma.restaurantTable.update({
          where: { id: table.id },
          data: { qrCodeId: qrCode.id },
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ...qrCode,
        template: template || 'standard',
      },
    });
  })
);

// POST /generate-batch - Generate QR codes for multiple tables
router.post(
  '/generate-batch',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { numberOfTables, template } = req.body;

    if (!numberOfTables || numberOfTables < 1 || numberOfTables > 100) {
      throw new AppError(400, 'INVALID_NUMBER', 'Number of tables must be between 1 and 100', 'Idadi ya meza lazima iwe kati ya 1 na 100');
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { slug: true, name: true },
    });
    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    const existingTables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
      select: { tableNumber: true },
    });
    const existingNumbers = new Set(existingTables.map((t) => t.tableNumber));

    let startNumber = 1;
    while (existingNumbers.has(startNumber)) {
      startNumber++;
    }

    const results: Array<{ tableNumber: number; qrCodeId: string; targetUrl: string }> = [];

    for (let i = 0; i < numberOfTables; i++) {
      const tableNumber = startNumber + i;

      const targetUrl = `${FRONTEND_URL}/menu/${restaurant.slug}?table=${tableNumber}&source=batch`;
      const label = `Table ${tableNumber}`;

      const qrBuffer = await QRCode.toBuffer(targetUrl, {
        type: 'png',
        width: 600,
        margin: 2,
      });

      let qrImageUrl: string | null = null;
      try {
        const uploaded = await uploadImage(qrBuffer, `qr-codes/${restaurantId}`);
        qrImageUrl = uploaded.url;
      } catch (err) {
        logger.warn('Cloudinary upload failed for batch QR', { error: err, tableNumber });
      }

      const qrCode = await prisma.qrCode.create({
        data: {
          restaurantId,
          label,
          tableNumber,
          qrType: 'TABLE',
          qrImageUrl,
          targetUrl,
          isActive: true,
        },
      });

      await prisma.restaurantTable.create({
        data: {
          restaurantId,
          tableNumber,
          label,
          capacity: 4,
          qrCodeId: qrCode.id,
        },
      });

      results.push({
        tableNumber,
        qrCodeId: qrCode.id,
        targetUrl,
      });
    }

    logger.info('Batch QR codes generated', { restaurantId, count: numberOfTables });

    res.status(201).json({
      success: true,
      data: {
        count: results.length,
        startNumber,
        endNumber: startNumber + numberOfTables - 1,
        codes: results,
        template: template || 'standard',
      },
    });
  })
);

// GET /:id - Get QR code details with scan stats
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const qrCode = await prisma.qrCode.findFirst({
      where: { id, restaurantId },
      include: {
        scans: {
          orderBy: { scannedAt: 'desc' },
          take: 50,
        },
        _count: { select: { scans: true } },
        tables: {
          select: { id: true, tableNumber: true, label: true, status: true },
        },
      },
    });

    if (!qrCode) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found', 'Msimbo wa QR haukupatikana');
    }

    const scanStats = {
      total: qrCode._count.scans,
      today: qrCode.scans.filter(
        (s) => s.scannedAt >= new Date(new Date().setHours(0, 0, 0, 0))
      ).length,
      uniqueSessions: new Set(qrCode.scans.map((s) => s.sessionId)).size,
      byDevice: qrCode.scans.reduce(
        (acc, s) => {
          const device = s.deviceType || 'unknown';
          acc[device] = (acc[device] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      recentScans: qrCode.scans.slice(0, 20),
    };

    res.json({
      success: true,
      data: {
        ...qrCode,
        scanStats,
        tableInfo: qrCode.tables[0] || null,
        _count: undefined,
        scans: undefined,
        tables: undefined,
      },
    });
  })
);

// PUT /:id - Update QR code label/table assignment
router.put(
  '/:id',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);
    const { label, tableNumber } = req.body;

    const qrCode = await prisma.qrCode.findFirst({
      where: { id, restaurantId },
    });
    if (!qrCode) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found', 'Msimbo wa QR haukupatikana');
    }

    const updateData: any = {};
    if (label !== undefined) updateData.label = label;
    if (tableNumber !== undefined) {
      updateData.tableNumber = tableNumber;
      updateData.targetUrl = qrCode.targetUrl.replace(/table=\d+/, `table=${tableNumber}`);
    }

    const updated = await prisma.qrCode.update({
      where: { id },
      data: updateData,
    });

    if (tableNumber !== undefined) {
      let table = await prisma.restaurantTable.findUnique({
        where: { restaurantId_tableNumber: { restaurantId, tableNumber } },
      });

      if (table) {
        await prisma.restaurantTable.update({
          where: { id: table.id },
          data: { qrCodeId: id },
        });
      } else {
        table = await prisma.restaurantTable.create({
          data: {
            restaurantId,
            tableNumber,
            label: label || `Table ${tableNumber}`,
            capacity: 4,
            qrCodeId: id,
          },
        });
      }
    }

    res.json({
      success: true,
      data: updated,
    });
  })
);

// DELETE /:id - Delete QR code
router.delete(
  '/:id',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const qrCode = await prisma.qrCode.findFirst({
      where: { id, restaurantId },
    });
    if (!qrCode) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found', 'Msimbo wa QR haukupatikana');
    }

    // Unlink tables
    await prisma.restaurantTable.updateMany({
      where: { qrCodeId: id, restaurantId },
      data: { qrCodeId: null },
    });

    await prisma.qrCode.delete({ where: { id } });

    logger.info('QR code deleted', { restaurantId, qrCodeId: id });

    res.json({
      success: true,
      data: { message: 'QR code deleted successfully', messageSwahili: 'Msimbo wa QR umefutwa kwa mafanikio' },
    });
  })
);

// GET /:id/download - Generate and return QR code PNG download
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const qrCode = await prisma.qrCode.findFirst({
      where: { id, restaurantId },
    });
    if (!qrCode) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found', 'Msimbo wa QR haukupatikana');
    }

    const qrBuffer = await QRCode.toBuffer(qrCode.targetUrl, {
      type: 'png',
      width: 1200,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, logoUrl: true },
    });

    const padding = 60;
    const textHeight = 80;
    const totalHeight = 1200 + padding * 2 + textHeight;

    const svgText = `
      <svg width="${1200 + padding * 2}" height="${totalHeight}">
        <rect width="100%" height="100%" fill="white"/>
        ${restaurant?.logoUrl ? `<image href="${restaurant.logoUrl}" x="${(1200 + padding * 2 - 100) / 2}" y="20" width="100" height="60" />` : ''}
        <text x="${(1200 + padding * 2) / 2}" y="${totalHeight - 30}" text-anchor="middle" font-family="Arial" font-size="36" fill="#333" font-weight="bold">
          ${restaurant?.name || ''} - ${qrCode.label}
        </text>
      </svg>
    `;

    const svgBuffer = Buffer.from(svgText);
    const composite = await sharp({
      create: {
        width: 1200 + padding * 2,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        { input: qrBuffer, left: padding, top: padding },
        { input: svgBuffer, left: 0, top: 0 },
      ])
      .png()
      .toBuffer();

    const filename = `QR-${qrCode.label.replace(/\s+/g, '-')}-${restaurantId.slice(0, 8)}.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', composite.length);
    res.send(composite);
  })
);

// GET /:id/pdf - Generate printable card PDF
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const qrCode = await prisma.qrCode.findFirst({
      where: { id, restaurantId },
    });
    if (!qrCode) {
      throw new AppError(404, 'QR_NOT_FOUND', 'QR code not found', 'Msimbo wa QR haukupatikana');
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, address: true },
    });

    const qrBuffer = await QRCode.toBuffer(qrCode.targetUrl, {
      type: 'png',
      width: 400,
      margin: 2,
    });

    const doc = new PDFDocument({
      size: [400, 600],
      margins: { top: 30, bottom: 30, left: 30, right: 30 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const filename = `QR-Card-${qrCode.label.replace(/\s+/g, '-')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    });

    // Restaurant name
    doc.fontSize(20).font('Helvetica-Bold').text(restaurant?.name || '', { align: 'center' });

    doc.moveDown(0.5);

    // Label
    doc.fontSize(16).font('Helvetica').text(qrCode.label, { align: 'center' });

    doc.moveDown(1);

    // QR Image
    const imgWidth = 250;
    const imgX = (doc.page.width - imgWidth) / 2;
    doc.image(qrBuffer, imgX, doc.y, {
      width: imgWidth,
      height: imgWidth,
    });

    const qrBottomY = doc.y + 10;

    doc.moveDown(1);

    // Instructions
    doc.fontSize(10).font('Helvetica').text('Scan to view menu', { align: 'center' });

    if (restaurant?.address) {
      doc.moveDown(0.3);
      doc.fontSize(8).fillColor('#666').text(restaurant.address, { align: 'center' });
    }

    // Footer
    doc.fillColor('#999').fontSize(7).text('Powered by MenuMoja', { align: 'center' });

    doc.end();
  })
);

export default router;
