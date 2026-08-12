import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, enforceRestaurantScope, auditLog, validate, validateParams, asyncHandler } from '@/middleware';
import { NotFoundError } from '@/utils/errors';
import {
  createRecipe,
  updateRecipe,
  getActiveRecipe,
  getRecipeVersions,
  getMenuItemCosting,
  getAllMenuItemCostings,
} from '@/services/recipe.service';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const menuItemParamSchema = z.object({ menuItemId: z.string().uuid('Invalid menu item ID') });
const recipeParamSchema = z.object({ id: z.string().uuid('Invalid recipe ID') });

const recipeIngredientSchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID'),
  quantity: z.number().min(0.01, 'Quantity must be positive').max(100000),
});

const createRecipeSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  name: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  ingredients: z.array(recipeIngredientSchema).min(1, 'At least one ingredient is required').max(50),
}).strict();

const updateRecipeSchema = z.object({
  name: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  ingredients: z.array(recipeIngredientSchema).min(1, 'At least one ingredient is required').max(50),
}).strict();

// GET /recipes/status - all menu items with costing (for the recipes UI)
router.get('/status', asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const costings = await getAllMenuItemCostings(restaurantId);
  res.json({ success: true, data: costings });
}));

// GET /recipes/items/:menuItemId/versions - version history
router.get('/items/:menuItemId/versions', validateParams(menuItemParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const menuItemId = String(req.params.menuItemId);
  const versions = await getRecipeVersions(restaurantId, menuItemId);
  res.json({ success: true, data: versions });
}));

// GET /recipes/items/:menuItemId - active recipe with ingredients + costing
router.get('/items/:menuItemId', validateParams(menuItemParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const menuItemId = String(req.params.menuItemId);
  const [recipe, costing] = await Promise.all([
    getActiveRecipe(restaurantId, menuItemId),
    getMenuItemCosting(restaurantId, menuItemId),
  ]);
  if (!recipe && !costing) {
    throw new NotFoundError('Menu item not found', 'Bidhaa ya menyu haikupatikana');
  }
  res.json({ success: true, data: { recipe, costing } });
}));

// POST /recipes - create recipe version 1
router.post('/', auditLog, validate(createRecipeSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const { menuItemId, name, notes, ingredients } = req.body;
  const recipe = await createRecipe(restaurantId, menuItemId, ingredients, { name, notes });
  res.status(201).json({ success: true, data: recipe });
}));

// PUT /recipes/items/:menuItemId - save a NEW version (history preserved)
router.put('/items/:menuItemId', auditLog, validate(updateRecipeSchema), validateParams(menuItemParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const menuItemId = String(req.params.menuItemId);
  const { name, notes, ingredients } = req.body;
  const recipe = await updateRecipe(restaurantId, menuItemId, ingredients, { name, notes });
  res.json({ success: true, data: recipe });
}));

// GET /recipes/items/:menuItemId/costing - live costing for one item
router.get('/items/:menuItemId/costing', validateParams(menuItemParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const menuItemId = String(req.params.menuItemId);
  const costing = await getMenuItemCosting(restaurantId, menuItemId);
  if (!costing) {
    throw new NotFoundError('Menu item not found', 'Bidhaa ya menyu haikupatikana');
  }
  res.json({ success: true, data: costing });
}));

// GET /recipes/:id - a specific recipe version
router.get('/:id', validateParams(recipeParamSchema), asyncHandler(async (req, res) => {
  const restaurantId = (req as any).restaurantId;
  const id = String(req.params.id);
  const recipe = await prisma.recipe.findFirst({
    where: { id, restaurantId },
    include: {
      ingredients: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      },
    },
  });
  if (!recipe) {
    throw new NotFoundError('Recipe not found', 'Resipi haikupatikana');
  }
  res.json({ success: true, data: recipe });
}));

export default router;
