import { motion } from 'framer-motion'
import { Delete, X } from 'lucide-react'

interface NumberPadProps {
  value: string
  onChange: (val: string) => void
  onClose?: () => void
  maxDecimals?: number
}

export default function NumberPad({ value, onChange, onClose, maxDecimals = 0 }: NumberPadProps) {
  const handleInput = (key: string) => {
    if (key === 'clear') { onChange(''); return }
    if (key === 'backspace') { onChange(value.slice(0, -1)); return }
    if (key === '.' && maxDecimals > 0) {
      if (value.includes('.')) return
      onChange(value + '.')
      return
    }
    if (key === '00') {
      if (value === '0' || value === '') onChange('0')
      else if (maxDecimals > 0 && value.includes('.')) {
        const parts = value.split('.')
        if (parts[1].length >= maxDecimals) return
        onChange(value + '0')
      } else onChange(value + '0')
      return
    }
    if (value === '0' && key !== '.') onChange(key)
    else {
      if (maxDecimals > 0 && value.includes('.')) {
        const parts = value.split('.')
        if (parts[1].length >= maxDecimals) return
      }
      onChange(value + key)
    }
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '00'],
  ]

  return (
    <div className="select-none">
      <div className="grid grid-cols-3 gap-1.5">
        {keys.flat().map((k) => (
          <button
            key={k}
            onTouchStart={(e) => { e.preventDefault(); handleInput(k) }}
            onClick={() => handleInput(k)}
            className="h-12 rounded-xl bg-black/5 dark:bg-white/10 text-lg font-bold text-text-primary dark:text-white
              active:bg-secondary active:text-white transition-colors
              hover:bg-black/10 dark:hover:bg-white/20"
          >
            {k}
          </button>
        ))}
        <button
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => handleInput('backspace')}
          className="h-12 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center
            active:bg-red-500 active:text-white transition-colors"
        >
          <Delete className="w-5 h-5" />
        </button>
        <button
          onTouchStart={(e) => e.preventDefault()}
          onClick={() => handleInput('clear')}
          className="col-span-2 h-12 rounded-xl bg-gray-200 dark:bg-white/20 text-text-secondary text-sm font-medium
            active:bg-secondary active:text-white transition-colors"
        >
          Clear
        </button>
      </div>
      {onClose && (
        <button onClick={onClose} className="mt-2 w-full py-2 text-xs text-text-secondary hover:text-secondary">
          <X className="w-3 h-3 inline mr-1" />Close
        </button>
      )}
    </div>
  )
}
