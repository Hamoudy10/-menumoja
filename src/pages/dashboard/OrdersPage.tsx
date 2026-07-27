import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Search, Filter, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  CookingPot, UtensilsCrossed, ChefHat, Loader2,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getOrderHistory, fetchLiveOrders as fetchLiveOrdersApi } from '@/api/orders'
import { OrderCard } from '@/components/dashboard/OrderCard'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import type { Order } from '@/types'

type Tab = 'live' | 'history' | 'kitchen'

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<Tab>('live')
  const orders = useStore((s) => s.orders)
  const liveOrders = useStore((s) => s.liveOrders)
  const fetchLiveOrders = useStore((s) => s.fetchLiveOrders)
  const updateOrderStatus = useStore((s) => s.updateOrderStatus)

  useEffect(() => {
    if (activeTab === 'live') {
      fetchLiveOrders()
      const interval = setInterval(fetchLiveOrders, 15000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Orders</h1>
        <p className="font-body text-sm text-text-secondary dark:text-white/50">Manage and track all orders</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1 w-fit">
        {(['live', 'history', 'kitchen'] as Tab[]).map((tab) => (
          <motion.button
            key={tab}
            onClick={() => setActiveTab(tab)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`rounded-lg px-4 py-2 text-sm font-accent font-medium transition-colors ${
              activeTab === tab
                ? 'bg-secondary text-white'
                : 'text-text-secondary dark:text-white/60 hover:text-text-primary dark:hover:text-white'
            }`}
          >
            {tab === 'live' ? 'Live Orders' : tab === 'history' ? 'Order History' : 'Kitchen Display'}
          </motion.button>
        ))}
      </div>

      {activeTab === 'live' && <LiveOrdersView orders={liveOrders.length > 0 ? liveOrders : orders} updateOrderStatus={updateOrderStatus} />}
      {activeTab === 'history' && <OrderHistory orders={orders} />}
      {activeTab === 'kitchen' && <KitchenDisplay orders={orders} updateOrderStatus={updateOrderStatus} />}
    </div>
  )
}

function LiveOrdersView({ orders, updateOrderStatus }: { orders: Order[]; updateOrderStatus: (id: string, status: Order['status']) => void }) {
  const columns: Order['status'][] = ['new', 'preparing', 'ready', 'served']
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})
  const MAX_VISIBLE = 12

  const columnLabels: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    new: { label: 'New / Pending', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    preparing: { label: 'Preparing', icon: CookingPot, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ready: { label: 'Ready', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    served: { label: 'Served', icon: UtensilsCrossed, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' },
  }

  return (
    <div className={`grid gap-4 ${
      columns.length === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
    }`}>
      {columns.map((status) => {
        const cfg = columnLabels[status]
        const colOrders = orders.filter((o) => {
          const s = (o.status?.toLowerCase?.() || o.status || '')
          return s === status || (status === 'new' && (s === 'pending' || s === 'confirmed'))
        })
        const visible = showAll[status] ? colOrders : colOrders.slice(0, MAX_VISIBLE)

        return (
          <div key={status} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className={`flex items-center gap-2 px-4 py-3 border-b border-white/10 ${cfg.bg}`}>
              <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
              <span className="font-accent text-sm font-bold text-text-primary dark:text-white flex-1">{cfg.label}</span>
              <Badge size="sm" variant="default">{colOrders.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <AnimatePresence>
                {colOrders.length === 0 ? (
                  <p className="text-center font-body text-xs text-text-secondary/50 py-8">No orders</p>
                ) : (
                  visible.map((order) => (
                    <OrderCard key={order.id} order={order} onStatusChange={updateOrderStatus} />
                  ))
                )}
              </AnimatePresence>
            </div>
            {colOrders.length > MAX_VISIBLE && (
              <button
                onClick={() => setShowAll({ ...showAll, [status]: !showAll[status] })}
                className="px-4 py-2 text-xs font-medium text-secondary hover:bg-secondary/5 border-t border-white/10 transition-colors"
              >
                {showAll[status] ? 'Show less' : `Show all ${colOrders.length} orders`}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function OrderHistory({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [tableSearch, setTableSearch] = useState('')
  const [historyOrders, setHistoryOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getOrderHistory({ perPage: 100 })
      .then((data) => setHistoryOrders(Array.isArray(data) ? data : []))
      .catch(() => showErrorToast('Failed to load order history'))
      .finally(() => setLoading(false))
  }, [])

  const sourceOrders = historyOrders.length > 0 ? historyOrders : orders

  const filtered = sourceOrders.filter((o: any) => {
    const matchSearch = (o.id || '').toLowerCase().includes(search.toLowerCase()) || (o.items || []).some((i: any) => (i.name || i.itemName || '').toLowerCase().includes(search.toLowerCase()))
    const matchFilter = filter === 'all' || (o.status || '').toLowerCase() === filter.toLowerCase()
    const matchTable = !tableSearch || String(o.tableNumber || '').includes(tableSearch)
    return matchSearch && matchFilter && matchTable
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SearchBar placeholder="Search by order ID or item name..." value={search} onChange={setSearch} className="flex-1 max-w-sm" />
        <input
          type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
          placeholder="Filter by table #..."
          className="w-28 rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-2 text-xs font-body text-text-primary dark:text-white placeholder:text-text-secondary/50 focus:border-secondary focus:outline-none"
        />
        <div className="flex gap-1 rounded-lg bg-black/5 dark:bg-white/10 p-1">
          {(['all', 'served', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-accent font-medium transition-colors ${
                filter === f ? 'bg-secondary text-white' : 'text-text-secondary dark:text-white/60 hover:text-text-primary'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="h-12 w-12" />} title="No orders found" description="Try a different search or filter" />
        ) : (
          filtered.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                className="flex w-full items-center gap-4 p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="font-heading text-lg font-bold text-text-primary dark:text-white min-w-[4rem]">
                  {order.tableNumber != null && order.tableNumber > 0 ? `T${order.tableNumber.toString().padStart(2, '0')}` : 'T—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-text-primary dark:text-white truncate">
                    {(order.items || []).map((i: any) => `${i.quantity}x ${i.itemName || i.name}`).join(', ')}
                  </p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50 mt-0.5">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={
                  order.status === 'SERVED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : order.status === 'new' ? 'info' : order.status === 'preparing' ? 'warning' : order.status === 'ready' ? 'success' : 'default'
                } size="sm">
                  {order.status}
                </Badge>
                <span className="font-accent text-sm font-bold text-secondary">KES {(order.totalAmount || order.total || 0).toLocaleString()}</span>
                {expanded === order.id ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
              </button>
              <AnimatePresence>
                {expanded === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/10"
                  >
                    <div className="p-4 space-y-3">
                      {(order.items || []).map((item: any, i: any) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-body text-text-primary dark:text-white/80">{item.itemName || item.name}</span>
                          <span className="font-accent text-text-secondary dark:text-white/50">
                            {item.quantity} × KES {(item.itemPrice || item.price || 0).toLocaleString()} = KES {((item.itemPrice || item.price || 0) * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-white/10 pt-3">
                        <div className="grid grid-cols-2 gap-4 text-sm font-body">
                          <div>
                            <span className="text-text-secondary dark:text-white/50">Payment:</span>
                            <span className="ml-2 font-medium text-text-primary dark:text-white capitalize">{order.paymentMethod}</span>
                          </div>
                          <div>
                            <span className="text-text-secondary dark:text-white/50">Status:</span>
                            <span className="ml-2 font-medium text-text-primary dark:text-white capitalize">{order.paymentStatus}</span>
                          </div>
                        </div>
                        {order.specialInstructions && (
                          <p className="mt-2 text-sm text-text-secondary dark:text-white/60 italic">
                            "{order.specialInstructions}"
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}

function KitchenDisplay({ orders, updateOrderStatus }: { orders: Order[]; updateOrderStatus: (id: string, status: Order['status']) => void }) {
  const kitchenOrders = useMemo(() =>
    orders.filter((o) => o.status === 'new' || o.status === 'preparing'),
  [orders])
  const [timers, setTimers] = useState<Record<string, string>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimers(() => {
        const newTimers: Record<string, string> = {}
        const currentOrders = orders.filter((o) => o.status === 'new' || o.status === 'preparing')
        currentOrders.forEach((o) => {
          const diff = Date.now() - new Date(o.createdAt).getTime()
          const mins = Math.floor(diff / 60000)
          const secs = Math.floor((diff % 60000) / 1000)
          newTimers[o.id] = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        })
        return newTimers
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [orders])

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ChefHat className="h-6 w-6 text-secondary" />
        <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">Kitchen Display</h2>
        <Badge variant="warning" size="lg">{kitchenOrders.length} pending</Badge>
      </div>

      {kitchenOrders.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12" />}
          title="All caught up!"
          description="No pending orders in the kitchen"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kitchenOrders.map((order) => {
            const elapsed = timers[order.id] || '00:00'
            const [mins] = elapsed.split(':').map(Number)
            const isOverdue = mins > 15
            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl border-2 bg-white dark:bg-primary-light p-5 ${
                  isOverdue ? 'border-red-500 animate-pulse' : order.status === 'new' ? 'border-blue-500' : 'border-amber-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-heading text-3xl font-bold text-text-primary dark:text-white">
                    {order.tableNumber != null && order.tableNumber > 0 ? `T${order.tableNumber.toString().padStart(2, '0')}` : 'T—'}
                  </span>
                  <div className={`flex items-center gap-1.5 font-accent text-lg font-bold tabular-nums ${
                    isOverdue ? 'text-red-500' : 'text-text-secondary dark:text-white/60'
                  }`}>
                    <Clock className="h-4 w-4" />
                    {elapsed}
                    {isOverdue && <AlertTriangle className="h-4 w-4 ml-1" />}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {(order.items || []).map((item: any, i: any) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="font-body text-lg text-text-primary dark:text-white">
                        {item.quantity}x {item.name}
                      </span>
                      {item.specialInstructions && (
                        <span className="text-xs text-amber-500 italic ml-2">{item.specialInstructions}</span>
                      )}
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    const nextStatus = order.status === 'new' ? 'preparing' : 'ready'
                    updateOrderStatus(order.id, nextStatus)
                    showSuccessToast(`Order moved to ${nextStatus}`)
                  }}
                  className={`w-full rounded-xl py-3 font-accent font-bold text-base transition-all ${
                    order.status === 'new'
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-success text-white hover:bg-green-600'
                  }`}
                >
                  {order.status === 'new' ? 'START PREPARING' : 'MARK READY'}
                </motion.button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
