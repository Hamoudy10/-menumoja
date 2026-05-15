'use client'

import { motion } from 'framer-motion'

interface Step {
  label: string
}

interface ProgressBarProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function ProgressBar({
  steps,
  currentStep,
  className = '',
}: ProgressBarProps) {
  const progress = ((currentStep) / (steps.length - 1)) * 100

  return (
    <div className={`w-full ${className}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-secondary to-accent"
        />
      </div>
      <div className="mt-2 flex justify-between">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center">
            <motion.div
              initial={false}
              animate={{
                scale: i === currentStep ? 1.2 : 1,
                backgroundColor:
                  i <= currentStep ? '#FF6B35' : '#d1d5db',
              }}
              transition={{ duration: 0.3 }}
              className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                i <= currentStep
                  ? 'bg-secondary'
                  : 'bg-gray-300 dark:bg-white/20'
              }`}
            >
              {i < currentStep ? (
                <motion.svg
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.svg>
              ) : (
                i + 1
              )}
            </motion.div>
            <span
              className={`text-center font-accent text-xs ${
                i <= currentStep
                  ? 'font-medium text-secondary'
                  : 'text-text-secondary dark:text-white/50'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
