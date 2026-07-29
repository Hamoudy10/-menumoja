import { Router, Response } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../../config/database';
import { authenticate, enforceRestaurantScope, validateQuery } from '../../middleware';
import { AppError, NotFoundError } from '../../utils/errors';
import { formatKES, asyncHandler } from '../../utils/helpers';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../types';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const periodQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['revenue', 'orders', 'views']).optional(),
  format: z.enum(['pdf', 'excel']).optional(),
});

function getDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate) };
  }

  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start, end };
}

function getPreviousRange(current: { start: Date; end: Date }): { start: Date; end: Date } {
  const diff = current.end.getTime() - current.start.getTime();
  return {
    start: new Date(current.start.getTime() - diff),
    end: new Date(current.start.getTime()),
  };
}

function formatDate(d: Date, groupBy?: string): string {
  if (groupBy === 'hour') return d.toISOString().slice(0, 13) + ':00';
  if (groupBy === 'day') return d.toISOString().slice(0, 10);
  if (groupBy === 'week') {
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return weekStart.toISOString().slice(0, 10);
  }
  if (groupBy === 'month') return d.toISOString().slice(0, 7);
  return d.toISOString().slice(0, 10);
}

router.get('/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);
  const prevRange = getPreviousRange(range);

  const currentOrders = await prisma.order.findMany({ where: { restaurantId, createdAt: { gte: range.start, lte: range.end } } })
  const prevOrders = await prisma.order.findMany({ where: { restaurantId, createdAt: { gte: prevRange.start, lte: prevRange.end } } })
  const currentPayments = await prisma.payment.findMany({ where: { restaurantId, createdAt: { gte: range.start, lte: range.end } } })
  const prevPayments = await prisma.payment.findMany({ where: { restaurantId, createdAt: { gte: prevRange.start, lte: prevRange.end } } })
  const currentScans = await prisma.qrScan.findMany({ where: { restaurantId, scannedAt: { gte: range.start, lte: range.end } } })
  const prevScans = await prisma.qrScan.findMany({ where: { restaurantId, scannedAt: { gte: prevRange.start, lte: prevRange.end } } })
  const menuItems = await prisma.menuItem.findMany({ where: { restaurantId }, orderBy: { totalOrders: 'desc' }, take: 1 })
  const currentAnalytics = await prisma.analyticsDaily.findMany({ where: { restaurantId, date: { gte: range.start, lte: range.end } } })

  const totalRevenue = currentPayments.reduce((s, p) => s + Number(p.amount), 0);
  const prevRevenue = prevPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalOrders = currentOrders.length;
  const prevOrdersCount = prevOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalScans = currentScans.length;
  const prevScansCount = prevScans.length;
  const topItem = menuItems[0] || null;

  const hours = currentOrders.map((o) => o.createdAt.getHours());
  const busiestHour = hours.length > 0
    ? hours.sort((a, b) => hours.filter((h) => h === a).length - hours.filter((h) => h === b).length).pop()
    : null;

  const metrics = {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    totalScans,
    topItem: topItem ? { id: topItem.id, name: topItem.name } : null,
    busiestHour,
    revenueMpesa: currentPayments.filter(p => p.paymentMethod === 'MPESA').reduce((s, p) => s + Number(p.amount), 0),
    revenueCash: currentPayments.filter(p => p.paymentMethod === 'CASH').reduce((s, p) => s + Number(p.amount), 0),
    revenueCard: currentPayments.filter(p => p.paymentMethod === 'CARD').reduce((s, p) => s + Number(p.amount), 0),
  };

  const comparisons = {
    revenueChange: prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 10000) / 100 : 0,
    ordersChange: prevOrdersCount > 0 ? Math.round(((totalOrders - prevOrdersCount) / prevOrdersCount) * 10000) / 100 : 0,
    scansChange: prevScansCount > 0 ? Math.round(((totalScans - prevScansCount) / prevScansCount) * 10000) / 100 : 0,
  };

  res.json({ success: true, data: { metrics, comparisons } });
}));

router.get('/revenue', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);
  const groupBy = query.groupBy || 'day';

  const payments = await prisma.payment.findMany({
    where: { restaurantId, createdAt: { gte: range.start, lte: range.end } },
    orderBy: { createdAt: 'asc' },
  });

  const grouped: Record<string, { date: string; mpesa: number; cash: number; total: number }> = {};

  for (const payment of payments) {
    const key = formatDate(payment.createdAt, groupBy);
    if (!grouped[key]) {
      grouped[key] = { date: key, mpesa: 0, cash: 0, total: 0 };
    }
    if (payment.paymentMethod === 'MPESA') {
      grouped[key].mpesa += Number(payment.amount);
    } else {
      grouped[key].cash += Number(payment.amount);
    }
    grouped[key].total += Number(payment.amount);
  }

  const data = Object.values(grouped);
  res.json({ success: true, data });
}));

