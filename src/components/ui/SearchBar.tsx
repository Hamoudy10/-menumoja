'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'

interface SearchResult {
  id: string
  label: string
  description?: string
  icon?: ReactNode
}

interface SearchBarProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onSearch?: (value: string) => void
  results?: SearchResult[]
  onSelectResult?: (result: SearchResult) => void
  loading?: boolean
  className?: string
}

export function SearchBar({
  placeholder = 'Search...',
  value: externalValue,
  onChange,
  onSearch,
  results = [],
  onSelectResult,
  loading = false,
  className = '',
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const value = externalValue !== undefined ? externalValue : internalValue
  const setValue = onChange || setInternalValue

  const showResults = focused && value.length > 0 && results.length > 0

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClear = () => {
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <motion.div
        animate={{
          borderColor: focused
            ? 'rgb(255, 107, 53)'
            : 'rgba(0,0,0,0.1)',
        }}
        transition={{ duration: 0.2 }}
        className="flex items-center rounded-xl border-2 bg-white px-3 dark:bg-white/5 dark:border-white/20"
      >
        <Search className="h-4 w-4 shrink-0 text-text-secondary dark:text-white/60" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (onSearch) onSearch(e.target.value)
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearch) onSearch(value)
          }}
          placeholder={placeholder}
          className="w-full bg-transparent px-2 py-2.5 font-body text-sm text-text-primary outline-none placeholder:text-text-secondary/50 dark:text-white dark:placeholder:text-white/40"
        />
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleClear}
              className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-black/5 hover:text-text-primary dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-white shadow-soft dark:bg-primary-light dark:border dark:border-white/10"
          >
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => {
                  onSelectResult?.(result)
                  setFocused(false)
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left font-body text-sm text-text-primary transition-colors hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
              >
                {result.icon && (
                  <span className="shrink-0 text-text-secondary dark:text-white/60">
                    {result.icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {result.label}
                  </span>
                  {result.description && (
                    <span className="block truncate text-xs text-text-secondary dark:text-white/50">
                      {result.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
