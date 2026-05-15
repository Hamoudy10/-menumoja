'use client'

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  useRef,
  useCallback,
  useEffect,
} from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  isPassword?: boolean
  otp?: boolean
  otpLength?: number
  currency?: boolean
  currencySymbol?: string
  containerClassName?: string
}

function formatKES(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10)
  return num.toLocaleString('en-KE')
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      iconPosition = 'left',
      isPassword = false,
      otp = false,
      otpLength = 6,
      currency = false,
      currencySymbol = 'KES',
      containerClassName = '',
      className = '',
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false)
    const [otpValues, setOtpValues] = useState<string[]>(
      Array(otpLength).fill(''),
    )
    const otpRefs = useRef<(HTMLInputElement | null)[]>([])

    const handleOtpChange = useCallback(
      (index: number, val: string) => {
        if (val.length > 1) {
          const pasted = val.replace(/\D/g, '').split('').slice(0, otpLength)
          const newValues = [...otpValues]
          pasted.forEach((char, i) => {
            if (index + i < otpLength) newValues[index + i] = char
          })
          setOtpValues(newValues)
          const nextIndex = Math.min(index + pasted.length, otpLength - 1)
          otpRefs.current[nextIndex]?.focus()
          return
        }
        const digit = val.replace(/\D/g, '')
        const newValues = [...otpValues]
        newValues[index] = digit
        setOtpValues(newValues)
        if (digit && index < otpLength - 1) {
          otpRefs.current[index + 1]?.focus()
        }
      },
      [otpValues, otpLength],
    )

    const handleOtpKeyDown = useCallback(
      (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
          otpRefs.current[index - 1]?.focus()
        }
      },
      [otpValues],
    )

    const inputId = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined

    if (otp) {
      return (
        <div className={containerClassName}>
          {label && (
            <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">
              {label}
            </label>
          )}
          <div className="flex items-center gap-2">
            {otpValues.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className={`
                  h-12 w-12 rounded-xl border-2 text-center text-lg font-bold font-accent
                  transition-all duration-200 focus:outline-none
                  ${
                    error
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-gray-200 dark:border-white/20 focus:border-secondary'
                  }
                  ${
                    digit
                      ? 'border-secondary bg-secondary/5 dark:bg-secondary/10'
                      : 'bg-white dark:bg-white/5'
                  }
                  dark:text-white
                `}
              />
            ))}
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-1.5 flex items-center gap-1 text-xs text-red-500"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )
    }

    const hasLeftIcon = icon && iconPosition === 'left'
    const hasRightIcon = icon && iconPosition === 'right'
    const showToggle = isPassword

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {currency && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-accent text-sm font-medium text-text-secondary dark:text-white/60">
              {currencySymbol}
            </span>
          )}
          {hasLeftIcon && !currency && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-white/60">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={
              isPassword ? (showPassword ? 'text' : 'password') : props.type || 'text'
            }
            value={
              currency && value
                ? formatKES(value as string)
                : value
            }
            onChange={onChange}
            className={`
              w-full rounded-xl border-2 bg-white px-4 py-2.5 font-body text-text-primary
              transition-all duration-200 placeholder:text-text-secondary/50
              focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20
              disabled:cursor-not-allowed disabled:opacity-50
              dark:bg-white/5 dark:text-white dark:placeholder:text-white/40
              ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-200 dark:border-white/20'}
              ${currency ? 'pl-16' : hasLeftIcon ? 'pl-10' : ''}
              ${hasRightIcon || showToggle ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {(hasRightIcon || showToggle) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {showToggle ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                  className="text-text-secondary transition-colors hover:text-text-primary dark:text-white/60 dark:hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="text-text-secondary dark:text-white/60">
                  {icon}
                </span>
              )}
            </span>
          )}
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 flex items-center gap-1 text-xs text-red-500"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {helperText && !error && (
          <p className="mt-1 text-xs text-text-secondary dark:text-white/50">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
