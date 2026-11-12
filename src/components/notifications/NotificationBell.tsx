import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Clock, ShoppingCart, CreditCard, ChefHat, Star, AlertTriangle, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import * as notificationsApi from '@/api/notifications'

function iconFor(type: string): ReactNode {
  const key = String(type || '').toLowerCase()
  switch (key) {
    case 'new_order':
      return <ShoppingCart className="h-4 w-4" />
    case 'payment':
    case 'payment_received':
    case 'payment_failed':
    case 'subscription_expiring':
      return <CreditCard className="h-4 w-4" />
    case 'order_ready':
      return <ChefHat className="h-4 w-4" />
    case 'order_waiting':
      return <Clock className="h-4 w-4" />
    case 'daily_briefing':
      return <Sparkles className="h-4 w-4" />
    case 'review':
      return <Star className="h-4 w-4" />
    case 'low_stock':
    case 'camera_alert':
    case 'alert':
      return <AlertTriangle className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

function colorFor(type: string): string {
  const key = String(type || '').toLowerCase()
  if (key === 'new_order') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
  if (key === 'daily_briefing') return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500'
  if (key.startsWith('payment') || key === 'subscription_expiring') return 'bg-green-100 dark:bg-green-900/30 text-green-500'
  if (key === 'order_ready') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
  if (key === 'order_waiting') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
  if (key === 'low_stock' || key === 'camera_alert' || key === 'alert') return 'bg-red-100 dark:bg-red-900/30 text-red-500'
  return 'bg-black/5 dark:bg-white/10 text-text-secondary'
}

const isReadNotification = (n: any): boolean => Boolean(n?.isRead ?? n?.read)

export default function NotificationBell() {
  const { notifications, unreadCount, fetchNotifications } = useStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleAction = async (notification: any, action: any) => {
    try {
      await notificationsApi.markAsRead(notification.id)
    } catch {
      /* read receipt is best-effort */
    }
    fetchNotifications()

    if (action?.kind === 'navigate' && action.to) {
      setOpen(false)
      navigate(action.to)
      return
    }
    if (action?.kind === 'command' && action.text) {
      setOpen(false)
      window.dispatchEvent(new CustomEvent('jarvis:command', { detail: { text: action.text } }))
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
      >
        <Bell className="h-4 w-4 text-text-secondary dark:text-white/60" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl bg-white dark:bg-primary-light border border-white/10 shadow-soft overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <h3 className="font-accent text-sm font-bold text-text-primary dark:text-white">
                {t('notifications.title')}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5 text-text-secondary" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Bell className="h-8 w-8 text-text-secondary/30" />
                  <p className="font-body text-xs text-text-secondary/50">{t('notifications.noNotifications')}</p>
                </div>
              ) : (
                notifications.slice(0, 20).map((n: any) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 border-b border-white/5 p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${!isReadNotification(n) ? 'bg-secondary/5' : ''}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorFor(n.type)}`}>
                      {iconFor(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs font-medium text-text-primary dark:text-white/90 truncate">
                        {n.title || n.message}
                      </p>
                      {n.title && n.message && n.title !== n.message && (
                        <p className="font-accent text-[10px] text-text-secondary dark:text-white/40 mt-0.5">
                          {n.message}
                        </p>
                      )}
                      <p className="font-accent text-[10px] text-text-secondary/50 mt-0.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {n.createdAt ? format(new Date(n.createdAt), 'MMM d, HH:mm') : ''}
                      </p>

                      {Array.isArray(n.data?.actions) && n.data.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {n.data.actions.map((action: any, index: number) => (
                            <button
                              key={`${n.id}-${index}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleAction(n, action)
                              }}
                              className="rounded-full border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-[10px] font-accent font-medium text-secondary hover:bg-secondary/20"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isReadNotification(n) && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                    )}
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-white/10 p-2">
                <button
                  onClick={async () => {
                    const { markAllAsRead } = await import('@/api/notifications')
                    await markAllAsRead()
                    fetchNotifications()
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-accent font-medium text-secondary hover:bg-secondary/5 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t('notifications.markAllRead')}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
