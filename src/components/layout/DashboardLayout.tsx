import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, LogOut, User, ChevronDown, ShoppingCart, CreditCard, ChefHat } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import DashboardSidebar from './DashboardSidebar'
import NotificationBell from '@/components/notifications/NotificationBell'
import * as notificationsApi from '@/api/notifications'

export default function DashboardLayout() {
  const { t, i18n } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { restaurant, logout, language, isAuthenticated, fetchNotifications, notifications, unreadCount } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (language === 'ar') {
      document.documentElement.dir = 'rtl'
    } else {
      document.documentElement.dir = 'ltr'
    }
  }, [language])

  useEffect(() => {
    if (!isAuthenticated) return

    const lastCount = localStorage.getItem('last_notif_count') || '0'

    const poll = setInterval(async () => {
      try {
        const data = await notificationsApi.fetchNotifications()
        const newNotifications = (data.notifications || data || [])
        const currentCount = data.unreadCount ?? 0

        const prevCount = parseInt(localStorage.getItem('last_notif_count') || '0')

        if (currentCount > prevCount && newNotifications.length > 0) {
          const latest = newNotifications[0]
          const iconMap: Record<string, string> = {
            new_order: '🆕',
            payment: '💰',
            order_ready: '👨‍🍳',
            review: '⭐',
            alert: '⚠️',
          }
          toast(
            (t) => (
              <div className="flex items-center gap-3">
                <span className="text-lg">{iconMap[latest.type] || '🔔'}</span>
                <div className="min-w-0">
                  <p className="font-accent text-sm font-medium text-text-primary dark:text-white truncate">
                    {latest.title || latest.message}
                  </p>
                  {latest.message && latest.title && (
                    <p className="font-accent text-xs text-text-secondary dark:text-white/50 truncate">{latest.message}</p>
                  )}
                </div>
              </div>
            ),
            { duration: 5000, position: 'top-right' }
          )
        }

        localStorage.setItem('last_notif_count', currentCount.toString())
      } catch {}
    }, 15000)

    return () => clearInterval(poll)
  }, [isAuthenticated])

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="hidden lg:block">
          <DashboardSidebar />
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 z-50 h-full lg:hidden"
              >
                <DashboardSidebar onClose={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-white/80 dark:bg-primary/80 backdrop-blur-xl px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors lg:hidden"
            >
              <Menu className="h-4 w-4 text-text-secondary" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <NotificationBell />

              <div className="flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/10 px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-[10px] font-bold text-white">
                  {restaurant?.name?.charAt(0) || 'M'}
                </div>
                <div className="hidden sm:block">
                  <p className="font-accent text-xs font-medium text-text-primary dark:text-white leading-tight">
                    {restaurant?.name || 'MenuMoja'}
                  </p>
                  <p className="font-accent text-[10px] text-text-secondary leading-tight">
                    {(() => { const p = restaurant?.plan as any; if (!p) return ''; const name = typeof p === 'string' ? p : p.name || ''; return name.charAt(0).toUpperCase() + name.slice(1) + ' Plan'; })()}
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  await logout()
                  navigate('/login')
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                title={t('auth.logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
  )
}
