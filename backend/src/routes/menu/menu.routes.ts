import { Router } from 'express';
import { asyncHandler, AppError } from '@/utils';
import { authenticate, enforceRestaurantScope, validate, auditLog } from '@/middleware';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  createItemSchema,
  updateItemSchema,
  bulkUpdateSchema as bulkUpdateItemsSchema,
} from '@/utils/validation';
import { prisma } from '@/config/database';
import { invalidateMenuCache } from '@/utils/cache';
import logger from '@/utils/logger';

const router = Router();

// ==============================
// OWNER ROUTES
// ==============================

router.use(authenticate);
router.use(enforceRestaurantScope);

// ---------- CATEGORIES ----------

// GET /categories - List all categories with items count
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { menuItems: true } },
        menuItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json({
      success: true,
      data: categories,
    });
  })
);

// POST /categories - Create category
router.post(
  '/categories',
  auditLog,
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { name, nameSw, nameAr, description, displayOrder, isActive, image } = req.body;

    const existing = await prisma.menuCategory.findFirst({
      where: { restaurantId, name },
    });
    if (existing) {
      throw new AppError(409, 'CATEGORY_EXISTS', 'A category with this name already exists', 'Kategoria yenye jina hili tayari ipo');
    }

    const maxOrder = await prisma.menuCategory.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    });

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        name,
        nameSw,
        nameAr,
        description,
        sortOrder: displayOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        isActive: isActive ?? true,
      },
    });

    await invalidateMenuCache(restaurantId);

    res.status(201).json({
      success: true,
      data: category,
    });
  })
);

// PUT /categories/:id - Update category
router.put(
  '/categories/:id',
  auditLog,
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);
    const data = req.body;

    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId },
    });
    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found', 'Kategoria haikupatikana');
    }

    if (data.name && data.name !== category.name) {
      const conflict = await prisma.menuCategory.findFirst({
        where: { restaurantId, name: data.name, id: { not: id } },
      });
      if (conflict) {
        throw new AppError(409, 'CATEGORY_EXISTS', 'A category with this name already exists', 'Kategoria yenye jina hili tayari ipo');
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.displayOrder !== undefined) updateData.sortOrder = data.displayOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.menuCategory.update({
      where: { id },
      data: updateData,
    });

    await invalidateMenuCache(restaurantId);

    res.json({
      success: true,
      data: updated,
    });
  })
);

// DELETE /categories/:id - Delete category
router.delete(
  '/categories/:id',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);
    const { reassignToCategoryId } = req.query;

    const category = await prisma.menuCategory.findFirst({
      where: { id, restaurantId },
      include: { _count: { select: { menuItems: true } } },
    });

    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found', 'Kategoria haikupatikana');
    }

    if (category._count.menuItems > 0) {
      if (reassignToCategoryId && typeof reassignToCategoryId === 'string') {
        const targetCategory = await prisma.menuCategory.findFirst({
          where: { id: reassignToCategoryId, restaurantId },
        });
        if (!targetCategory) {
          throw new AppError(404, 'TARGET_CATEGORY_NOT_FOUND', 'Target category for reassignment not found', 'Kategoria lengwa la ugawaji haikupatikana');
        }

        await prisma.menuItem.updateMany({
          where: { categoryId: id },
          data: { categoryId: reassignToCategoryId },
        });
      } else {
        await prisma.menuItem.deleteMany({ where: { categoryId: id } });
      }
    }

    await prisma.menuCategory.delete({ where: { id } });
    await invalidateMenuCache(restaurantId);

    logger.info('Category deleted', { restaurantId, categoryId: id });

    res.json({
      success: true,
      data: { message: 'Category deleted successfully', messageSwahili: 'Kategoria imefutwa kwa mafanikio' },
    });
  })
);

// PUT /categories/reorder - Bulk reorder categories
router.put(
  '/categories/reorder',
  auditLog,
  validate(reorderCategoriesSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { order } = req.body as { order: Array<{ id: string; sortOrder: number }> };

    await prisma.$transaction(
      order.map((item) =>
        prisma.menuCategory.updateMany({
          where: { id: item.id, restaurantId },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    await invalidateMenuCache(restaurantId);

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: categories,
    });
  })
);

// ---------- ITEMS ----------

// GET /items - List items with filters
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { categoryId, available, special, search, page, perPage } = req.query;

    const where: any = { restaurantId };

    if (categoryId) where.categoryId = categoryId as string;
    if (available === 'true') where.isAvailable = true;
    if (available === 'false') where.isAvailable = false;
    if (special === 'true') where.isTodaysSpecial = true;

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { nameSw: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const perPageNum = Math.min(100, Math.max(1, Number(perPage) || 50));

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (pageNum - 1) * perPageNum,
        take: perPageNum,
        include: {
          category: { select: { id: true, name: true, sortOrder: true } },
        },
      }),
      prisma.menuItem.count({ where }),
    ]);

    res.json({
      success: true,
      data: items,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum),
        hasNext: pageNum * perPageNum < total,
        hasPrev: pageNum > 1,
      },
    });
  })
);

