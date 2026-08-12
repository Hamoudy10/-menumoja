import { prisma } from '@/config/database';
import { NotFoundError, ConflictError } from '@/utils/errors';
import logger from '@/utils/logger';
import { getItemCurrentCost } from '@/services/inventory.service';

/**
 * Recipe & food costing service.
 *
 * Versioning: every save creates a NEW recipe version (v1, v2, …) with
 * ingredient cost snapshots taken at save time. Historical recipes are
 * immutable — ingredient cost changes never rewrite old versions, and order
 * costing can be reconstructed from the version active at the time.
 */

export interface IngredientInput {
  inventoryItemId: string;
  quantity: number;
}

const SERVICE_CHARGE_FACTOR = 1.05;

/**
 * Creates version 1 of a recipe for a menu item.
 * The menu item's selling price is the VAT-inclusive total; the cost side
 * uses ingredient cost snapshots, so contribution = price - cost.
 */
export async function createRecipe(
  restaurantId: string,
  menuItemId: string,
  ingredients: IngredientInput[],
  options: { name?: string; notes?: string } = {}
): Promise<any> {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    select: { id: true, name: true, price: true },
  });
  if (!item) {
    throw new NotFoundError('Menu item not found', 'Bidhaa ya menyu haikupatikana');
  }

  const existing = await prisma.recipe.findFirst({
    where: { menuItemId, isActive: true },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('This menu item already has an active recipe — save as a new version instead', 'Bidhaa hii tayari ina resipi — hifadhi kama toleo jipya');
  }

  return saveRecipeVersion(restaurantId, item, ingredients, 1, options);
}

/**
 * Saves a new version of the recipe for a menu item (vN+1), deactivating
 * the previous active version. Historical versions are preserved.
 */
