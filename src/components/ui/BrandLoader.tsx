import { ChefHat } from 'lucide-react'
import { motion } from 'framer-motion'

interface BrandLoaderProps {
  label?: string
  className?: string
}

export function BrandLoader({ label = 'Loading…', className = '' }: BrandLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <motion.div
        className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center shadow-soft"
        animate={{ scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChefHat className="w-8 h-8 text-white" />
        <span className="absolute inset-0 rounded-2xl bg-secondary/30 animate-ping" style={{ animationDuration: '1.8s' }} />
      </motion.div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-secondary animate-loading-dots" style={{ animationDelay: '0s' }} />
        <span className="w-2 h-2 rounded-full bg-secondary animate-loading-dots" style={{ animationDelay: '0.15s' }} />
        <span className="w-2 h-2 rounded-full bg-secondary animate-loading-dots" style={{ animationDelay: '0.3s' }} />
      </div>
      <p className="font-accent text-xs text-text-secondary animate-pulse">{label}</p>
    </div>
  )
}
