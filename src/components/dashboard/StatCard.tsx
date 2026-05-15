import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number
  prefix?: string
  suffix?: string
  trend: number
  trendLabel: string
  decimals?: number
  color?: 'secondary' | 'accent' | 'success' | 'primary'
}

function AnimatedCounter({ value, decimals = 0, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1500
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased * 100) / 100)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value])

  return (
    <span>
      {prefix}{display.toLocaleString('en-KE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  )
}

const colorMap = {
  secondary: { bg: 'bg-secondary/10', icon: 'text-secondary', gradient: 'from-secondary to-accent' },
  accent: { bg: 'bg-accent/10', icon: 'text-accent', gradient: 'from-accent to-yellow-400' },
  success: { bg: 'bg-success/10', icon: 'text-success', gradient: 'from-success to-green-400' },
  primary: { bg: 'bg-primary/10', icon: 'text-primary', gradient: 'from-primary to-blue-600' },
}

export function StatCard({ icon, label, value, prefix = '', suffix = '', trend, trendLabel, decimals = 0, color = 'secondary' }: StatCardProps) {
  const c = colorMap[color]
  const isUp = trend >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group relative overflow-hidden rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5"
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${c.gradient} opacity-[0.03]`} />
      <div className="relative z-10 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
          {icon}
        </div>
      </div>
      <div className="relative z-10 mt-4">
        <p className="font-body text-sm text-text-secondary dark:text-white/60">{label}</p>
        <p className="mt-1 font-heading text-2xl font-bold text-text-primary dark:text-white tabular-nums">
          <AnimatedCounter value={value} decimals={decimals} prefix={prefix} suffix={suffix} />
        </p>
        <div className="mt-2 flex items-center gap-2">
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 }}
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-accent font-semibold ${
              isUp ? 'bg-success/10 text-success' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            <svg className={`h-3 w-3 ${isUp ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
            {Math.abs(trend)}%
          </motion.span>
          <span className="font-accent text-[11px] text-text-secondary dark:text-white/40">{trendLabel}</span>
        </div>
      </div>
    </motion.div>
  )
}
