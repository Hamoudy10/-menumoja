'use client'

import { motion } from 'framer-motion'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  id?: string
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  id,
}: ToggleProps) {
  const toggleId = id || 'toggle-' + Math.random().toString(36).slice(2)

  return (
    <label
      htmlFor={toggleId}
      className={`inline-flex items-center gap-3 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <div className="relative">
        <input
          id={toggleId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <motion.div
          animate={{ backgroundColor: checked ? '#FF6B35' : '#d1d5db' }}
          transition={{ duration: 0.2 }}
          className="h-6 w-11 rounded-full p-0.5"
        >
          <motion.div
            animate={{ x: checked ? 20 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="h-5 w-5 rounded-full bg-white shadow-md"
          />
        </motion.div>
      </div>
      {label && (
        <span className="font-body text-sm text-text-primary dark:text-white/90">
          {label}
        </span>
      )}
    </label>
  )
}
