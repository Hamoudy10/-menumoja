'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { Waves, UtensilsCrossed } from 'lucide-react'

function getPhrase(lang: string): { loading: string; tagline: string } {
  if (lang === 'sw') return { loading: 'Inapakia menyu yako...', tagline: 'Sahihi ya Mombasa halisi' }
  if (lang === 'ar') return { loading: 'جاري تحميل القائمة...', tagline: 'نكهة مومباسا الأصيلة' }
  return { loading: 'Loading your menu...', tagline: 'A taste of authentic Mombasa' }
}

export function LoadingScreen() {
  const restaurant = useStore((s) => s.restaurant)
  const language = useStore((s) => s.language)
  const [progress, setProgress] = useState(0)
  const [showContent, setShowContent] = useState(false)

  const brandColor = restaurant?.brandColor || '#FF6B35'
  const name = restaurant?.name || 'MenuMoja'
  const phrase = getPhrase(language)

  useEffect(() => {
    setShowContent(true)
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); return 100 }
        return p + Math.random() * 8
      })
    }, 200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ backgroundColor: brandColor }}>
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <Waves className="absolute -bottom-10 left-0 h-40 w-full text-white" />
      </div>

      <AnimatePresence>
        {showContent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/20 backdrop-blur-md"
            >
              <UtensilsCrossed className="h-12 w-12 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="font-heading text-3xl font-bold text-white"
            >
              {name}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="mt-2 text-sm text-white/70"
            >
              {phrase.tagline}
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-8 text-xs text-white/50"
            >
              {phrase.loading}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-12 left-8 right-8">
        <div className="h-1 overflow-hidden rounded-full bg-white/20">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--color-accent)' }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-white/40">
          {Math.round(Math.min(progress, 100))}%
        </p>
      </div>
    </div>
  )
}
