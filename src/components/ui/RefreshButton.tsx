import { RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

interface RefreshButtonProps {
  refreshing: boolean
  onClick: () => void
  className?: string
  title?: string
}

export function RefreshButton({ refreshing, onClick, className = '', title = 'Refresh' }: RefreshButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={refreshing}
      title={title}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 text-text-secondary hover:text-secondary shadow-soft transition-colors disabled:opacity-60 ${className}`}
    >
      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-secondary' : ''}`} />
    </motion.button>
  )
}