export async function updateRecipe(
  restaurantId: string,
  menuItemId: string,
  ingredients: IngredientInput[],
  options: { name?: string; notes?: string } = {}
): Promise<any> {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    select: { id: true, name: true, price: true },
  });
  if (!item) {
    throw new NotFoundError('Menu item not found', 'Bidhaa ya menyu haikupatikana');
  }

  const latest = await prisma.recipe.findFirst({
    where: { menuItemId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return saveRecipeVersion(restaurantId, item, ingredients, (latest?.version || 0) + 1, options);
}

async function saveRecipeVersion(
  restaurantId: string,
  item: { id: string; name: string; price: unknown },
  ingredients: IngredientInput[],
  version: number,
  options: { name?: string; notes?: string }
): Promise<any> {
  if (ingredients.length === 0) {
    throw new ConflictError('A recipe needs at least one ingredient', 'Resipi inahitaji angalau kiungo kimoja');
  }

  // Snapshot the current cost of every ingredient BEFORE writing anything.
  const snapshots: Array<{ inventoryItemId: string; quantity: number; unitCostSnapshot: number }> = [];
  for (const ing of ingredients) {
    const inv = await prisma.inventoryItem.findFirst({
      where: { id: ing.inventoryItemId, restaurantId },
      select: { id: true },
    });
    if (!inv) {
      throw new NotFoundError(`Inventory item not found: ${ing.inventoryItemId}`, 'Kiungo hakikupatikana');
    }
    if (!isFinite(ing.quantity) || ing.quantity <= 0) {
      throw new ConflictError('Ingredient quantities must be positive', 'Kiasi cha kiungo lazima kiwe chanya');
    }
    const cost = await getItemCurrentCost(restaurantId, ing.inventoryItemId);
    snapshots.push({ inventoryItemId: ing.inventoryItemId, quantity: ing.quantity, unitCostSnapshot: cost });
  }

  const recipe = await prisma.$transaction(async (tx) => {
    await tx.recipe.updateMany({
      where: { menuItemId: item.id, isActive: true },
      data: { isActive: false },
    });

    const created = await tx.recipe.create({
      data: {
        restaurantId,
        menuItemId: item.id,
        version,
        name: options.name || item.name,
        notes: options.notes || null,
        isActive: true,
        ingredients: {
          create: snapshots.map((s) => ({
            inventoryItemId: s.inventoryItemId,
            quantity: s.quantity,
            unitCostSnapshot: s.unitCostSnapshot,
          })),
        },
      },
      include: {
        ingredients: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
      },
    });

    return created;
  });

  logger.info('Recipe version saved', { menuItemId: item.id, version, restaurantId, ingredientCount: snapshots.length });
  return recipe;
}

/**
 * Returns the ACTIVE recipe with ingredients for a menu item, or null.
 */
export async function getActiveRecipe(restaurantId: string, menuItemId: string): Promise<any | null> {
  return prisma.recipe.findFirst({
    where: { restaurantId, menuItemId, isActive: true },
    include: {
      ingredients: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      },
    },
  });
}

/**
 * Returns all recipe versions for a menu item (newest first).
 */
export async function getRecipeVersions(restaurantId: string, menuItemId: string): Promise<any[]> {
  return prisma.recipe.findMany({
    where: { restaurantId, menuItemId },
    orderBy: { version: 'desc' },
    include: {
      ingredients: {
        include: { inventoryItem: { select: { id: true, name: true, unit: true } } },
      },
    },
  });
}

/**
 * Computes the cost of the active recipe for a menu item (sum of
 * quantity × unitCostSnapshot).
 */
export async function getRecipeCost(restaurantId: string, menuItemId: string): Promise<{ cost: number; version: number | null }> {
  const recipe = await getActiveRecipe(restaurantId, menuItemId);
  if (!recipe) return { cost: 0, version: null };

  const cost = recipe.ingredients.reduce(
    (sum: number, ing: any) => sum + Number(ing.quantity) * Number(ing.unitCostSnapshot),
    0
  );

  return { cost: Math.round(cost * 100) / 100, version: recipe.version };
}

export interface MenuItemCosting {
  menuItemId: string;
  menuItemName: string;
  price: number;
  cost: number;
  contribution: number;
  marginPct: number;
  hasRecipe: boolean;
  recipeVersion: number | null;
}

/**
 * Full costing for one menu item:
 *   cost        = Σ(ingredient qty × snapshot cost)
 *   contribution = selling price − cost
 *   margin %     = contribution / price × 100
 */
export async function getMenuItemCosting(restaurantId: string, menuItemId: string): Promise<MenuItemCosting | null> {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    select: { id: true, name: true, price: true },
  });
  if (!item) return null;

  const { cost, version } = await getRecipeCost(restaurantId, menuItemId);
  const price = Number(item.price);
  const contribution = Math.round((price - cost) * 100) / 100;
  const marginPct = price > 0 ? Math.round((contribution / price) * 1000) / 10 : 0;

  return {
    menuItemId: item.id,
    menuItemName: item.name,
    price,
    cost,
    contribution,
    marginPct,
    hasRecipe: version !== null,
    recipeVersion: version,
  };
}

/**
 * Costing for all menu items (used by the recipes UI + menu engineering).
 * Returns null-cost entries for items without recipes.
 */
export async function getAllMenuItemCostings(restaurantId: string): Promise<MenuItemCosting[]> {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId },
    select: { id: true, name: true, price: true },
    orderBy: { name: 'asc' },
  });

  const recipes = await prisma.recipe.findMany({
    where: { restaurantId, isActive: true },
    include: { ingredients: true },
  });
  const recipeMap = new Map(recipes.map((r) => [r.menuItemId, r]));

  return items.map((item) => {
    const recipe = recipeMap.get(item.id);
    const cost = recipe
      ? Math.round(
          recipe.ingredients.reduce((sum, ing) => sum + Number(ing.quantity) * Number(ing.unitCostSnapshot), 0) * 100
        ) / 100
      : 0;
    const price = Number(item.price);
    const contribution = Math.round((price - cost) * 100) / 100;
    const marginPct = price > 0 ? Math.round((contribution / price) * 1000) / 10 : 0;

    return {
      menuItemId: item.id,
      menuItemName: item.name,
      price,
      cost,
      contribution,
      marginPct,
      hasRecipe: !!recipe,
      recipeVersion: recipe ? recipe.version : null,
    };
  });
}

/**
 * Service charge is 5% of the subtotal in the POS model; the cost side is
 * unaffected. Exported for documentation/menu-engineering use.
 */
export const COSTING_FORMULAS = {
  totalCost: 'Σ(ingredient quantity × unit cost snapshot)',
  contribution: 'selling price − total cost',
  marginPct: 'contribution / selling price × 100',
  serviceChargeFactor: SERVICE_CHARGE_FACTOR,
};
