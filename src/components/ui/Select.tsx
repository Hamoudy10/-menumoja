import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  options: SelectOption[]
  error?: string
  hint?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={props.id || props.name} className="block font-accent text-sm font-medium text-text-primary dark:text-white/90">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={props.id || props.name}
            className={`w-full appearance-none rounded-xl border-2 bg-white dark:bg-white/5 px-4 py-2.5 pr-10 font-body text-sm text-text-primary dark:text-white transition-all focus:outline-none focus:ring-2 ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-200 dark:border-white/20 focus:border-secondary focus:ring-secondary/20'
            } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
        </div>
        {error && (
          <p className="font-accent text-xs text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="font-accent text-xs text-text-secondary/50">{hint}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
