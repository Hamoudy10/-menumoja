'use client'

import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors: Record<ToastType, string> = {
  success: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  error: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  warning: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
}

const iconColors: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

function showToast(type: ToastType, message: string) {
  const Icon = icons[type]
  toast.custom(
    (t) => (
      <div
        className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 p-4 shadow-soft ${
          colors[type]
        } ${
          t.visible ? 'animate-slide-up' : 'translate-y-2 opacity-0'
        } transition-all duration-300`}
      >
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColors[type]}`} />
        <p className="flex-1 font-body text-sm text-text-primary dark:text-white">
          {message}
        </p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-text-secondary hover:text-text-primary dark:text-white/60 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: 4000, position: 'top-right' },
  )
}

export const showSuccessToast = (message: string) => showToast('success', message)
export const showErrorToast = (message: string) => showToast('error', message)
export const showWarningToast = (message: string) => showToast('warning', message)
export const showInfoToast = (message: string) => showToast('info', message)

export function Toaster() {
  return null
}


