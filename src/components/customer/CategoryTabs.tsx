'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'

interface CategoryTabsProps {
  activeCategory: string
  onCategoryChange: (id: string) => void
}

function getLabel(lang: string): string {
  if (lang === 'sw') return 'Vyote'
  if (lang === 'ar') return 'الكل'
  return 'All'
}

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  const categories = useStore((s) => s.categories)
  const language = useStore((s) => s.language)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasShadow, setHasShadow] = useState(false)

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setHasShadow(scrollRef.current.scrollLeft > 5)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', handleScroll)
      return () => el.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  const scrollToTab = (id: string) => {
    onCategoryChange(id)
    const el = scrollRef.current
    if (!el) return
    const tab = el.querySelector(`[data-cat-id="${id}"]`)
    if (tab) {
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }

  return (
    <div className={`sticky top-0 z-20 bg-background-light transition-shadow duration-300 ${hasShadow ? 'shadow-md' : ''}`}>
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto px-4 py-3 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <motion.button
          data-cat-id="all"
          onClick={() => scrollToTab('all')}
          whileTap={{ scale: 0.95 }}
          className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {activeCategory === 'all' && (
            <motion.div
              layoutId="cat-bg"
              className="absolute inset-0 rounded-full bg-secondary"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative font-accent">{getLabel(language)}</span>
        </motion.button>

        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            data-cat-id={cat.id}
            onClick={() => scrollToTab(cat.id)}
            whileTap={{ scale: 0.95 }}
            className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? 'text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {activeCategory === cat.id && (
              <motion.div
                layoutId="cat-bg"
                className="absolute inset-0 rounded-full bg-secondary"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative font-accent">{cat.name}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
