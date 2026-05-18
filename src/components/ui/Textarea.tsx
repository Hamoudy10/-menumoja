import { forwardRef } from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={props.id || props.name} className="block font-accent text-sm font-medium text-text-primary dark:text-white/90">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={props.id || props.name}
          className={`w-full rounded-xl border-2 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-sm text-text-primary dark:text-white transition-all focus:outline-none focus:ring-2 resize-y min-h-[80px] ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 dark:border-white/20 focus:border-secondary focus:ring-secondary/20'
          } ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="font-accent text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
