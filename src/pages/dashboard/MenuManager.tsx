import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, Grid3X3, List, Image, X, Check, Search,
  Edit3, Trash2, Eye, EyeOff, GripVertical, Tag, Sparkles, RefreshCw,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const { categories, fetchCategories, addCategory, updateCategory, removeCategory, addItem, updateItem, removeItem } = useStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCat, setSelectedCat] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (categories.length > 0 && !selectedCat) {
      setSelectedCat(categories[0].id)
    }
  }, [categories, selectedCat])

  useEffect(() => {
    setCategoriesOrder(categories)
  }, [categories])

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editForm, setEditForm] = useState<Partial<MenuItem>>({})
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [categoriesOrder, setCategoriesOrder] = useState(categories)
  const [reordering, setReordering] = useState(false)

  const [aiContext, setAiContext] = useState('')
  const [showAiOptions, setShowAiOptions] = useState(false)
  const [aiOptions, setAiOptions] = useState<Array<{ id: string; description: string; descriptionSw: string }>>([])
  const [generatingOptions, setGeneratingOptions] = useState(false)

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    addCategory({ name: newCatName.trim(), isActive: true })
    setNewCatName('')
    setShowAddCat(false)
  }

  const handleDeleteItem = (catId: string, itemId: string) => {
    removeItem(catId, itemId)
    showSuccessToast(t('menu.itemDeleted'))
    setEditingItem(null)
  }

  const handleToggleAvailable = (catId: string, item: MenuItem) => {
    updateItem(catId, item.id, { available: !item.available })
  }

  const handleBulkDelete = async () => {
    let deleted = 0
    for (const id of selectedItems) {
      const cat = categories.find((c) => c.items.some((i) => i.id === id))
      if (cat) {
        try {
          await removeItem(cat.id, id)
          deleted++
        } catch {}
      }
    }
    setSelectedItems([])
    if (deleted > 0) showSuccessToast(`${deleted} items deleted`)
  }

  const generateAIDescription = async (generateOptionsFlag = false) => {
    if (!editForm.name) {
      showSuccessToast('Please enter an item name first')
      return
    }

    if (generateOptionsFlag) {
      setGeneratingOptions(true)
      try {
        const { generateDescription } = await import('@/api/ai')
        const data = await generateDescription({
          itemName: editForm.name,
          keywords: editForm.ingredients || [],
          tone: 'appetizing',
          userContext: aiContext || undefined,
          generateOptions: true,
          optionCount: 3,
        })

        if (data.options) {
          setAiOptions(data.options)
          setShowAiOptions(true)
        }
        showSuccessToast(t('menu.aiGenerated'))
      } catch {
        const fallbacks = [
          { description: `Delicious ${editForm.name} prepared with fresh ingredients and authentic flavors.`, descriptionSw: `${editForm.name} tamu iliyotayarishwa kwa viungo safi.` },
          { description: `Savor our ${editForm.name} - a perfect blend of traditional recipes and modern presentation.`, descriptionSw: `Furahia ${editForm.name} - mchanganyiko kamili wa mapishi ya asili.` },
          { description: `Experience the rich flavors of ${editForm.name}, crafted with care and the finest ingredients.`, descriptionSw: `Pata ladha nzuri ya ${editForm.name}, iliyotengenezwa kwa uangalifu.` },
        ]
        setAiOptions(fallbacks.map((f, i) => ({ id: `option-${i + 1}`, ...f })))
        setShowAiOptions(true)
        showSuccessToast(t('menu.aiGenerated'))
      } finally {
        setGeneratingOptions(false)
      }
    } else {
      try {
        const { generateDescription } = await import('@/api/ai')
        const data = await generateDescription({
          itemName: editForm.name,
          keywords: editForm.ingredients || [],
          style: 'appetizing',
          userContext: aiContext || undefined,
          generateOptions: false,
        })
        const desc = data.description || data.text || `A delicious ${editForm.name} prepared with fresh ingredients.`
        setEditForm({ ...editForm, description: desc })
        showSuccessToast(t('menu.aiGenerated'))
      } catch {
        setEditForm({
          ...editForm,
          description: `A delicious ${editForm.name} prepared with fresh ingredients, combining traditional flavors with modern presentation.`
        })
        showSuccessToast(t('menu.aiGenerated'))
      }
    }
  }

  const currentCat = categories.find((c) => c.id === selectedCat)
  const filteredItems = (currentCat?.items || []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">{t('menu.title')}</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">{t('menu.subtitle')}</p>
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
            <Trash2 className="h-3.5 w-3.5" /> {t('common.bulkDelete')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])}>
            {t('common.clear')}
          </Button>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-64 shrink-0 space-y-3">
          <SearchBar placeholder={t('app.search') + '...'} value={search} onChange={setSearch} className="flex-1" />

          <div className="space-y-1">
            <Reorder.Group axis="y" values={categoriesOrder} onReorder={async (newOrder) => {
              setCategoriesOrder(newOrder)
              setReordering(true)
              try {
                const { reorderCategories } = await import('@/api/menu')
                await reorderCategories(newOrder.map((cat: any, i: number) => ({ id: cat.id, sortOrder: i })))
              } catch {}
              setReordering(false)
            }}>
              {categoriesOrder.map((cat) => (
                <Reorder.Item key={cat.id} value={cat} as="div">
                  <div
                    className={`flex w-full items-center gap-1 rounded-xl px-3 py-2 text-sm font-accent font-medium transition-colors ${
                      selectedCat === cat.id
                        ? 'bg-secondary text-white'
                        : 'text-text-secondary dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    <button onClick={() => setSelectedCat(cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      <Tag className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{cat.name}</span>
                      <Badge size="sm" variant="default">{(cat.items || []).length}</Badge>
                    </button>
                    {selectedCat === cat.id && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const newName = prompt('Category name:', cat.name)
                            if (newName && newName.trim() && newName !== cat.name) {
                              updateCategory(cat.id, { name: newName.trim() })
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Delete category "${cat.name}"?`)) {
                              removeCategory(cat.id)
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
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
                    placeholder={t('menu.categoryName')}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddCategory}><Check className="h-3.5 w-3.5" /> {t('menu.addCategory')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddCat(false)}>{t('app.cancel')}</Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <Button variant="ghost" size="sm" fullWidth onClick={() => setShowAddCat(true)}>
                <Plus className="h-4 w-4" /> {t('menu.addCategory')}
              </Button>
            )}
          </AnimatePresence>

          {categories.length > 0 && (
            <Button variant="ghost" size="sm" fullWidth onClick={async () => {
              const last = categories[categories.length - 1]
              const newItem = defaultItem(last.id, last.items.length)
              const created = await addItem(last.id, newItem)
              if (created) {
                setEditingItem(created)
                setEditForm({ ...created })
              }
              showSuccessToast(t('menu.itemAdded'))
            }}>
              <Plus className="h-4 w-4" /> {t('menu.quickAdd')}
            </Button>
          )}
        </div>

        <div className="flex-1">
          {!currentCat ? (
            <EmptyState
              icon={<Tag className="h-12 w-12" />}
              title={t('menu.noCategory')}
              description={t('menu.noCategoryDesc')}
              actionLabel={t('menu.createCategory')}
              onAction={() => setShowAddCat(true)}
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Image className="h-12 w-12" />}
              title={t('menu.noItems')}
              description={t('menu.noItemsDesc')}
              actionLabel={t('menu.addItem')}
              onAction={async () => {
                const newItem = defaultItem(currentCat.id, currentCat.items.length)
                await addItem(currentCat.id, newItem)
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
                        {item.description && (
                          <p className="font-body text-xs text-text-secondary dark:text-white/60 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-2">
                          {(item.dietaryTags || []).slice(0, 2).map((tag) => (
                            <Badge key={tag} size="sm" variant="info">{tag}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingItem(item); setEditForm({ ...item }) }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
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
                        <button onClick={() => { setEditingItem(item); setEditForm({ ...item }) }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
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
            onClick={async () => {
              if (!currentCat) return
              const newItem = defaultItem(currentCat.id, currentCat.items.length)
              const created = await addItem(currentCat.id, newItem)
              if (created) {
                setEditingItem(created)
                setEditForm({ ...created })
              }
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 p-6 text-text-secondary hover:border-secondary/50 hover:text-secondary transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span className="font-accent font-medium">{t('menu.addItem')}</span>
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
              onClick={() => { setEditingItem(null); setShowAiOptions(false) }}
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
                <button onClick={() => { setEditingItem(null); setShowAiOptions(false) }} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                  <X className="h-5 w-5 text-text-secondary" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <Input label={t('menu.itemName')} value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <Input label={t('menu.price')} type="number" value={editForm.price ?? ''} onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} />

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('menu.photo')}</label>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader()
                        reader.onload = (ev) => setEditForm({ ...editForm, photo: ev.target?.result as string })
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="relative rounded-xl border-2 border-dashed border-white/20 p-4 text-center hover:border-secondary/50 transition-colors cursor-pointer"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = () => {
                        const file = input.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (ev) => setEditForm({ ...editForm, photo: ev.target?.result as string })
                          reader.readAsDataURL(file)
                        }
                      }
                      input.click()
                    }}
                  >
                    {editForm.photo ? (
                      <div className="relative">
                        <img src={editForm.photo} alt="" className="mx-auto h-32 w-32 rounded-xl object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '' }} />
                        <p className="mt-2 text-xs text-text-secondary dark:text-white/50">Drop new image or click to change</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Image className="mx-auto h-8 w-8 text-text-secondary/40" />
                        <p className="mt-2 text-sm font-accent text-text-secondary dark:text-white/60">Drop an image here or click to browse</p>
                        <p className="mt-1 text-xs text-text-secondary/40">You can also paste a URL below</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input value={editForm.photo || ''} onChange={(e) => setEditForm({ ...editForm, photo: e.target.value })} placeholder="Or paste image URL..." className="flex-1" />
                    <button
                      onClick={async () => {
                        showSuccessToast('AI image generation...')
                      }}
                      className="shrink-0 rounded-xl bg-gradient-to-br from-secondary to-accent px-3 py-2 text-xs font-accent font-medium text-white hover:opacity-90 transition-opacity"
                      title="Generate image with AI"
                    >
                      AI
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('menu.description')}</label>
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    rows={3}
                  />
                </div>

                <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3 space-y-3">
                  <label className="font-accent text-sm font-medium text-text-primary dark:text-white/90 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-secondary" />
                    {t('menu.aiContext')}
                  </label>
                  <textarea
                    value={aiContext}
                    onChange={(e) => setAiContext(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-body text-text-primary dark:text-white placeholder:text-text-secondary/50 focus:border-secondary focus:outline-none"
                    rows={2}
                    placeholder={t('menu.writeContextPlaceholder')}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateAIDescription(false)}
                      className="flex-1 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 px-3 py-2 text-xs font-accent font-medium transition-colors"
                    >
                      <RefreshCw className="h-3 w-3 inline mr-1" />
                      {t('menu.writeWithAI')}
                    </button>
                    <button
                      onClick={() => generateAIDescription(true)}
                      disabled={generatingOptions}
                      className="flex-1 rounded-lg bg-gradient-to-br from-secondary to-accent text-white px-3 py-2 text-xs font-accent font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {generatingOptions ? 'Generating...' : `${t('menu.generateOptions')} (3)`}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showAiOptions && aiOptions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-xl border border-secondary/30 bg-secondary/5 p-3 space-y-2"
                    >
                      <p className="font-accent text-xs font-medium text-secondary">{t('menu.chooseOption')}</p>
                      {aiOptions.map((opt, i) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setEditForm({ ...editForm, description: opt.description })
                            setShowAiOptions(false)
                          }}
                          className="w-full rounded-lg border border-white/10 bg-white dark:bg-primary-light p-2.5 text-left hover:border-secondary/50 transition-colors"
                        >
                          <span className="font-accent text-[10px] text-secondary font-medium">{t('menu.option')} {i + 1}</span>
                          <p className="font-body text-xs text-text-primary dark:text-white/80 mt-0.5">{opt.description}</p>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Input label={t('menu.prepTime')} type="number" value={editForm.prepTime ?? 10} onChange={(e) => setEditForm({ ...editForm, prepTime: parseInt(e.target.value) || 10 })} />

                <div className="space-y-3">
                  <label className="block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('menu.available')}</label>
                  <div className="flex items-center gap-4">
                    {(['available', 'isSpecial', 'isPopular', 'isNew'] as const).map((flag) => (
                      <label key={flag} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!(editForm as any)[flag]}
                          onChange={(e) => setEditForm({ ...editForm, [flag]: e.target.checked })}
                          className="rounded border-gray-300 text-secondary focus:ring-secondary"
                        />
                        <span className="font-body text-sm text-text-primary dark:text-white/80">{t(`menu.${flag === 'isSpecial' ? 'special' : flag === 'isPopular' ? 'popular' : flag === 'isNew' ? 'new' : 'available'}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('menu.dietaryTags')}</label>
                  <div className="flex flex-wrap gap-2">
                    {['Halal', 'Vegetarian', 'Vegan', 'Spicy', 'Gluten-Free'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          const currentTags = editForm.dietaryTags || []
                          const tags = currentTags.includes(tag)
                            ? currentTags.filter((t) => t !== tag)
                            : [...currentTags, tag]
                          setEditForm({ ...editForm, dietaryTags: tags })
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-accent font-medium transition-colors ${
                          (editForm.dietaryTags || []).includes(tag)
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
                  <Button fullWidth onClick={async () => {
                    if (!currentCat) return
                    if (editingItem && editForm.name) {
                      await updateItem(currentCat.id, editingItem.id, {
                        name: editForm.name, price: editForm.price, description: editForm.description,
                        photo: editForm.photo, dietaryTags: editForm.dietaryTags || [],
                        prepTime: editForm.prepTime, available: editForm.available !== false,
                        isSpecial: !!editForm.isSpecial, isPopular: !!editForm.isPopular,
                        isNew: editForm.isNew !== false, isPromoted: !!editForm.isPromoted,
                        ingredients: editForm.ingredients || [], allergens: editForm.allergens || [],
                      })
                    }
                    setEditingItem(null)
                    showSuccessToast(t('menu.itemUpdated'))
                  }}>
                    <Check className="h-4 w-4" /> {t('app.done')}
                  </Button>
                  <Button variant="ghost" fullWidth className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => {
                    if (currentCat && editingItem) handleDeleteItem(currentCat.id, editingItem.id)
                  }}>
                    <Trash2 className="h-4 w-4" /> {t('app.delete')}
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
