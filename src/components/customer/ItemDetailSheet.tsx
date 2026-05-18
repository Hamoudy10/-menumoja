'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, Clock, AlertTriangle, Leaf, Flame, Wheat, Milk, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { MenuItem } from '@/types'
import type { ReactNode } from 'react'

interface ItemDetailSheetProps {
  item: MenuItem | null
  open: boolean
  onClose: () => void
}

function formatKES(price: number): string {
  return `KES ${price.toLocaleString('en-KE')}`
}

const categoryEmojis: Record<string, string> = {
  '1': '🍖',
  '2': '🥟',
  '3': '🥤',
}

function getCategoryEmoji(categoryId: string): string {
  return categoryEmojis[categoryId] || '🍽️'
}

const dietaryLabels: Record<string, { icon: ReactNode; color: string; label: string }> = {
  Vegetarian: { icon: <Leaf className="h-4 w-4" />, color: 'bg-green-100 text-green-700', label: 'Vegetarian' },
  Vegan: { icon: <Leaf className="h-4 w-4" />, color: 'bg-green-100 text-green-700', label: 'Vegan' },
  Halal: { icon: <span className="text-sm">🥩</span>, color: 'bg-emerald-100 text-emerald-700', label: 'Halal' },
  Spicy: { icon: <Flame className="h-4 w-4" />, color: 'bg-red-100 text-red-700', label: 'Spicy' },
}

export function ItemDetailSheet({ item, open, onClose }: ItemDetailSheetProps) {
  const { cart, addToCart, updateCartQuantity, language } = useStore()
  const [quantity, setQuantity] = useState(1)
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (open && item) {
      setQuantity(1)
      setSpecialInstructions('')
      setAdded(false)
      const existing = cart.find((c) => c.item.id === item.id)
      if (existing) {
        setQuantity(existing.quantity)
        setSpecialInstructions(existing.specialInstructions)
      }
    }
  }, [open, item, cart])

  if (!item) return null

  const handleAddToOrder = () => {
    const existing = cart.find((c) => c.item.id === item.id)
    if (existing) {
      updateCartQuantity(item.id, quantity)
    } else {
      addToCart(item, specialInstructions)
      if (quantity > 1) updateCartQuantity(item.id, quantity)
    }
    setAdded(true)
    setTimeout(() => onClose(), 800)
  }

  const t = (key: string): string => {
    if (language === 'sw') {
      if (key === 'description') return 'Maelezo'
      if (key === 'ingredients') return 'Viungo'
      if (key === 'allergens') return 'Vizio'
      if (key === 'prep') return 'Muda wa kuandaa'
      if (key === 'instructions') return 'Maagizo maalum'
      if (key === 'placeholder') return 'Andika maagizo yako...'
      if (key === 'add') return 'Ongeza kwenye Agizo'
      if (key === 'added') return 'Imeongezwa!'
      return key
    }
    if (language === 'ar') {
      if (key === 'description') return 'الوصف'
      if (key === 'ingredients') return 'المكونات'
      if (key === 'allergens') return 'مسببات الحساسية'
      if (key === 'prep') return 'وقت التحضير'
      if (key === 'instructions') return 'تعليمات خاصة'
      if (key === 'placeholder') return 'اكتب تعليماتك...'
      if (key === 'add') return 'أضف إلى الطلب'
      if (key === 'added') return 'تمت الإضافة!'
      return key
    }
    if (key === 'description') return 'Description'
    if (key === 'ingredients') return 'Ingredients'
    if (key === 'allergens') return 'Allergens'
    if (key === 'prep') return 'Prep time'
    if (key === 'instructions') return 'Special instructions'
    if (key === 'placeholder') return 'Any allergies or preferences?'
    if (key === 'add') return 'Add to Order'
    if (key === 'added') return 'Added!'
    return key
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="item-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative z-10 w-full rounded-t-3xl bg-white shadow-soft"
            style={{ maxHeight: '92%' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>

            <div className="overflow-y-auto pb-6" style={{ maxHeight: 'calc(92vh - 40px)' }}>
              <div className="relative h-56 overflow-hidden">
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/20 to-accent/20 text-7xl">
                  {getCategoryEmoji(item.categoryId)}
                </div>
                <motion.button
                  onClick={onClose}
                  whileTap={{ scale: 0.9 }}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </motion.button>
                <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
                  {item.dietaryTags.map((tag) => {
                    const dt = dietaryLabels[tag]
                    return dt ? (
                      <span key={tag} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${dt.color}`}>
                        {dt.icon}
                        {dt.label}
                      </span>
                    ) : null
                  })}
                </div>
              </div>

              <div className="px-5 pt-4">
                <div className="flex items-start justify-between">
                  <h2 className="font-heading text-2xl font-bold text-text-primary">{item.name}</h2>
                  <span className="whitespace-nowrap font-heading text-2xl font-bold text-secondary">{formatKES(item.price)}</span>
                </div>

                <div className="mt-4">
                  <h3 className="mb-1 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('description')}</h3>
                  <p className="font-body text-sm leading-relaxed text-text-primary">{item.description}</p>
                </div>

                <div className="mt-4">
                  <h3 className="mb-1 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('ingredients')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.ingredients.map((ing) => (
                      <span key={ing} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-text-secondary">{ing}</span>
                    ))}
                  </div>
                </div>

                {item.allergens.length > 0 && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <h3 className="font-accent text-xs font-semibold uppercase tracking-wider text-red-600">{t('allergens')}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.allergens.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          {allergenIcon(a)}
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-text-secondary" />
                  <span className="font-body text-sm text-text-secondary">
                    {t('prep')}: ~{item.prepTime} min
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="mb-2 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('instructions')}</h3>
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder={t('placeholder')}
                    rows={2}
                    className="w-full resize-none rounded-xl border-2 border-gray-200 bg-white p-3 font-body text-sm text-text-primary placeholder:text-text-secondary/50 transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  />
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-4 rounded-xl bg-gray-50 px-4 py-2">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-soft text-text-primary transition-colors hover:text-secondary"
                    >
                      <Minus className="h-4 w-4" />
                    </motion.button>
                    <motion.span
                      key={quantity}
                      initial={{ scale: 1.3, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="min-w-[24px] text-center font-accent text-lg font-bold text-text-primary"
                    >
                      {quantity}
                    </motion.span>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setQuantity(quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-soft text-text-primary transition-colors hover:text-secondary"
                    >
                      <Plus className="h-4 w-4" />
                    </motion.button>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-text-secondary">Total</p>
                    <p className="font-heading text-xl font-bold text-secondary">
                      {formatKES(item.price * quantity)}
                    </p>
                  </div>
                </div>

                <motion.button
                  onClick={handleAddToOrder}
                  whileTap={{ scale: 0.97 }}
                  animate={added ? { scale: [1, 1.05, 1] } : {}}
                  className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-white transition-all ${
                    added ? 'bg-success' : 'bg-secondary shadow-warm'
                  }`}
                >
                  {added ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-2"
                    >
                      <Check className="h-6 w-6" />
                      {t('added')}
                    </motion.span>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      {t('add')}
                      <span className="opacity-70">• {formatKES(item.price * quantity)}</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function allergenIcon(name: string): ReactNode {
  if (name === 'Gluten') return <Wheat className="h-3.5 w-3.5" />
  if (name === 'Dairy') return <Milk className="h-3.5 w-3.5" />
  return <AlertTriangle className="h-3.5 w-3.5" />
}
