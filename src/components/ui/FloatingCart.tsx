'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface FloatingCartProps {
  onOpen: () => void
  className?: string
}

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export function FloatingCart({ onOpen, className = '' }: FloatingCartProps) {
  const cart = useStore((s) => s.cart)
  const [bounce, setBounce] = useState(false)

  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0)
  const total = cart.reduce(
    (sum, c) => sum + c.item.price * c.quantity,
    0,
  )

  useEffect(() => {
    if (itemCount > 0) {
      setBounce(true)
      const timer = setTimeout(() => setBounce(false), 300)
      return () => clearTimeout(timer)
    }
  }, [itemCount])

  if (itemCount === 0) return null

  return (
    <div className={`fixed bottom-6 left-1/2 z-40 -translate-x-1/2 ${className}`}>
      <motion.button
        onClick={onOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={bounce ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3 rounded-full bg-secondary px-6 py-3 shadow-warm text-white"
      >
        <div className="relative">
          <ShoppingBag className="h-5 w-5" />
          <AnimatePresence>
            <motion.span
              key={itemCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-secondary"
            >
              {itemCount}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className="font-accent font-semibold">View Cart</span>
        <span className="font-accent font-bold">{formatKES(total)}</span>
      </motion.button>
    </div>
  )
}
