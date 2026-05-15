'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal, Leaf, Vegan, Flame, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import type { MenuItem } from '@/types'
import type { ReactNode } from 'react'

interface SearchFilterProps {
  items: MenuItem[]
  onFilteredItems: (items: MenuItem[]) => void
}

type DietaryFilter = 'Vegetarian' | 'Vegan' | 'Halal' | 'Spicy'

const dietaryOptions: { key: DietaryFilter; icon: ReactNode; label: string }[] = [
  { key: 'Vegetarian', icon: <Leaf className="h-4 w-4" />, label: 'Vegetarian' },
  { key: 'Vegan', icon: <Vegan className="h-4 w-4" />, label: 'Vegan' },
  { key: 'Halal', icon: <span className="text-sm">🥩</span>, label: 'Halal' },
  { key: 'Spicy', icon: <Flame className="h-4 w-4" />, label: 'Spicy' },
]

export function SearchFilter({ items, onFilteredItems }: SearchFilterProps) {
  const language = useStore((s) => s.language)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
  const [availableOnly, setAvailableOnly] = useState(false)

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.ingredients.some((i) => i.toLowerCase().includes(q))
      )
    }

    if (dietaryFilters.length > 0) {
      result = result.filter((item) =>
        dietaryFilters.every((f) => item.dietaryTags.includes(f))
      )
    }

    result = result.filter(
      (item) => item.price >= priceRange[0] && item.price <= priceRange[1]
    )

    if (availableOnly) {
      result = result.filter((item) => item.available)
    }

    return result
  }, [items, search, dietaryFilters, priceRange, availableOnly])

  const hasActiveFilters = dietaryFilters.length > 0 || priceRange[0] > 0 || priceRange[1] < 2000 || availableOnly

  const clearFilters = () => {
    setDietaryFilters([])
    setPriceRange([0, 2000])
    setAvailableOnly(false)
  }

  const toggleDietary = (filter: DietaryFilter) => {
    setDietaryFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter]
    )
  }

  const t = (key: string): string => {
    if (language === 'sw') {
      if (key === 'search') return 'Tafuta vyakula...'
      if (key === 'filter') return 'Chuja'
      if (key === 'dietary') return 'Mlo Maalum'
      if (key === 'price') return 'Bei'
      if (key === 'available') return 'Inapatikana tu'
      if (key === 'clear') return 'Futa'
      if (key === 'apply') return 'Tekeleza'
      if (key === 'no-results') return 'Hakuna matokeo'
      if (key === 'suggestion') return 'Jaribu kubadilisha vichujio au utafute kitu kingine'
      return key
    }
    if (language === 'ar') {
      if (key === 'search') return 'ابحث عن الطعام...'
      if (key === 'filter') return 'تصفية'
      if (key === 'dietary') return 'نظام غذائي'
      if (key === 'price') return 'السعر'
      if (key === 'available') return 'المتاح فقط'
      if (key === 'clear') return 'مسح'
      if (key === 'apply') return 'تطبيق'
      if (key === 'no-results') return 'لا توجد نتائج'
      if (key === 'suggestion') return 'حاول تغيير عوامل التصفية أو البحث عن شيء آخر'
      return key
    }
    if (key === 'search') return 'Search dishes...'
    if (key === 'filter') return 'Filter'
    if (key === 'dietary') return 'Dietary'
    if (key === 'price') return 'Price Range'
    if (key === 'available') return 'Available only'
    if (key === 'clear') return 'Clear'
    if (key === 'apply') return 'Apply'
    if (key === 'no-results') return 'No results found'
    if (key === 'suggestion') return 'Try adjusting filters or searching for something else'
    return key
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full rounded-xl border-2 border-gray-200 bg-white py-2.5 pl-10 pr-9 font-body text-sm text-text-primary placeholder:text-text-secondary/50 transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowFilters(true)}
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all ${
            hasActiveFilters
              ? 'border-secondary bg-secondary/10 text-secondary'
              : 'border-gray-200 bg-white text-text-secondary'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {hasActiveFilters && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white"
            >
              {dietaryFilters.length + (availableOnly ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 2000 ? 1 : 0)}
            </motion.span>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {hasActiveFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex flex-wrap gap-1.5 overflow-hidden"
          >
            {dietaryFilters.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary"
              >
                {f}
                <button onClick={() => toggleDietary(f)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {availableOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                Available
                <button onClick={() => setAvailableOnly(false)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(priceRange[0] > 0 || priceRange[1] < 2000) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                KES {priceRange[0]} - {priceRange[1]}
                <button onClick={() => setPriceRange([0, 2000])}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Bottom Sheet */}
      <AnimatePresence>
        {showFilters && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowFilters(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative z-10 w-full rounded-t-3xl bg-white px-5 pb-8 pt-4"
            >
              <div className="flex justify-center pb-3">
                <div className="h-1.5 w-12 rounded-full bg-gray-300" />
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg font-bold text-text-primary">{t('filter')}</h3>
                <button onClick={clearFilters} className="text-xs font-medium text-secondary">
                  {t('clear')}
                </button>
              </div>

              <div className="mb-5">
                <h4 className="mb-2 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('dietary')}</h4>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map((opt) => (
                    <motion.button
                      key={opt.key}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleDietary(opt.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        dietaryFilters.includes(opt.key)
                          ? 'bg-secondary text-white'
                          : 'bg-gray-100 text-text-secondary'
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <h4 className="mb-2 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('price')}</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Math.min(Number(e.target.value), priceRange[1] - 50), priceRange[1]])}
                    className="flex-1 accent-secondary"
                  />
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Math.max(Number(e.target.value), priceRange[0] + 50)])}
                    className="flex-1 accent-secondary"
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-text-secondary">
                  <span>KES {priceRange[0].toLocaleString('en-KE')}</span>
                  <span>KES {priceRange[1].toLocaleString('en-KE')}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center gap-3">
                  <div
                    onClick={() => setAvailableOnly(!availableOnly)}
                    className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all ${
                      availableOnly ? 'border-secondary bg-secondary' : 'border-gray-300'
                    }`}
                  >
                    {availableOnly && <Check className="h-4 w-4 text-white" />}
                  </div>
                  <span className="font-body text-sm text-text-primary">{t('available')}</span>
                </label>
              </div>

              <Button
                fullWidth
                variant="primary"
                size="lg"
                onClick={() => setShowFilters(false)}
              >
                {t('apply')} ({filteredItems.length})
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NoResults() {
  const language = useStore((s) => s.language)

  const t = (key: string): string => {
    if (language === 'sw') return key === 'title' ? 'Hakuna matokeo' : 'Jaribu kubadilisha vichujio au utafute kitu kingine'
    if (language === 'ar') return key === 'title' ? 'لا توجد نتائج' : 'حاول تغيير عوامل التصفية أو البحث عن شيء آخر'
    return key === 'title' ? 'No results found' : 'Try adjusting filters or searching for something else'
  }

  return (
    <EmptyState
      icon={<Search className="h-12 w-12" />}
      title={t('title')}
      description={t('suggestion')}
    />
  )
}
