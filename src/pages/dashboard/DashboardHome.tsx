import { useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Store, ShoppingCart, TrendingUp, Users, DollarSign, Clock, Bell, ArrowRight, UtensilsCrossed, CreditCard, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'

export default function DashboardHome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    restaurant, orders, tables, transactions, todaySummary,
    fetchOrders, fetchTables, fetchPayments, fetchTodaySummary,
    notifications, fetchNotifications, unreadCount,
  } = useStore()

  const stats = useMemo(() => {
    const todayOrders = todaySummary?.orderCount ?? orders.length
    const activeTables = tables.filter((t) => t.status === 'occupied' || t.status === 'order-pending').length
    const totalTables = tables.length || 12
    const todayRevenue = todaySummary?.totalRevenue ?? transactions.reduce((s, t) => s + t.amount, 0)
    const avgOrder = todayOrders > 0 ? Math.round(todayRevenue / todayOrders) : 0

    return [
      { label: 'Total Orders Today', value: String(todayOrders), icon: ShoppingCart, change: `${todayOrders > 0 ? '+' : ''}${todayOrders} today`, color: 'from-secondary to-accent' },
      { label: 'Revenue Today', value: `KES ${todayRevenue.toLocaleString()}`, icon: DollarSign, change: avgOrder > 0 ? `Avg KES ${avgOrder.toLocaleString()}` : 'No data', color: 'from-success to-emerald-400' },
      { label: 'Active Tables', value: `${activeTables} / ${totalTables}`, icon: Store, change: `${totalTables > 0 ? Math.round((activeTables / totalTables) * 100) : 0}%`, color: 'from-blue-500 to-purple-500' },
      { label: 'Avg. Order Value', value: `KES ${avgOrder.toLocaleString()}`, icon: TrendingUp, change: '+0%', color: 'from-pink-500 to-rose-400' },
    ]
  }, [orders, tables, transactions, todaySummary])

  const refreshData = useCallback(() => {
    fetchOrders()
    fetchTables()
    fetchPayments()
    fetchTodaySummary()
    fetchNotifications()
  }, [])

  useEffect(() => {
    refreshData()
    const interval = setInterval(refreshData, 60000)
    return () => clearInterval(interval)
  }, [refreshData])

  const iconMap: Record<string, React.ReactNode> = {
    new_order: <ShoppingCart className="h-4 w-4" />,
    payment: <CreditCard className="h-4 w-4" />,
    order_ready: <UtensilsCrossed className="h-4 w-4" />,
    alert: <AlertTriangle className="h-4 w-4" />,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary dark:text-white">
            Welcome back{restaurant ? `, ${restaurant.ownerName?.split(' ')[0] || restaurant.name?.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-sm text-text-secondary dark:text-white/50">Here's what's happening at {restaurant?.name || 'your restaurant'} today.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-5 w-5 text-text-secondary" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="font-accent text-xs text-text-secondary">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-primary-light rounded-2xl p-4 border border-gray-100 dark:border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-xs font-medium text-success">{stat.change}</span>
              </div>
              <p className="text-xl font-heading font-bold text-text-primary dark:text-white">{stat.value}</p>
              <p className="text-xs text-text-secondary dark:text-white/50 mt-0.5">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-primary-light rounded-2xl p-5 border border-gray-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary dark:text-white">Recent Orders</h3>
            <button onClick={() => navigate('/dashboard/orders')} className="flex items-center gap-1 text-xs text-secondary hover:text-secondary-dark font-medium">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-text-primary dark:text-white">{order.tableNumber > 0 ? `Table ${order.tableNumber}` : 'General'}</p>
                  <p className="text-xs text-text-secondary dark:text-white/50">{(order.items || []).map((i: any) => i.name).join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-secondary">KES {(order.total || 0).toLocaleString()}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    order.status === 'new' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                    order.status === 'preparing' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                    order.status === 'ready' ? 'bg-success/10 text-success' :
                    'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60'
                  }`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-text-secondary dark:text-white/40 text-center py-4">No orders yet today</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-primary-light rounded-2xl p-5 border border-gray-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary dark:text-white">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'View Menu', icon: Store, color: 'bg-secondary/10 text-secondary', link: '/dashboard/menu' },
                { label: 'New Order', icon: ShoppingCart, color: 'bg-success/10 text-success', link: '/dashboard/orders' },
                { label: 'Analytics', icon: TrendingUp, color: 'bg-blue-500/10 text-blue-500', link: '/dashboard/analytics' },
                { label: 'Settings', icon: Users, color: 'bg-purple-500/10 text-purple-500', link: '/dashboard/settings' },
              ].map((action, i) => {
                const Icon = action.icon
                return (
                  <button key={i} onClick={() => navigate(action.link)}
                    className={`flex items-center gap-3 p-3 rounded-xl ${action.color} transition-all hover:scale-[1.02]`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-primary-light rounded-2xl p-5 border border-gray-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary dark:text-white">Live Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-secondary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{unreadCount}</span>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-text-secondary dark:text-white/40 text-center py-4">No notifications</p>
              ) : (
                notifications.slice(0, 5).map((n: any) => (
                  <div key={n.id} className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${!n.read ? 'bg-secondary/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      n.type === 'new_order' ? 'bg-blue-100 text-blue-500 dark:bg-blue-900/30' :
                      n.type === 'payment' ? 'bg-green-100 text-green-500 dark:bg-green-900/30' :
                      'bg-black/5 text-text-secondary'
                    }`}>
                      {iconMap[n.type] || <Bell className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary dark:text-white/80 truncate">{n.title || n.message}</p>
                      <p className="text-[10px] text-text-secondary dark:text-white/40">
                        {n.createdAt ? format(new Date(n.createdAt), 'HH:mm') : ''}
                      </p>
                    </div>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
