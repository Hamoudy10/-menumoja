import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Image, Sparkles, Library, Edit3, Trash2,
  Clock, Tag, ToggleLeft, ToggleRight, ArrowLeft, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'
import type { MenuCategory, MenuItem } from '@/types'

const dietaryOptions = ['Halal', 'Vegan', 'Vegetarian', 'Spicy', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Organic']

interface Props {
  onNext: () => void
  onPrev: () => void
}

export default function Step3Menu({ onNext, onPrev }: Props) {
  const { onboarding, updateOnboarding, categories } = useStore()
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '')
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const [itemForm, setItemForm] = useState({
    name: '', price: '', description: '', dietaryTags: [] as string[],
    available: true, prepTime: '10', photo: '', photoMethod: '' as '' | 'upload' | 'ai' | 'library',
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const localCategories = onboarding.categories.length > 0 ? onboarding.categories : categories

  const selectedCategory = localCategories.find((c) => c.id === selectedCatId)

  const addCategory = () => {
    if (!newCatName.trim()) return
    const newCat: MenuCategory = {
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      items: [],
      order: localCategories.length,
    }
    updateOnboarding({ categories: [...localCategories, newCat] })
    setNewCatName('')
    setShowNewCat(false)
    setSelectedCatId(newCat.id)
  }

  const removeCategory = (id: string) => {
    const updated = localCategories.filter((c) => c.id !== id)
    updateOnboarding({ categories: updated })
    if (selectedCatId === id) setSelectedCatId(updated[0]?.id || '')
  }

  const resetForm = () => {
    setItemForm({ name: '', price: '', description: '', dietaryTags: [], available: true, prepTime: '10', photo: '', photoMethod: '' })
    setEditingItem(null)
    setShowItemForm(false)
  }

  const addItem = () => {
    if (!itemForm.name.trim() || !itemForm.price || !selectedCatId) return
    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      name: itemForm.name.trim(),
      price: parseFloat(itemForm.price.replace(/,/g, '')),
      description: itemForm.description.trim(),
      photo: itemForm.photo,
      categoryId: selectedCatId,
      dietaryTags: itemForm.dietaryTags,
      prepTime: parseInt(itemForm.prepTime) || 10,
      available: itemForm.available,
      isSpecial: false,
      isPopular: false,
      isNew: true,
      isPromoted: false,
      order: selectedCategory?.items.length || 0,
      ingredients: [],
      allergens: [],
    }
    const updated = localCategories.map((c) =>
      c.id === selectedCatId ? { ...c, items: [...c.items, newItem] } : c
    )
    updateOnboarding({ categories: updated })
    resetForm()
  }

  const saveEdit = () => {
    if (!itemForm.name.trim() || !itemForm.price || !selectedCatId || !editingItem) return
    const updated = localCategories.map((c) =>
      c.id === selectedCatId
        ? {
            ...c,
            items: c.items.map((i) =>
              i.id === editingItem.id
                ? {
                    ...i,
                    name: itemForm.name.trim(),
                    price: parseFloat(itemForm.price.replace(/,/g, '')),
                    description: itemForm.description.trim(),
                    photo: itemForm.photo,
                    dietaryTags: itemForm.dietaryTags,
                    prepTime: parseInt(itemForm.prepTime) || 10,
                    available: itemForm.available,
                  }
                : i
            ),
          }
        : c
    )
    updateOnboarding({ categories: updated })
    resetForm()
  }

  const removeItem = (catId: string, itemId: string) => {
    const updated = localCategories.map((c) =>
      c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c
    )
    updateOnboarding({ categories: updated })
  }

  const editItem = (item: MenuItem) => {
    setEditingItem(item)
    setItemForm({
      name: item.name,
      price: item.price.toLocaleString(),
      description: item.description,
      dietaryTags: [...item.dietaryTags],
      available: item.available,
      prepTime: String(item.prepTime),
      photo: item.photo,
      photoMethod: item.photo ? 'upload' : '',
    })
    setShowItemForm(true)
  }

  const toggleDietaryTag = (tag: string) => {
    setItemForm((prev) => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(tag)
        ? prev.dietaryTags.filter((t) => t !== tag)
        : [...prev.dietaryTags, tag],
    }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setItemForm((prev) => ({ ...prev, photo: ev.target?.result as string, photoMethod: 'upload' }))
      }
      reader.readAsDataURL(file)
    }
  }

  const generateAIPhoto = () => {
    const emojis = ['🍕', '🍔', '🌮', '🥗', '🍝', '🍛', '🍣', '🥩', '🍗', '🥘']
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]
    setItemForm((prev) => ({ ...prev, photo: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${onboarding.brandColor}20" rx="12"/><text x="100" y="130" text-anchor="middle" font-size="60">${emoji}</text></svg>`)}`, photoMethod: 'ai' }))
  }

  const formatPrice = (value: string) => {
    const num = value.replace(/[^\d]/g, '')
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const ItemCard = ({ item, catId }: { item: MenuItem; catId: string }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="group relative bg-white rounded-xl border border-gray-100 shadow-soft p-4 hover:shadow-warm transition-all"
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-secondary/10 to-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
          {item.photo ? (
            <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🍽️</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm text-primary truncate">{item.name}</h4>
              <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">{item.description}</p>
            </div>
            <span className="text-sm font-bold text-secondary whitespace-nowrap">KES {item.price.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {item.dietaryTags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/5 text-secondary font-medium">
                {tag}
              </span>
            ))}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.available ? 'bg-success/10 text-success' : 'bg-red-50 text-red-400'}`}>
              {item.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => editItem(item)}
          className="w-7 h-7 rounded-lg bg-white shadow-soft flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5 text-text-secondary" />
        </button>
        <button
          onClick={() => removeItem(catId, item.id)}
          className="w-7 h-7 rounded-lg bg-white shadow-soft flex items-center justify-center hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </motion.div>
  )

  const totalItems = localCategories.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-heading font-bold text-primary">Build Your Menu</h2>
        <p className="text-text-secondary text-sm mt-1">
          {totalItems} item{totalItems !== 1 ? 's' : ''} across {localCategories.length} categor{localCategories.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      <div className="flex gap-6">
        <div className="w-56 shrink-0 space-y-2">
          <div className="text-xs font-accent font-semibold text-text-secondary uppercase tracking-wider mb-3">Categories</div>
          {localCategories.map((cat) => (
            <motion.button
              key={cat.id}
              layout
              onClick={() => setSelectedCatId(cat.id)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between group ${
                selectedCatId === cat.id
                  ? 'bg-secondary text-white shadow-warm'
                  : 'bg-white text-text-primary hover:bg-gray-50 border border-gray-100'
              }`}
            >
              <span className="truncate">{cat.name}</span>
              <div className="flex items-center gap-1">
                <span className={`text-xs ${selectedCatId === cat.id ? 'text-white/70' : 'text-gray-400'}`}>
                  {cat.items.length}
                </span>
                {selectedCatId !== cat.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCategory(cat.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                )}
              </div>
            </motion.button>
          ))}

          {showNewCat ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name"
                className="flex-1 px-3 py-2 text-sm rounded-xl border-2 border-secondary/30 focus:border-secondary outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                autoFocus
              />
              <button
                onClick={addCategory}
                className="px-3 py-2 bg-secondary text-white rounded-xl text-sm hover:bg-secondary-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCat(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-text-secondary hover:border-secondary/50 hover:text-secondary transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          )}
        </div>

        <div className="flex-1">
          {selectedCategory ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-heading font-bold text-primary">{selectedCategory.name}</h3>
                  <p className="text-xs text-text-secondary">{selectedCategory.items.length} item{selectedCategory.items.length !== 1 ? 's' : ''}</p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => { resetForm(); setShowItemForm(true) }}
                  disabled={showItemForm}
                >
                  Add Item
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {showItemForm ? (
                  <motion.div
                    key="form"
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6 space-y-5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-heading font-bold text-primary">
                        {editingItem ? 'Edit Item' : 'New Item'}
                      </h4>
                      <button onClick={resetForm} className="text-text-secondary hover:text-primary transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">Item Name</label>
                        <input
                          type="text"
                          value={itemForm.name}
                          onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="e.g., Nyama Choma"
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">Price (KES)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-secondary">KES</span>
                          <input
                            type="text"
                            value={itemForm.price}
                            onChange={(e) => setItemForm((p) => ({ ...p, price: formatPrice(e.target.value) }))}
                            placeholder="0"
                            className="w-full pl-14 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">Prep Time (min)</label>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-text-secondary" />
                          <input
                            type="number"
                            value={itemForm.prepTime}
                            onChange={(e) => setItemForm((p) => ({ ...p, prepTime: e.target.value }))}
                            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">Description</label>
                      <div className="relative">
                        <textarea
                          value={itemForm.description}
                          onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Describe this dish..."
                          rows={2}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm resize-none transition-all"
                        />
                        <button
                          onClick={() =>
                            setItemForm((p) => ({
                              ...p,
                              description: `Delicious ${p.name || 'dish'} prepared with fresh ingredients and authentic recipes. A customer favorite!`,
                            }))
                          }
                          className="absolute right-2 bottom-2 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-secondary to-accent text-white rounded-lg text-[10px] font-semibold hover:opacity-90 transition-opacity"
                        >
                          <Sparkles className="w-3 h-3" />
                          Let AI write
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-accent font-semibold text-text-secondary mb-2">Photo</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={() => document.getElementById('menu-photo-upload')?.click()}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            itemForm.photoMethod === 'upload'
                              ? 'border-secondary bg-secondary/5'
                              : 'border-gray-200 hover:border-secondary/50'
                          }`}
                        >
                          <Image className="w-6 h-6 mx-auto mb-1 text-text-secondary" />
                          <span className="text-[10px] font-medium text-text-secondary">Upload</span>
                        </button>
                        <input
                          id="menu-photo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                        <button
                          onClick={generateAIPhoto}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            itemForm.photoMethod === 'ai'
                              ? 'border-secondary bg-secondary/5'
                              : 'border-gray-200 hover:border-secondary/50'
                          }`}
                        >
                          <Sparkles className="w-6 h-6 mx-auto mb-1 text-accent" />
                          <span className="text-[10px] font-medium text-text-secondary">Generate AI</span>
                        </button>
                        <button
                          className="p-4 rounded-xl border-2 border-gray-200 hover:border-secondary/50 text-center transition-all"
                        >
                          <Library className="w-6 h-6 mx-auto mb-1 text-text-secondary" />
                          <span className="text-[10px] font-medium text-text-secondary">Pick Library</span>
                        </button>
                      </div>
                      {itemForm.photo && (
                        <div className="mt-2 flex items-center gap-2">
                          <img src={itemForm.photo} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                          <span className="text-xs text-success">Photo added</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-accent font-semibold text-text-secondary mb-2">Dietary Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {dietaryOptions.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => toggleDietaryTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              itemForm.dietaryTags.includes(tag)
                                ? 'bg-secondary text-white shadow-warm'
                                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
                      <span className="text-sm font-medium text-primary">Available</span>
                      <button
                        onClick={() => setItemForm((p) => ({ ...p, available: !p.available }))}
                        className={`w-12 h-6 rounded-full transition-all relative ${
                          itemForm.available ? 'bg-success' : 'bg-gray-300'
                        }`}
                      >
                        <motion.div
                          animate={{ x: itemForm.available ? 24 : 2 }}
                          className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-soft"
                        />
                      </button>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="ghost" size="sm" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={editingItem ? saveEdit : addItem}
                        disabled={!itemForm.name.trim() || !itemForm.price}
                      >
                        {editingItem ? 'Save Changes' : 'Add to Menu'}
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="list" className="space-y-3">
                    {selectedCategory.items.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-4xl mb-3">🍽️</div>
                        <p className="text-text-secondary text-sm">No items in this category yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Add Item" to get started</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {selectedCategory.items.map((item) => (
                          <ItemCard key={item.id} item={item} catId={selectedCatId} />
                        ))}
                      </AnimatePresence>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-text-secondary text-sm">Select a category or create one</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={onPrev} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          disabled={totalItems === 0}
        >
          Continue ({totalItems} items)
        </Button>
      </div>
    </div>
  )
}
