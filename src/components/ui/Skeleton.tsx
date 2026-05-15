'use client'

interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle' | 'table-row' | 'chart'
  className?: string
}

const baseClass =
  'relative overflow-hidden rounded-lg bg-gray-200 dark:bg-white/10 after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.5s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent'

const variants: Record<string, string> = {
  text: 'h-4 w-full',
  card: 'h-40 w-full rounded-2xl',
  circle: 'h-12 w-12 rounded-full',
  'table-row': 'h-10 w-full',
  chart: 'h-48 w-full rounded-2xl',
}

export function Skeleton({ variant = 'text', className = '' }: SkeletonProps) {
  return <div className={`${baseClass} ${variants[variant]} ${className}`} />
}
