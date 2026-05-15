'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-4 text-text-secondary/40 dark:text-white/30"
      >
        {icon}
      </motion.div>
      <h3 className="mb-1 font-heading text-xl font-bold text-text-primary dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="mb-6 max-w-sm font-body text-sm text-text-secondary dark:text-white/60">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="md">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  )
}
