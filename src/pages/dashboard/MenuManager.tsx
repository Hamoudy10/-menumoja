import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, Grid3X3, List, Image, X, Check, Search,
  Edit3, Trash2, Eye, EyeOff, GripVertical, Tag,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchBar } from '@/components/ui/SearchBar'
import { showSuccessToast } from '@/components/ui/Toast'
import type { MenuCategory, MenuItem } from '@/types'

const defaultItem = (categoryId: string, order: number): Partial<MenuItem> => ({
  name: '', price: 0, description: '', photo: '', categoryId,
  dietaryTags: [], prepTime: 10, available: true, isSpecial: false, isPopular: false,
  isNew: true, isPromoted: false, order, ingredients: [], allergens: [],
})

export default function MenuManager() {
  const { categories, addCategory, updateCategory, removeCategory, addItem, updateItem, removeItem } = useStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCat, setSelectedCat] = useState('')

  useEffect(() => {
    if (categories.length > 0 && !selectedCat) {
      setSelectedCat(categories[0].id)
    }
  }, [categories, selectedCat])

  useEffect(() => {
    setCategoriesOrder(categories)
  }, [categories])

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [categoriesOrder, setCategoriesOrder] = useState(categories)

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    addCategory({ name: newCatName.trim(), isActive: true })
    setNewCatName('')
    setShowAddCat(false)
  }

  const handleDeleteItem = (catId: string, itemId: string) => {
    removeItem(catId, itemId)
    showSuccessToast('Item removed')
    setEditingItem(null)
  }

  const handleToggleAvailable = (catId: string, item: MenuItem) => {
    updateItem(catId, item.id, { available: !item.available })
  }

  const handleBulkDelete = () => {
    selectedItems.forEach((id) => {
      const cat = categories.find((c) => c.items.some((i) => i.id === id))
      if (cat) removeItem(cat.id, id)
    })
    setSelectedItems([])
    showSuccessToast(`${selectedItems.length} items deleted`)
  }

  const currentCat = categories.find((c) => c.id === selectedCat)
  const filteredItems = (currentCat?.items || []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Menu Manager</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Manage your categories and items</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={viewMode === 'grid' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />} onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            {viewMode === 'grid' ? 'Grid' : 'List'}
          </Button>
        </div>
      </div>

      {selectedItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl bg-secondary/10 border border-secondary/20 p-3">
          <span className="font-accent text-sm text-secondary font-medium">{selectedItems.length} selected</span>
          <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-500/10" onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])}>
            Clear
          </Button>
        </motion.div>
      )}

      <div className="flex gap-6">
        <div className="w-64 shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <SearchBar placeholder="Search items..." value={search} onChange={setSearch} className="flex-1" />
          </div>

          <div className="space-y-1">
            <Reorder.Group axis="y" values={categoriesOrder} onReorder={setCategoriesOrder}>
              {categoriesOrder.map((cat) => (
                <Reorder.Item key={cat.id} value={cat} as="div">
                  <motion.button
                    onClick={() => setSelectedCat(cat.id)}
                    whileTap={{ scale: 0.98 }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-accent font-medium transition-colors ${
                      selectedCat === cat.id
                        ? 'bg-secondary text-white'
                        : 'text-text-secondary dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    <Tag className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1 text-left">{cat.name}</span>
                    <Badge size="sm" variant="default">{(cat.items || []).length}</Badge>
                  </motion.button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>

          <AnimatePresence>
            {showAddCat ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="space-y-2 rounded-xl border border-white/10 p-3 bg-white dark:bg-primary-light">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Category name"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddCategory}><Check className="h-3.5 w-3.5" /> Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddCat(false)}>Cancel</Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <Button variant="ghost" size="sm" fullWidth onClick={() => setShowAddCat(true)}>
                <Plus className="h-4 w-4" /> Add Category
              </Button>
            )}
          </AnimatePresence>

          {categories.length > 0 && (
            <Button variant="ghost" size="sm" fullWidth onClick={() => {
              const last = categories[categories.length - 1]
              const newItem = defaultItem(last.id, last.items.length)
              addItem(last.id, newItem)
              showSuccessToast('Item added')
            }}>
              <Plus className="h-4 w-4" /> Quick Add Item
            </Button>
          )}
        </div>

        <div className="flex-1">
          {!currentCat ? (
            <EmptyState
              icon={<Tag className="h-12 w-12" />}
              title="No category selected"
              description="Select a category or create one to start managing your menu"
              actionLabel="Create Category"
              onAction={() => setShowAddCat(true)}
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Image className="h-12 w-12" />}
              title="No items yet"
              description="Add your first menu item"
              actionLabel="Add Item"
              onAction={() => {
                const newItem = defaultItem(currentCat.id, currentCat.items.length)
                addItem(currentCat.id, newItem)
              }}
            />
          ) : (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'space-y-2'
            }>
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`group relative rounded-2xl border border-white/10 bg-white dark:bg-primary-light overflow-hidden transition-all hover:shadow-soft ${
                    viewMode === 'list' ? 'flex items-center gap-4 p-3' : ''
                  } ${!item.available ? 'opacity-60' : ''}`}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div className="aspect-[4/3] bg-gradient-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 flex items-center justify-center">
                        {item.photo ? (
                          <img src={item.photo} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <Image className="h-8 w-8 text-text-secondary/30" />
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-body text-sm font-semibold text-text-primary dark:text-white">{item.name || 'New Item'}</h3>
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedItems([...selectedItems, item.id])
                                else setSelectedItems(selectedItems.filter((id) => id !== item.id))
                              }}
                              className="rounded border-gray-300 text-secondary focus:ring-secondary"
                            />
                          </div>
                        </div>
                        <p className="font-accent text-sm font-bold text-secondary">KES {item.price.toLocaleString()}</p>
                        <div className="flex items-center gap-1 mt-2">
                          {(item.dietaryTags || []).slice(0, 2).map((tag) => (
                            <Badge key={tag} size="sm" variant="info">{tag}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingItem(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <Edit3 className="h-3.5 w-3.5 text-text-secondary" />
                          </button>
                          <button onClick={() => handleToggleAvailable(currentCat.id, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            {item.available ? <EyeOff className="h-3.5 w-3.5 text-text-secondary" /> : <Eye className="h-3.5 w-3.5 text-success" />}
                          </button>
                          <button onClick={() => handleDeleteItem(currentCat.id, item.id)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedItems([...selectedItems, item.id])
                            else setSelectedItems(selectedItems.filter((id) => id !== item.id))
                          }}
                          className="rounded border-gray-300 text-secondary focus:ring-secondary"
                        />
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 flex items-center justify-center">
                          <Image className="h-5 w-5 text-text-secondary/30" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-medium text-text-primary dark:text-white truncate">{item.name || 'New Item'}</p>
                          <p className="font-accent text-xs text-text-secondary">KES {item.price.toLocaleString()} · {item.prepTime}min</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.available ? <Badge variant="success" size="sm">Active</Badge> : <Badge variant="danger" size="sm">Hidden</Badge>}
                        <button onClick={() => setEditingItem(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                          <Edit3 className="h-3.5 w-3.5 text-text-secondary" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (!currentCat) return
              const newItem = defaultItem(currentCat.id, currentCat.items.length)
              addItem(currentCat.id, newItem)
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 p-6 text-text-secondary hover:border-secondary/50 hover:text-secondary transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="font-accent font-medium">Add Menu Item</span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {editingItem && currentCat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditingItem(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white dark:bg-primary-light border-l border-white/10 shadow-soft overflow-y-auto"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white dark:bg-primary-light p-4">
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">
                  {editingItem.name || 'New Item'}
                </h2>
                <button onClick={() => setEditingItem(null)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                  <X className="h-5 w-5 text-text-secondary" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <Input label="Item Name" value={editingItem.name} onChange={(e) => updateItem(currentCat.id, editingItem.id, { name: e.target.value })} />
                <Input label="Price (KES)" type="number" value={editingItem.price || ''} onChange={(e) => updateItem(currentCat.id, editingItem.id, { price: parseInt(e.target.value) || 0 })} />

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Photo URL</label>
                  <div className="flex gap-2">
                    <Input value={editingItem.photo || ''} onChange={(e) => updateItem(currentCat.id, editingItem.id, { photo: e.target.value })} placeholder="https://example.com/food.jpg" className="flex-1" />
                  </div>
                  {editingItem.photo && (
                    <div className="mt-2 h-24 w-24 rounded-xl overflow-hidden bg-black/5 dark:bg-white/10">
                      <img src={editingItem.photo} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Description</label>
                  <div className="flex gap-2 mb-2">
                    <textarea
                      value={editingItem.description}
                      onChange={(e) => updateItem(currentCat.id, editingItem.id, { description: e.target.value })}
                      className="flex-1 rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      rows={3}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { generateDescription } = await import('@/api/ai')
                        const data = await generateDescription({ itemName: editingItem.name || 'dish', ingredients: editingItem.ingredients || [], style: 'appetizing' })
                        const desc = data.description || data.text || 'A delicious dish prepared with fresh ingredients.'
                        updateItem(currentCat.id, editingItem.id, { description: desc })
                        showSuccessToast('AI description generated')
                      } catch {
                        updateItem(currentCat.id, editingItem.id, { description: 'A delicious dish prepared with fresh ingredients, combining traditional flavors with modern presentation.' })
                        showSuccessToast('AI description generated')
                      }
                    }}
                    className="text-xs font-accent font-medium text-secondary hover:text-secondary-dark transition-colors"
                  >
                    ✨ Write with AI
                  </button>
                </div>

                <Input label="Prep Time (min)" type="number" value={editingItem.prepTime || ''} onChange={(e) => updateItem(currentCat.id, editingItem.id, { prepTime: parseInt(e.target.value) || 10 })} />

                <div className="space-y-3">
                  <label className="block font-accent text-sm font-medium text-text-primary dark:text-white/90">Status</label>
                  <div className="flex items-center gap-4">
                    {(['available', 'isSpecial', 'isPopular', 'isNew'] as const).map((flag) => (
                      <label key={flag} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingItem[flag] as boolean}
                          onChange={(e) => updateItem(currentCat.id, editingItem.id, { [flag]: e.target.checked })}
                          className="rounded border-gray-300 text-secondary focus:ring-secondary"
                        />
                        <span className="font-body text-sm text-text-primary dark:text-white/80">
                          {flag === 'available' ? 'Available' : flag === 'isSpecial' ? 'Special' : flag === 'isPopular' ? 'Popular' : 'New'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Dietary Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {['Halal', 'Vegetarian', 'Vegan', 'Spicy', 'Gluten-Free'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const currentTags = editingItem.dietaryTags || []
                          const tags = currentTags.includes(tag)
                            ? currentTags.filter((t) => t !== tag)
                            : [...currentTags, tag]
                          updateItem(currentCat.id, editingItem.id, { dietaryTags: tags })
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-accent font-medium transition-colors ${
                          (editingItem.dietaryTags || []).includes(tag)
                            ? 'bg-secondary text-white'
                            : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/20'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <Button fullWidth onClick={() => setEditingItem(null)}>
                    <Check className="h-4 w-4" /> Done
                  </Button>
                  <Button variant="ghost" fullWidth className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => handleDeleteItem(currentCat.id, editingItem.id)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
