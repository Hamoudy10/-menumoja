import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Store, ShoppingCart, TrendingUp, Users, DollarSign, Clock } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function DashboardHome() {
  const { restaurant, orders, tables, transactions, todaySummary, fetchOrders, fetchTables, fetchPayments, fetchTodaySummary } = useStore()
  const [stats, setStats] = useState([
    { label: 'Total Orders Today', value: '47', icon: ShoppingCart, change: '+12%', color: 'from-secondary to-accent' },
    { label: 'Revenue Today', value: 'KES 45,200', icon: DollarSign, change: '+8%', color: 'from-success to-emerald-400' },
    { label: 'Active Tables', value: '0 / 0', icon: Store, change: '0%', color: 'from-blue-500 to-purple-500' },
    { label: 'Avg. Order Value', value: 'KES 0', icon: TrendingUp, change: '0%', color: 'from-pink-500 to-rose-400' },
  ])

  useEffect(() => {
    fetchOrders()
    fetchTables()
    fetchPayments()
    fetchTodaySummary()
  }, [])

  useEffect(() => {
    const todayOrders = orders.length
    const activeTables = tables.filter((t) => t.status === 'occupied' || t.status === 'order-pending').length
    const totalTables = tables.length || 12
    const todayRevenue = transactions.reduce((s, t) => s + t.amount, 0)
    const avgOrder = todayOrders > 0 ? Math.round(todayRevenue / todayOrders) : 0

    setStats([
      { label: 'Total Orders Today', value: String(todayOrders), icon: ShoppingCart, change: `${todayOrders > 0 ? '+' : ''}${todayOrders} today`, color: 'from-secondary to-accent' },
      { label: 'Revenue Today', value: `KES ${todayRevenue.toLocaleString()}`, icon: DollarSign, change: avgOrder > 0 ? `Avg KES ${avgOrder.toLocaleString()}` : 'No data', color: 'from-success to-emerald-400' },
      { label: 'Active Tables', value: `${activeTables} / ${totalTables}`, icon: Store, change: `${totalTables > 0 ? Math.round((activeTables / totalTables) * 100) : 0}%`, color: 'from-blue-500 to-purple-500' },
      { label: 'Avg. Order Value', value: `KES ${avgOrder.toLocaleString()}`, icon: TrendingUp, change: '+0%', color: 'from-pink-500 to-rose-400' },
    ])
  }, [orders, tables, transactions])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">Welcome back{restaurant ? `, ${restaurant.ownerName?.split(' ')[0] || restaurant.name?.split(' ')[0]}` : ''}!</h1>
        <p className="text-sm text-text-secondary dark:text-white/50">Here's what's happening at {restaurant?.name || 'your restaurant'} today.</p>
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
              <p className="text-xl font-heading font-bold text-primary dark:text-white">{stat.value}</p>
              <p className="text-xs text-text-secondary dark:text-white/50 mt-0.5">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-primary-light rounded-2xl p-5 border border-gray-100 dark:border-white/5">
          <h3 className="text-sm font-semibold text-primary dark:text-white mb-4">Recent Orders</h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-primary dark:text-white">Table {order.tableNumber}</p>
                  <p className="text-xs text-text-secondary dark:text-white/50">{order.items.map(i => i.name).join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-secondary">KES {order.total.toLocaleString()}</p>
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

        <div className="bg-white dark:bg-primary-light rounded-2xl p-5 border border-gray-100 dark:border-white/5">
          <h3 className="text-sm font-semibold text-primary dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'View Menu', icon: Store, color: 'bg-secondary/10 text-secondary', link: '/dashboard/menu' },
              { label: 'New Order', icon: ShoppingCart, color: 'bg-success/10 text-success', link: '/dashboard/orders' },
              { label: 'Analytics', icon: TrendingUp, color: 'bg-blue-500/10 text-blue-500', link: '/dashboard/analytics' },
              { label: 'Staff', icon: Users, color: 'bg-purple-500/10 text-purple-500', link: '/dashboard/settings' },
            ].map((action, i) => {
              const Icon = action.icon
              return (
                <a key={i} href={action.link} className={`flex items-center gap-3 p-3 rounded-xl ${action.color} transition-all hover:scale-[1.02]`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{action.label}</span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}