router.get('/orders', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);
  const groupBy = query.groupBy || 'day';

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: range.start, lte: range.end } },
    orderBy: { createdAt: 'asc' },
  });

  const grouped: Record<string, { date: string; count: number; avgValue: number; totalRevenue: number }> = {};

  for (const order of orders) {
    const key = formatDate(order.createdAt, groupBy);
    if (!grouped[key]) {
      grouped[key] = { date: key, count: 0, avgValue: 0, totalRevenue: 0 };
    }
    grouped[key].count++;
    grouped[key].totalRevenue += Number(order.totalAmount);
  }

  const data = Object.values(grouped).map((g) => ({
    ...g,
    avgValue: g.count > 0 ? Math.round((g.totalRevenue / g.count) * 100) / 100 : 0,
  }));

  res.json({ success: true, data });
}));

router.get('/menu-items', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const limit = query.limit || 10;
  const sortBy = query.sortBy || 'revenue';

  const range = getDateRange(query.period, query.startDate, query.endDate);

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: { restaurantId, createdAt: { gte: range.start, lte: range.end } },
    },
    include: { menuItem: { select: { id: true, name: true, price: true } } },
  });

  const itemMap: Record<string, { id: string; name: string; totalOrders: number; totalRevenue: number; totalViews: number }> = {};

  for (const oi of orderItems) {
    if (!itemMap[oi.menuItemId]) {
      itemMap[oi.menuItemId] = {
        id: oi.menuItem.id,
        name: oi.menuItem.name,
        totalOrders: 0,
        totalRevenue: 0,
        totalViews: 0,
      };
    }
    itemMap[oi.menuItemId].totalOrders += oi.quantity;
    itemMap[oi.menuItemId].totalRevenue += Number(oi.subtotal);
  }

  const menuItemAnalytics = await prisma.menuItemAnalytics.findMany({
    where: { restaurantId, date: { gte: range.start, lte: range.end } },
    select: { menuItemId: true, views: true },
  });

  for (const mia of menuItemAnalytics) {
    if (itemMap[mia.menuItemId]) {
      itemMap[mia.menuItemId].totalViews += mia.views;
    }
  }

  let items = Object.values(itemMap);

  if (sortBy === 'revenue') items.sort((a, b) => b.totalRevenue - a.totalRevenue);
  else if (sortBy === 'orders') items.sort((a, b) => b.totalOrders - a.totalOrders);
  else if (sortBy === 'views') items.sort((a, b) => b.totalViews - a.totalViews);

  const top = items.slice(0, limit);
  const bottom = items.slice(-limit).reverse();

  res.json({ success: true, data: { top, bottom } });
}));

router.get('/tables', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    select: { id: true, tableNumber: true },
  });

  const orders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: range.start, lte: range.end }, tableNumber: { not: null } },
    select: { tableNumber: true, totalAmount: true },
  });

  const tableMap: Record<number, { tableNumber: number; totalOrders: number; totalRevenue: number }> = {};
  for (const table of tables) {
    tableMap[table.tableNumber] = { tableNumber: table.tableNumber, totalOrders: 0, totalRevenue: 0 };
  }

  for (const order of orders) {
    if (order.tableNumber && tableMap[order.tableNumber]) {
      tableMap[order.tableNumber].totalOrders++;
      tableMap[order.tableNumber].totalRevenue += Number(order.totalAmount);
    }
  }

  const data = Object.values(tableMap).map((t) => ({
    ...t,
    totalRevenue: Math.round(t.totalRevenue * 100) / 100,
    avgOrderValue: t.totalOrders > 0 ? Math.round((t.totalRevenue / t.totalOrders) * 100) / 100 : 0,
  }));

  res.json({ success: true, data: { tables: data } });
}));

router.get('/scans', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);
  const groupBy = query.groupBy || 'day';

  const scans = await prisma.qrScan.findMany({
    where: { restaurantId, scannedAt: { gte: range.start, lte: range.end } },
    orderBy: { scannedAt: 'asc' },
  });

  const grouped: Record<string, { date: string; count: number; uniqueDevices: number; deviceSet: Set<string> }> = {};

  for (const scan of scans) {
    const key = formatDate(scan.scannedAt, groupBy);
    if (!grouped[key]) {
      grouped[key] = { date: key, count: 0, uniqueDevices: 0, deviceSet: new Set() };
    }
    grouped[key].count++;
    if (scan.sessionId) grouped[key].deviceSet.add(scan.sessionId);
  }

  const data = Object.values(grouped).map((g) => ({
    date: g.date,
    count: g.count,
    uniqueDevices: g.deviceSet.size,
  }));

  res.json({ success: true, data });
}));

