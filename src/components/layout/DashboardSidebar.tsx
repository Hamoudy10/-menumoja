import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, UtensilsCrossed, ShoppingCart, CreditCard,
  BarChart3, Camera, Megaphone, Settings, HelpCircle, ChefHat, X, Table2,
} from 'lucide-react'
import { useStore } from '@/store/useStore'

const menuItems = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { path: '/dashboard/tables', label: 'Tables', icon: Table2 },
  { path: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed },
  { path: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { path: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { path: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/dashboard/surveillance', label: 'Surveillance', icon: Camera },
  { path: '/dashboard/marketing', label: 'Marketing', icon: Megaphone },
  { path: '/dashboard/settings', label: 'Settings', icon: Settings },
  { path: '/dashboard/help', label: 'Help', icon: HelpCircle },
]

interface DashboardSidebarProps {
  onClose?: () => void
}

export default function DashboardSidebar({ onClose }: DashboardSidebarProps) {
  const { restaurant } = useStore()

  return (
    <aside className="w-60 h-screen bg-white dark:bg-primary border-r border-gray-100 dark:border-white/5 flex flex-col sticky top-0">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-primary dark:text-white text-sm truncate">
              {restaurant?.name || 'MenuMoja'}
            </p>
            <p className="text-[10px] text-text-secondary dark:text-white/40 truncate">
              {(() => { const p = restaurant?.plan as any; if (!p) return 'Dashboard'; const name = typeof p === 'string' ? p : p.name || ''; return name ? name.charAt(0).toUpperCase() + name.slice(1) + ' Plan' : 'Dashboard'; })()}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-secondary/10 text-secondary font-semibold'
                  : 'text-text-secondary dark:text-white/60 hover:text-primary dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/5">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-accent font-semibold text-success">System Online</span>
        </div>
      </div>
    </aside>
  )
}
