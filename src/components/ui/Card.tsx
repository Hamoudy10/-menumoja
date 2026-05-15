import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

export interface CardProps {
  children: ReactNode
  variant?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  className?: string
  onClick?: () => void
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5 lg:p-6',
  lg: 'p-5 sm:p-6 lg:p-8',
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  hover = true,
  className = '',
  onClick,
}: CardProps) {
  const isStandardVariant = ['elevated', 'outlined', 'flat'].includes(variant)
  const baseStyle = isStandardVariant
    ? variant === 'elevated'
      ? 'bg-card shadow-soft border border-white/10'
      : variant === 'outlined'
        ? 'bg-transparent border border-gray-200'
        : 'bg-gray-50 border border-transparent'
    : 'bg-card shadow-soft border border-white/10'

  const variantClass = !isStandardVariant && variant !== 'elevated' ? variant : ''

  return (
    <motion.div
      whileHover={hover ? { y: -6, scale: 1.01 } : undefined}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={`rounded-2xl ${baseStyle} ${paddingStyles[padding]} ${variantClass} ${className}`}
    >
      {children}
    </motion.div>
  )
}
