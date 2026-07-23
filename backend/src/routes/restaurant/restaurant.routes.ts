import { Router } from 'express';
import { asyncHandler, AppError, generateSlug, hashPassword, generatePin } from '@/utils';
import { authenticate, enforceRestaurantScope, validate, auditLog } from '@/middleware';
import { updateRestaurantSchema, updateSettingsSchema, openingHoursSchema, createBranchSchema, createTableSchema, updateTableSchema, createStaffSchema, updateStaffSchema } from '@/utils/validation';
import { prisma } from '@/config/database';
import logger from '@/utils/logger';

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
        }
        return slug;
      })();
    }

    const { brandColor, fontStyle, ...restaurantData } = data;

    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: restaurantData,
    });

    if (brandColor !== undefined || fontStyle !== undefined) {
      const settingsUpdate: any = {};
      if (brandColor !== undefined) settingsUpdate.primaryColor = brandColor;
      if (fontStyle !== undefined) settingsUpdate.fontFamily = fontStyle;
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

// PUT /me/settings - Update restaurant settings
router.put(
  '/me/settings',
  auditLog,
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const settings = await prisma.restaurantSettings.upsert({
      where: { restaurantId },
      create: { restaurantId, ...req.body },
      update: req.body,
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
    const { tableNumber, label, capacity } = req.body;

    const existing = await prisma.restaurantTable.findUnique({
      where: { restaurantId_tableNumber: { restaurantId, tableNumber } },
    });
    if (existing) {
      throw new AppError(409, 'TABLE_EXISTS', `Table ${tableNumber} already exists`, `Meza namba ${tableNumber} tayari ipo`);
    }

    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId,
        tableNumber,
        label: label || `Table ${tableNumber}`,
        capacity: capacity || 4,
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
    const { tableId } = req.params;
    const data = req.body;

    const table = await prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
    });
    if (!table) {
      throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found', 'Meza haikupatikana');
    }

    if (data.tableNumber && data.tableNumber !== table.tableNumber) {
      const conflict = await prisma.restaurantTable.findUnique({
        where: { restaurantId_tableNumber: { restaurantId, tableNumber: data.tableNumber } },
      });
      if (conflict) {
        throw new AppError(409, 'TABLE_EXISTS', `Table ${data.tableNumber} already exists`, `Meza namba ${data.tableNumber} tayari ipo`);
      }
    }

    const updated = await prisma.restaurantTable.update({
      where: { id: tableId },
      data,
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
    const { tableId } = req.params;

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

// GET /me/staff - List staff members
router.get(
  '/me/staff',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const staff = await prisma.staff.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            assignedOrders: true,
            shifts: { where: { isActive: true } },
          },
        },
      },
    });

    const mapped = staff.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      phone: s.phone,
      role: s.role.toLowerCase(),
      isActive: s.isActive,
      lastLogin: s.lastLogin,
      createdAt: s.createdAt,
      activeShift: s._count.shifts > 0,
      activeOrders: s._count.assignedOrders,
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
    const { name, email, phone, role, pin, employeeNumber, nationalId, kraPin, nhifNumber, nssfNumber, dateOfBirth, address, emergencyName, emergencyPhone, emergencyRelation, nextOfKin, nextOfKinPhone, nextOfKinRelation, bankName, bankBranch, bankAccount, monthlySalary, hourlyRate, leaveDays, startDate, notes } = req.body;

    const existing = await prisma.staff.findFirst({
      where: { restaurantId, OR: [{ phone }, { fullName: name }] },
    });
    if (existing) {
      throw new AppError(409, 'STAFF_EXISTS', 'A staff member with this name or phone already exists', 'Mfanyakazi mwenye jina au nambari hii ya simu tayari yupo');
    }

    const staffPin = pin || generatePin();
    const pinHash = await hashPassword(staffPin);

    const roleMap: Record<string, string> = {
      manager: 'MANAGER',
      cashier: 'CASHIER',
      waiter: 'WAITER',
      kitchen: 'KITCHEN',
    };

    const staff = await prisma.staff.create({
      data: {
        restaurantId,
        fullName: name,
        phone: phone || '',
        email,
        pinHash,
        role: (roleMap[role] || 'WAITER') as any,
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
    const { staffId } = req.params;
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
    const { staffId } = req.params;

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
    const { staffId } = req.params;

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
