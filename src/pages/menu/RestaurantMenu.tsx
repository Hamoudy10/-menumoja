'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import type { MenuItem } from '@/types'
import {
  LoadingScreen,
  MenuHeader,
  CategoryTabs,
  MenuItemCard,
  LayoutToggle,
  ItemDetailSheet,
  SearchFilter,
  NoResults,
  AIChat,
} from '@/components/customer'
import { FloatingCart } from '@/components/ui/FloatingCart'

export function RestaurantMenu() {
  const navigate = useNavigate()
  const { categories, cart, restaurant, language } = useStore()

  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500)
    return () => clearTimeout(timer)
  }, [])

  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories])

  useEffect(() => {
    setFilteredItems(allItems)
  }, [allItems])

  const displayItems = useMemo(() => {
    if (activeCategory === 'all') return filteredItems
    const cat = categories.find((c) => c.id === activeCategory)
    if (!cat) return filteredItems
    return filteredItems.filter((item) => item.categoryId === cat.id)
  }, [filteredItems, activeCategory, categories])

  const scrollToCategory = useCallback(
    (id: string) => {
      setActiveCategory(id)
      if (id === 'all') return
      const el = document.getElementById(`category-${id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [],
  )

  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-background-light pb-24">
      <MenuHeader />

      <SearchFilter items={allItems} onFilteredItems={setFilteredItems} />

      <CategoryTabs activeCategory={activeCategory} onCategoryChange={scrollToCategory} />

      <div className="px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-text-primary">
            {activeCategory === 'all'
              ? language === 'sw' ? 'Menyu Yote' : language === 'ar' ? 'كل القائمة' : 'Full Menu'
              : categories.find((c) => c.id === activeCategory)?.name || 'Menu'}
          </h2>
          <LayoutToggle layout={layout} onToggle={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))} />
        </div>

        <AnimatePresence mode="wait">
          {displayItems.length === 0 ? (
            <NoResults key="no-results" />
          ) : (
            <div
              key={layout}
              className={
                layout === 'grid'
                  ? 'grid grid-cols-2 gap-3'
                  : 'flex flex-col gap-2'
              }
            >
              {displayItems.map((item, i) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  layout={layout === 'grid' ? 'grid' : 'list'}
                  onItemClick={setSelectedItem}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} id={`category-${cat.id}`} />
      ))}

      <FloatingCart onOpen={() => navigate('cart')} />

      <ItemDetailSheet
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <AIChat />
    </div>
  )
}
