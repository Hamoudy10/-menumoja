import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Plus, Trash2, X, RefreshCw, BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as recipesApi from '@/api/recipes'
import * as inventoryApi from '@/api/inventory'

export default function RecipesPage() {
  const [loading, setLoading] = useState(true)
  const [costings, setCostings] = useState<any[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])

  const [selected, setSelected] = useState<any | null>(null) // costing row
  const [recipe, setRecipe] = useState<any | null>(null) // active recipe
  const [versions, setVersions] = useState<any[]>([])
  const [showEditor, setShowEditor] = useState(false)
  const [ingredients, setIngredients] = useState<{ inventoryItemId: string; quantity: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [recipeName, setRecipeName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, invRes] = await Promise.all([
        recipesApi.fetchRecipeStatus(),
        inventoryApi.fetchInventoryItems(),
      ])
      setCostings(Array.isArray(statusRes) ? statusRes : [])
      setInventoryItems(Array.isArray(invRes) ? invRes : [])
    } catch { showErrorToast('Failed to load recipes') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openItem = async (row: any) => {
    setSelected(row)
    try {
      const [recipeRes, versionRes] = await Promise.all([
        recipesApi.getItemRecipe(row.menuItemId),
        recipesApi.getRecipeVersions(row.menuItemId),
      ])
      setRecipe(recipeRes?.recipe || null)
      setVersions(Array.isArray(versionRes) ? versionRes : [])
    } catch { showErrorToast('Failed to load recipe') }
  }

  const openEditor = () => {
    setRecipeName(selected?.menuItemName || '')
    const current = recipe?.ingredients || []
    setIngredients(current.length > 0
      ? current.map((ing: any) => ({ inventoryItemId: ing.inventoryItemId, quantity: String(ing.quantity) }))
      : [{ inventoryItemId: '', quantity: '' }])
    setShowEditor(true)
  }

  const liveCostPreview = ingredients.reduce((sum, row) => {
    if (!row.inventoryItemId || !row.quantity) return sum
    const item = inventoryItems.find((i) => i.id === row.inventoryItemId)
    if (!item) return sum
    const unitCost = Number(item.lastUnitCost || 0)
    return sum + Number(row.quantity) * unitCost
  }, 0)

  const handleSave = async () => {
    const valid = ingredients.filter((r) => r.inventoryItemId && Number(r.quantity) > 0)
    if (valid.length === 0) { showErrorToast('Add at least one ingredient with a quantity'); return }
    if (!selected) return
    setSaving(true)
    try {
      const payload = { name: recipeName.trim() || undefined, ingredients: valid.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity) })) }
      if (recipe) {
        await recipesApi.updateRecipe(selected.menuItemId, payload)
        showSuccessToast('New recipe version saved')
      } else {
        await recipesApi.createRecipe({ menuItemId: selected.menuItemId, ...payload })
        showSuccessToast('Recipe created')
      }
      setShowEditor(false)
      await openItem(selected)
      load()
    } catch { showErrorToast('Failed to save recipe') }
    finally { setSaving(false) }
  }

  const marginColor = (m: number) => (m >= 40 ? 'text-success' : m >= 20 ? 'text-amber-500' : 'text-red-500')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Recipes & Food Costing</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Link menu items to inventory ingredients, see costs and margins</p>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" className="h-32" />)}
        </div>
      ) : costings.length === 0 ? (
        <EmptyState icon={<ChefHat className="h-10 w-10" />} title="No menu items" description="Add menu items first, then link them to recipes" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {costings.map((row) => (
            <button
              key={row.menuItemId}
              onClick={() => openItem(row)}
              className={`text-left rounded-2xl bg-white dark:bg-primary-light border p-4 transition-colors hover:border-secondary/50 ${
                selected?.menuItemId === row.menuItemId ? 'border-secondary' : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-heading font-bold text-text-primary dark:text-white truncate">{row.menuItemName}</p>
                {row.hasRecipe ? <Badge variant="success" size="sm">v{row.recipeVersion}</Badge> : <Badge variant="default" size="sm">No recipe</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2">
                  <p className="font-accent text-[10px] text-text-secondary uppercase">Price</p>
                  <p className="font-heading text-sm font-bold text-text-primary dark:text-white">KES {Number(row.price || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2">
                  <p className="font-accent text-[10px] text-text-secondary uppercase">Cost</p>
                  <p className="font-heading text-sm font-bold text-text-primary dark:text-white">KES {Number(row.cost || 0).toLocaleString()}</p>
                </div>
                <div className={`rounded-lg p-2 ${Number(row.marginPct || 0) >= 40 ? 'bg-success/10' : Number(row.marginPct || 0) >= 20 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                  <p className="font-accent text-[10px] text-text-secondary uppercase">Margin</p>
                  <p className={`font-heading text-sm font-bold ${marginColor(Number(row.marginPct || 0))}`}>{Number(row.marginPct || 0)}%</p>
                </div>
              </div>
              {row.contribution > 0 && (
                <p className="text-[11px] text-text-secondary mt-2">Contribution: KES {Number(row.contribution).toLocaleString()} per unit</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Detail + editor */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">{selected.menuItemName}</h2>
                <p className="text-xs text-text-secondary">
                  Selling price KES {Number(selected.price).toLocaleString()} · Cost KES {Number(selected.cost).toLocaleString()} · Contribution KES {Number(selected.contribution).toLocaleString()} · Margin {selected.marginPct}%
                </p>
              </div>
              <Button size="sm" onClick={openEditor}>
                <Plus className="h-3.5 w-3.5" /> {recipe ? 'New Version' : 'Create Recipe'}
              </Button>
            </div>

            {recipe ? (
              <div className="mt-4">
                <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2">Active recipe v{recipe.version} · {recipe.ingredients.length} ingredient(s)</p>
                <div className="space-y-1.5">
                  {recipe.ingredients.map((ing: any) => (
                    <div key={ing.id} className="flex items-center justify-between text-sm py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                      <span className="text-text-primary dark:text-white">{ing.inventoryItem?.name || 'Ingredient'}</span>
                      <span className="font-accent text-text-secondary">
                        {Number(ing.quantity)} {ing.inventoryItem?.unit?.toLowerCase()} × KES {Number(ing.unitCostSnapshot)} = <span className="text-text-primary font-bold">KES {Math.round(Number(ing.quantity) * Number(ing.unitCostSnapshot) * 100) / 100}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {versions.length > 1 && (
                  <p className="text-[11px] text-text-secondary mt-3">
                    <BookOpen className="h-3 w-3 inline mr-1" /> {versions.length} versions preserved (v1..v{versions.length}) — historical costs are never rewritten.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-secondary mt-4">No recipe yet — create one to start tracking ingredient costs.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor modal */}
      {showEditor && selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowEditor(false)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-lg shadow-soft border border-white/10 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-lg text-text-primary dark:text-white">
                  {recipe ? `New version for ${selected.menuItemName}` : `Recipe for ${selected.menuItemName}`}
                </h3>
                <button onClick={() => setShowEditor(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <Input label="Recipe name" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder={selected.menuItemName} />
                {ingredients.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_90px_32px] gap-2 items-end">
                    <Select
                      options={[{ value: '', label: 'Select ingredient…' }, ...inventoryItems.map((i) => ({ value: i.id, label: `${i.name} (KES ${Number(i.lastUnitCost || 0)})` }))]}
                      value={row.inventoryItemId}
                      onChange={(e) => setIngredients(ingredients.map((r, i) => i === idx ? { ...r, inventoryItemId: e.target.value } : r))}
                    />
                    <Input type="number" placeholder="Qty" value={row.quantity} onChange={(e) => setIngredients(ingredients.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} />
                    <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setIngredients([...ingredients, { inventoryItemId: '', quantity: '' }])}>
                  <Plus className="h-3.5 w-3.5" /> Add Ingredient
                </Button>
                <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                  <p className="text-sm text-text-secondary">Cost is captured server-side from purchase history when you save (historical versions are never rewritten).</p>
                  <p className="font-heading font-bold text-text-primary dark:text-white mt-1">Estimated cost: KES {Math.round(liveCostPreview * 100) / 100}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button fullWidth loading={saving} onClick={handleSave}>{recipe ? 'Save New Version' : 'Create Recipe'}</Button>
                  <Button variant="ghost" onClick={() => setShowEditor(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
