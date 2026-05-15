'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface StatusStep {
  label: string
  key: string
}

interface StatusTrackerProps {
  steps: StatusStep[]
  currentStatus: string
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function StatusTracker({
  steps,
  currentStatus,
  className = '',
  orientation = 'vertical',
}: StatusTrackerProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStatus)

  const isHorizontal = orientation === 'horizontal'

  return (
    <div
      className={`${isHorizontal ? 'flex items-start' : 'flex flex-col gap-0'} ${className}`}
    >
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex
        const isCurrent = i === currentIndex
        const isPending = i > currentIndex

        return (
          <div
            key={step.key}
            className={`flex ${isHorizontal ? 'flex-1 flex-col items-center' : 'items-start'}`}
          >
            <div className="flex items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.15 : 1,
                  backgroundColor: isCompleted
                    ? '#2ECC71'
                    : isCurrent
                      ? '#FF6B35'
                      : '#d1d5db',
                }}
                transition={{ duration: 0.3 }}
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isCompleted
                    ? 'bg-success'
                    : isCurrent
                      ? 'bg-secondary'
                      : 'bg-gray-300 dark:bg-white/20'
                }`}
              >
                {isCompleted ? (
                  <motion.svg
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="h-4 w-4 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </motion.svg>
                ) : isCurrent ? (
                  <motion.div
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="h-2 w-2 rounded-full bg-white"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">{i + 1}</span>
                )}
              </motion.div>
              <span
                className={`ml-3 font-accent text-sm ${
                  isCompleted
                    ? 'font-medium text-success'
                    : isCurrent
                      ? 'font-semibold text-secondary'
                      : 'text-text-secondary dark:text-white/50'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`${
                  isHorizontal
                    ? 'h-0.5 w-full translate-y-[-14px]'
                    : 'ml-3.5 h-6 w-0.5'
                } ${isCompleted ? 'bg-success' : isCurrent ? 'bg-gradient-to-b from-secondary to-gray-300 dark:to-white/20' : 'bg-gray-300 dark:bg-white/20'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