router.get('/search-terms', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);

  const searches = await prisma.searchAnalytics.groupBy({
    by: ['searchTerm'],
    where: { restaurantId, searchedAt: { gte: range.start, lte: range.end } },
    _count: { searchTerm: true },
    orderBy: { _count: { searchTerm: 'desc' } },
    take: 20,
  });

  const terms = searches.map((s) => ({ term: s.searchTerm, count: s._count.searchTerm }));

  res.json({ success: true, data: { terms } });
}));

router.get('/ai-questions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const range = getDateRange(query.period, query.startDate, query.endDate);

  const conversations = await prisma.aiConversation.findMany({
    where: { restaurantId, createdAt: { gte: range.start, lte: range.end } },
    select: { messages: true },
  });

  const questionCounts: Record<string, number> = {};

  for (const conv of conversations) {
    const msgs = conv.messages as Array<{ role: string; content: string }> || [];
    for (const msg of msgs) {
      if (msg.role === 'user') {
        const q = msg.content.trim().substring(0, 200);
        if (q.length > 5) {
          questionCounts[q] = (questionCounts[q] || 0) + 1;
        }
      }
    }
  }

  const questions = Object.entries(questionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([question, count]) => ({ question, count }));

  res.json({ success: true, data: { questions } });
}));

router.get('/export', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const query = periodQuerySchema.parse(req.query);
  const format = query.format || 'pdf';
  const range = getDateRange(query.period, query.startDate, query.endDate);

  const [orders, payments, scans, menuItems, dailyAnalytics] = await Promise.all([
    prisma.order.findMany({ where: { restaurantId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: 'asc' } }),
    prisma.payment.findMany({ where: { restaurantId, createdAt: { gte: range.start, lte: range.end } } }),
    prisma.qrScan.findMany({ where: { restaurantId, scannedAt: { gte: range.start, lte: range.end } } }),
    prisma.menuItem.findMany({ where: { restaurantId }, orderBy: { totalOrders: 'desc' }, take: 10 }),
    prisma.analyticsDaily.findMany({ where: { restaurantId, date: { gte: range.start, lte: range.end } }, orderBy: { date: 'asc' } }),
  ]);

  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalOrders = orders.length;
  const totalScans = scans.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  if (format === 'pdf') {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${range.start.toISOString().slice(0, 10)}-${range.end.toISOString().slice(0, 10)}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('MenuMoja Analytics Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Period: ${range.start.toISOString().slice(0, 10)} to ${range.end.toISOString().slice(0, 10)}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).font('Helvetica-Bold').text('Key Metrics');
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Total Revenue: ${formatKES(totalRevenue)}`);
    doc.text(`Total Orders: ${totalOrders}`);
    doc.text(`Average Order Value: ${formatKES(avgOrderValue)}`);
    doc.text(`Total QR Scans: ${totalScans}`);
    doc.moveDown();

    doc.fontSize(16).font('Helvetica-Bold').text('Top Menu Items');
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    for (const item of menuItems.slice(0, 5)) {
      doc.text(`${item.name} - ${item.totalOrders} orders`);
    }
    doc.moveDown();

    doc.fontSize(16).font('Helvetica-Bold').text('Daily Analytics');
    doc.moveDown();
    doc.fontSize(10).font('Helvetica');
    for (const da of dailyAnalytics) {
      doc.text(`${da.date.toISOString().slice(0, 10)}: ${formatKES(Number(da.totalRevenueKes))} revenue, ${da.totalOrders} orders, ${da.totalScans} scans`);
    }

    doc.end();
    return;
  }

  if (format === 'excel') {
    const rows = [
      ['Date', 'Orders', 'Revenue (KES)', 'Scans', 'Avg Order Value (KES)'],
    ];

    dailyAnalytics.forEach((da) => {
      rows.push([
        da.date.toISOString().slice(0, 10),
        String(da.totalOrders),
        String(Number(da.totalRevenueKes)),
        String(da.totalScans),
        String(Number(da.averageOrderValue)),
      ]);
    });

    const csvContent = rows.map((row) => row.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${range.start.toISOString().slice(0, 10)}-${range.end.toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
    return;
  }

  res.json({ success: true, data: { totalRevenue, totalOrders, totalScans, avgOrderValue, dailyAnalytics } });
}));

export default router;