// GET /items/:id - Single item detail
router.get(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
      include: {
        category: { select: { id: true, name: true, sortOrder: true } },
      },
    });

    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
    }

    res.json({
      success: true,
      data: item,
    });
  })
);

// POST /items - Create item
router.post(
  '/items',
  auditLog,
  validate(createItemSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const data = req.body;

    const category = await prisma.menuCategory.findFirst({
      where: { id: data.categoryId, restaurantId },
    });
    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found', 'Kategoria haikupatikana');
    }

    const maxOrder = await prisma.menuItem.aggregate({
      where: { restaurantId, categoryId: data.categoryId },
      _max: { sortOrder: true },
    });

    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description || '',
        price: data.price,
        currency: 'KES',
        isAvailable: data.isAvailable ?? true,
        isTodaysSpecial: data.isSpecial ?? false,
        isFeatured: data.isPopular ?? false,
        isNew: data.isNew ?? false,
        isHalal: data.isHalal ?? false,
        isVegetarian: data.isVegetarian ?? false,
        isVegan: data.isVegan ?? false,
        isGlutenFree: data.isGlutenFree ?? false,
        spiceLevel: data.spiceLevel ?? 'NONE',
        containsNuts: data.containsNuts ?? false,
        containsDairy: data.containsDairy ?? false,
        containsSeafood: data.containsSeafood ?? false,
        allergenNotes: data.allergenNotes || (data.allergens?.join(', ') ?? null),
        nameSw: data.nameSw || null,
        nameAr: data.nameAr || null,
        descriptionSw: data.descriptionSw || null,
        descriptionAr: data.descriptionAr || null,
        photoUrl: data.image,
        preparationTimeMinutes: data.preparationTime,
        calories: data.calories,
        ingredients: data.ingredients || [],
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    await invalidateMenuCache(restaurantId);

    res.status(201).json({
      success: true,
      data: item,
    });
  })
);

// PUT /items/:id - Update item
router.put(
  '/items/:id',
  auditLog,
  validate(updateItemSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);
    const data = req.body;

    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
    if (data.isPopular !== undefined) updateData.isFeatured = data.isPopular;
    if (data.isSpecial !== undefined) updateData.isTodaysSpecial = data.isSpecial;
    if (data.isNew !== undefined) updateData.isNew = data.isNew;
    if (data.isHalal !== undefined) updateData.isHalal = data.isHalal;
    if (data.isVegetarian !== undefined) updateData.isVegetarian = data.isVegetarian;
    if (data.isVegan !== undefined) updateData.isVegan = data.isVegan;
    if (data.isGlutenFree !== undefined) updateData.isGlutenFree = data.isGlutenFree;
    if (data.spiceLevel !== undefined) updateData.spiceLevel = data.spiceLevel;
    if (data.containsNuts !== undefined) updateData.containsNuts = data.containsNuts;
    if (data.containsDairy !== undefined) updateData.containsDairy = data.containsDairy;
    if (data.containsSeafood !== undefined) updateData.containsSeafood = data.containsSeafood;
    if (data.allergenNotes !== undefined) updateData.allergenNotes = data.allergenNotes;
    if (data.nameSw !== undefined) updateData.nameSw = data.nameSw;
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
    if (data.descriptionSw !== undefined) updateData.descriptionSw = data.descriptionSw;
    if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr;
    if (data.calories !== undefined) updateData.calories = data.calories;
    if (data.preparationTime !== undefined) updateData.preparationTimeMinutes = data.preparationTime;
    if (data.calories !== undefined) updateData.calories = data.calories;
    if (data.ingredients !== undefined) updateData.ingredients = data.ingredients;
    if (data.image !== undefined) updateData.photoUrl = data.image;
    if (data.allergens !== undefined) updateData.allergenNotes = data.allergens.join(', ');

    if (data.categoryId) {
      const category = await prisma.menuCategory.findFirst({
        where: { id: data.categoryId, restaurantId },
      });
      if (!category) {
        throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found', 'Kategoria haikupatikana');
      }
      updateData.categoryId = data.categoryId;
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await invalidateMenuCache(restaurantId);

    res.json({
      success: true,
      data: updated,
    });
  })
);

