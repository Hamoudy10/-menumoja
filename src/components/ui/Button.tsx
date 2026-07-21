import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  className?: string
}

const variantStyles: Record<string, string> = {
  primary: 'bg-secondary text-white hover:bg-secondary-dark shadow-warm',
  secondary: 'bg-accent text-primary hover:bg-yellow-400',
  ghost: 'bg-transparent text-text-secondary dark:text-white hover:bg-black/5 dark:hover:bg-white/10',
  outline: 'border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/40',
}

const sizeStyles: Record<string, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  iconPosition = 'left',
  loading,
  disabled,
  type = 'button',
  onClick,
  className = '',
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.03 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-accent font-semibold transition-all duration-300 cursor-pointer
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon && iconPosition === 'left' ? (
        icon
      ) : null}
      {children}
      {!loading && icon && iconPosition === 'right' ? icon : null}
    </motion.button>
  )
}
