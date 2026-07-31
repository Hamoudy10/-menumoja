import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  prefix?: string
  trend?: number
  trendLabel?: string
  color?: 'primary' | 'secondary' | 'success' | 'accent'
}

const colorMap: Record<string, string> = {
  primary: 'grad-brand-dark',
  secondary: 'grad-brand',
  success: 'from-success to-emerald-400',
  accent: 'grad-brand-soft',
}

export function StatCard({ icon, label, value, prefix = '', trend, trendLabel, color = 'primary' }: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white dark:bg-primary-light border border-gray-100 dark:border-white/5 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${colorMap[color] || colorMap.primary}`}>
          <div className="text-white [&>svg]:h-4.5 [&>svg]:w-4.5">
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-success' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="font-heading text-xl font-bold text-text-primary dark:text-white">
        {prefix}{value.toLocaleString()}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <p className="font-accent text-xs text-text-secondary dark:text-white/50">{label}</p>
        {trendLabel && (
          <span className="font-accent text-[10px] text-text-secondary/50">{trendLabel}</span>
        )}
      </div>
    </motion.div>
  )
}