// DELETE /items/:id - Delete item
router.delete(
  '/items/:id',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
    }

    await prisma.menuItem.delete({ where: { id } });
    await invalidateMenuCache(restaurantId);

    logger.info('Menu item deleted', { restaurantId, itemId: id });

    res.json({
      success: true,
      data: { message: 'Item deleted successfully', messageSwahili: 'Kipengee kimefutwa kwa mafanikio' },
    });
  })
);

// PUT /items/reorder - Reorder items within category
router.put(
  '/items/reorder',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { order } = req.body as { order: Array<{ id: string; sortOrder: number; categoryId?: string }> };

    if (!Array.isArray(order) || order.length === 0) {
      throw new AppError(400, 'INVALID_ORDER', 'Order array is required', 'Mpangilio wa safu unahitajika');
    }

    await prisma.$transaction(
      order.map((item) => {
        const data: any = { sortOrder: item.sortOrder };
        if (item.categoryId) data.categoryId = item.categoryId;
        return prisma.menuItem.updateMany({
          where: { id: item.id, restaurantId },
          data,
        });
      })
    );

    await invalidateMenuCache(restaurantId);

    res.json({
      success: true,
      data: { message: 'Items reordered successfully', messageSwahili: 'Vipengee vimepangwa upya kwa mafanikio' },
    });
  })
);

// PUT /items/:id/toggle - Toggle availability
router.put(
  '/items/:id/toggle',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const item = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });

    await invalidateMenuCache(restaurantId);

    res.json({
      success: true,
      data: updated,
    });
  })
);

// POST /items/bulk-update - Bulk price/availability update
router.post(
  '/items/bulk-update',
  auditLog,
  validate(bulkUpdateItemsSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { items } = req.body as { items: Array<{ id: string; price?: number; isAvailable?: boolean; isPopular?: boolean; categoryId?: string }> };

    const results = { updated: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> };

    for (const update of items) {
      try {
        const existing = await prisma.menuItem.findFirst({
          where: { id: update.id, restaurantId },
        });
        if (!existing) {
          results.failed++;
          results.errors.push({ id: update.id, error: 'Item not found' });
          continue;
        }

        const data: any = {};
        if (update.price !== undefined) data.price = update.price;
        if (update.isAvailable !== undefined) data.isAvailable = update.isAvailable;
        if (update.isPopular !== undefined) data.isFeatured = update.isPopular;
        if (update.categoryId) {
          const cat = await prisma.menuCategory.findFirst({
            where: { id: update.categoryId, restaurantId },
          });
          if (!cat) {
            results.failed++;
            results.errors.push({ id: update.id, error: 'Category not found' });
            continue;
          }
          data.categoryId = update.categoryId;
        }

        await prisma.menuItem.update({ where: { id: update.id }, data });
        results.updated++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ id: update.id, error: err.message });
      }
    }

    await invalidateMenuCache(restaurantId);

    logger.info('Bulk update completed', { restaurantId, updated: results.updated, failed: results.failed });

    res.json({
      success: true,
      data: results,
    });
  })
);

// POST /items/:id/duplicate - Clone item
router.post(
  '/items/:id/duplicate',
  auditLog,
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const id = String(req.params.id);

    const original = await prisma.menuItem.findFirst({
      where: { id, restaurantId },
    });
    if (!original) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Kipengee cha menyu hakikupatikana');
    }

    const maxOrder = await prisma.menuItem.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    });

    const duplicate = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: original.categoryId,
        name: `${original.name} (Copy)`,
        description: original.description,
        price: original.price,
        currency: original.currency,
        isAvailable: false,
        isTodaysSpecial: false,
        photoUrl: original.photoUrl,
        preparationTimeMinutes: original.preparationTimeMinutes,
        calories: original.calories,
        ingredients: original.ingredients,
        allergenNotes: original.allergenNotes,
        spiceLevel: original.spiceLevel,
        isHalal: original.isHalal,
        isVegetarian: original.isVegetarian,
        isVegan: original.isVegan,
        isGlutenFree: original.isGlutenFree,
        containsNuts: original.containsNuts,
        containsDairy: original.containsDairy,
        containsSeafood: original.containsSeafood,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });

    await invalidateMenuCache(restaurantId);

    res.status(201).json({
      success: true,
      data: duplicate,
    });
  })
);

export default router;
