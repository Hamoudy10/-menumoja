'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, LayoutGrid, List, Leaf, Flame, Wheat, Milk } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { MenuItem } from '@/types'
import type { ReactNode } from 'react'

interface MenuItemCardProps {
  item: MenuItem
  onItemClick: (item: MenuItem) => void
  layout: 'grid' | 'list'
}

const categoryEmojis: Record<string, string> = {
  '1': '🍖',
  '2': '🥟',
  '3': '🥤',
}

function getCategoryEmoji(categoryId: string): string {
  return categoryEmojis[categoryId] || '🍽️'
}

function formatKES(price: number): string {
  return `KES ${price.toLocaleString('en-KE')}`
}

export function MenuItemCard({ item, onItemClick, layout }: MenuItemCardProps) {
  const addToCart = useStore((s) => s.addToCart)
  const [adding, setAdding] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const dietaryIcons: Record<string, ReactNode> = {
    Vegetarian: <Leaf key="veg" className="h-3 w-3 text-green-600" />,
    Vegan: <Leaf key="vegan" className="h-3 w-3 text-green-600" />,
    Spicy: <Flame key="spicy" className="h-3 w-3 text-red-500" />,
    Halal: <span key="halal" className="text-xs">🥩</span>,
  }

  const allergenIcons: Record<string, ReactNode> = {
    Gluten: <Wheat key="gluten" className="h-3 w-3 text-amber-600" />,
    Dairy: <Milk key="dairy" className="h-3 w-3 text-blue-500" />,
  }

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    setAdding(true)
    addToCart(item)
    setTimeout(() => setAdding(false), 600)
  }

  if (layout === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onItemClick(item)}
        className={`relative flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft transition-all ${
          !item.available ? 'opacity-60' : ''
        }`}
      >
        <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ${
          !item.available ? 'grayscale' : ''
        }`}>
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/20 to-accent/20 text-2xl">
            {getCategoryEmoji(item.categoryId)}
          </div>
          {!item.available && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">Sold Out</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {item.isPopular && <span className="text-xs">🔥</span>}
            {item.isNew && <span className="text-xs">✨</span>}
            {item.isSpecial && <span className="text-xs">⭐</span>}
            <h3 className="truncate font-body text-sm font-semibold text-text-primary">{item.name}</h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-text-secondary">{item.description}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-accent text-sm font-bold text-secondary">{formatKES(item.price)}</span>
            <div className="flex items-center gap-0.5">
              {item.dietaryTags.slice(0, 2).map((tag) => (
                <span key={tag} title={tag}>{dietaryIcons[tag]}</span>
              ))}
            </div>
          </div>
        </div>

        <motion.button
          onClick={handleAdd}
          whileTap={{ scale: 0.85 }}
          animate={adding ? { scale: [1, 1.3, 1] } : {}}
          disabled={!item.available}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors ${
            adding ? 'bg-success' : item.available ? 'bg-secondary' : 'bg-gray-300'
          }`}
        >
          {adding ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-xs"
            >
              ✓
            </motion.span>
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </motion.button>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onItemClick(item)}
      className={`relative overflow-hidden rounded-2xl bg-white shadow-soft transition-all ${
        !item.available ? 'opacity-60' : ''
      }`}
    >
      <div className={`relative h-28 overflow-hidden ${
        !item.available ? 'grayscale' : ''
      }`}>
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary/20 to-accent/20 text-4xl">
          {getCategoryEmoji(item.categoryId)}
        </div>
        {!item.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-xs font-bold uppercase tracking-wider text-white">Sold Out</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {item.isPopular && (
            <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              🔥 Popular
            </span>
          )}
          {item.isNew && (
            <span className="rounded-full bg-purple-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              ✨ New
            </span>
          )}
          {item.isSpecial && (
            <span className="rounded-full bg-accent/90 px-2 py-0.5 text-[10px] font-bold text-primary shadow-sm">
              ⭐ Today's Special
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="truncate font-body text-sm font-semibold text-text-primary">{item.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{item.description}</p>

        <div className="mt-2 flex items-center justify-between">
          <span className="font-accent text-base font-bold text-secondary">{formatKES(item.price)}</span>
          <div className="flex items-center gap-0.5">
            {item.dietaryTags.slice(0, 3).map((tag) => (
              <span key={tag} title={tag}>{dietaryIcons[tag] || tag}</span>
            ))}
          </div>
        </div>

        <motion.button
          onClick={handleAdd}
          whileTap={{ scale: 0.85 }}
          animate={adding ? { scale: [1, 1.3, 1] } : {}}
          disabled={!item.available}
          className={`mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold text-white transition-colors ${
            adding ? 'bg-success' : item.available ? 'bg-secondary' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {adding ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              ✓ Added
            </motion.span>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}

interface LayoutToggleProps {
  layout: 'grid' | 'list'
  onToggle: () => void
}

export function LayoutToggle({ layout, onToggle }: LayoutToggleProps) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-soft text-text-secondary hover:text-secondary transition-colors"
    >
      {layout === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
    </motion.button>
  )
}
