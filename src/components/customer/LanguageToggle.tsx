'use client'

import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'

const languages = [
  { code: 'en' as const, flag: '🇬🇧', label: 'EN' },
  { code: 'sw' as const, flag: '🇰🇪', label: 'SW' },
  { code: 'ar' as const, flag: '🇸🇦', label: 'AR' },
]

export function LanguageToggle() {
  const { language, setLanguage } = useStore()

  return (
    <div className="flex items-center gap-1 rounded-full bg-white/15 p-0.5 backdrop-blur-md">
      {languages.map((lang) => {
        const active = language === lang.code
        return (
          <motion.button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            whileTap={{ scale: 0.9 }}
            className={`relative flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? 'text-white' : 'text-white/60 hover:text-white/80'
            }`}
          >
            {active && (
              <motion.div
                layoutId="lang-bg"
                className="absolute inset-0 rounded-full bg-white/20"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{lang.flag}</span>
            <span className="relative font-accent">{lang.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
