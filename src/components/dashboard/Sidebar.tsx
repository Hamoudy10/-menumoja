import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, UtensilsCrossed, ShoppingBag, Wallet, BarChart3,
  Camera, Megaphone, Settings, HelpCircle, Crown, ChevronLeft, ChevronRight,
  Store,
} from 'lucide-react'
import { useStore } from '@/store/useStore'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: UtensilsCrossed, label: 'Menu Manager', path: '/dashboard/menu' },
  { icon: ShoppingBag, label: 'Orders', path: '/dashboard/orders' },
  { icon: Wallet, label: 'Payments', path: '/dashboard/payments' },
  { icon: BarChart3, label: 'Analytics', path: '/dashboard/analytics' },
  { icon: Camera, label: 'Surveillance', path: '/dashboard/surveillance' },
  { icon: Megaphone, label: 'Marketing', path: '/dashboard/marketing' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
  { icon: HelpCircle, label: 'Help', path: '/dashboard/help' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const restaurant = useStore((s) => s.restaurant)

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#060D1A] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-white/5">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-accent"
        >
          <Store className="h-5 w-5 text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="overflow-hidden"
            >
              <h1 className="font-heading text-lg font-bold text-white truncate">
                {restaurant?.name || 'MenuMoja'}
              </h1>
              <p className="text-[10px] font-accent text-white/40 uppercase tracking-widest">Owner Dashboard</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
              className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-accent text-sm font-medium transition-colors ${
                active
                  ? 'bg-secondary/15 text-secondary'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-secondary"
                />
              )}
              <item.icon className="h-5 w-5 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </nav>

      <div className="border-t border-white/5 px-3 py-4 space-y-1">
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.97 }}
          className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-accent text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/90 transition-colors"
        >
          <Crown className="h-5 w-5 shrink-0 text-secondary" />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="truncate"
            >
              Upgrade Plan
            </motion.span>
          )}
          {!collapsed && (
            <span className="ml-auto rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-accent font-bold text-secondary uppercase">
              Pro
            </span>
          )}
        </motion.button>

        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex w-full items-center justify-center rounded-xl bg-white/5 py-2 text-white/40 hover:text-white/70 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </motion.button>
      </div>
    </motion.aside>
  )
}
