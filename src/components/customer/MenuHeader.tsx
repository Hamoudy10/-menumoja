'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { MapPin, Clock, Star, BadgeCheck, UtensilsCrossed } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { LanguageToggle } from './LanguageToggle'

function getLabel(key: string, lang: string): string {
  if (lang === 'sw') {
    if (key === 'halal') return 'Imeidhinishwa Halal'
    if (key === 'open') return 'Wazi Sasa'
    if (key === 'location') return 'Mombasa, Kenya'
    return ''
  }
  if (lang === 'ar') {
    if (key === 'halal') return 'حلال معتمد'
    if (key === 'open') return 'مفتوح الآن'
    if (key === 'location') return 'مومباسا، كينيا'
    return ''
  }
  if (key === 'halal') return 'Halal Certified'
  if (key === 'open') return 'Open Now'
  if (key === 'location') return 'Mombasa, Kenya'
  return ''
}

export function MenuHeader() {
  const restaurant = useStore((s) => s.restaurant)
  const language = useStore((s) => s.language)
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const { scrollY } = useScroll()
  const parallaxY = useTransform(scrollY, [0, 200], [0, 40])
  const opacity = useTransform(scrollY, [0, 150], [1, 0.3])

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (v) => setScrolled(v > 60))
    return () => unsubscribe()
  }, [scrollY])

  const brandColor = restaurant?.brandColor || '#FF6B35'
  const name = restaurant?.name || 'Bahari Restaurant'
  const description = restaurant?.description || 'Authentic Swahili cuisine overlooking the Mombasa coastline'
  const rating = restaurant?.rating || 4.9

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div
        className="relative px-5 pb-8 pt-12"
        style={{ backgroundColor: brandColor }}
      >
        <motion.div style={{ opacity }} className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5" />
        </motion.div>

        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/15 backdrop-blur-sm">
                <UtensilsCrossed className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold text-white">{name}</h1>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-white/60" />
                  <span className="text-xs text-white/60">{getLabel('location', language)}</span>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <LanguageToggle />
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-3 text-sm text-white/80 leading-relaxed"
          >
            {description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <span className="text-xs font-bold text-white">{rating}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
              <BadgeCheck className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs text-white/90">{getLabel('halal', language)}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-green-400/20 px-2.5 py-1 backdrop-blur-sm">
              <Clock className="h-3.5 w-3.5 text-green-300" />
              <span className="text-xs text-green-200">{getLabel('open', language)}</span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {scrolled && (
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: brandColor }}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <span className="font-heading text-sm font-bold text-white">{name}</span>
          </div>
          <LanguageToggle />
        </motion.div>
      )}

      <motion.div
        style={{ y: parallaxY }}
        className="pointer-events-none absolute -bottom-1 left-0 right-0 h-6"
      >
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="h-full w-full">
          <path d="M0,20 Q360,60 720,20 Q1080,-20 1440,20 V60 H0 Z" fill="#FAFAF7" />
        </svg>
      </motion.div>
    </div>
  )
}
