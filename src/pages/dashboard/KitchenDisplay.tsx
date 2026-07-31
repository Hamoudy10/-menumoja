import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChefHat, Clock, CheckCircle, Timer, LogOut } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast } from '@/components/ui/Toast'

const statusColors: Record<string, string> = {
  PENDING: 'bg-blue-500',
  CONFIRMED: 'bg-amber-500',
  PREPARING: 'bg-orange-500',
  READY: 'bg-green-500',
}

export default function KitchenDisplay() {
  const navigate = useNavigate()
  const { orders, liveOrders, fetchOrders, fetchLiveOrders, updateOrderStatus, tables, fetchTables } = useStore()

  const tableInfo = useMemo(() => {
    const map = new Map<string, { label: string; zone: string }>()
    tables.forEach((t) => {
      map.set(t.id, {
        label: t.label || `Table ${t.tableNumber}`,
        zone: t.zone?.name || t.area || '',
      })
    })
    return map
  }, [tables])

  const staffName = localStorage.getItem('staffName') || 'Staff'

  const handleSignOut = () => {
    localStorage.removeItem('staffAccessToken')
    localStorage.removeItem('staffRefreshToken')
    localStorage.removeItem('staffRole')
    localStorage.removeItem('staffName')
    localStorage.removeItem('staffId')
    localStorage.removeItem('staffRestaurantSlug')
    navigate('/login')
  }
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchOrders(), fetchLiveOrders(), fetchTables()])
      setLoading(false)
    }
    load()
    const interval = setInterval(() => { fetchOrders(); fetchLiveOrders(); fetchTables() }, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    if (busyId) return
    setBusyId(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      showSuccessToast(`Order marked as ${newStatus}`)
    } catch {}
    finally { setBusyId(null) }
  }

  const allOrders = [...liveOrders, ...orders.filter((o: any) => !liveOrders.find((l: any) => l.id === o.id))]
  const pendingOrders = allOrders.filter((o: any) => {
    const s = (o.status || '').toUpperCase()
    return ['PENDING', 'CONFIRMED', 'PREPARING', 'NEW'].includes(s)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <Skeleton variant="text" className="w-44 h-6" />
              <Skeleton variant="text" className="w-24 h-3 mt-1" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-4 border-2 border-gray-100 bg-white dark:bg-primary-light shadow-soft space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton variant="text" className="w-28 h-5" />
                <Skeleton variant="text" className="w-16 h-4" />
              </div>
              <Skeleton variant="text" className="w-3/4 h-4" />
              <Skeleton variant="text" className="w-1/2 h-4" />
              <Skeleton variant="card" className="h-9" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-text-primary dark:text-white">Kitchen Display</h1>
            <p className="text-xs text-text-secondary">{pendingOrders.length} active orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary hidden sm:inline">{staffName}</span>
          <Timer className="w-4 h-4 text-text-secondary" />
          <span className="text-xs text-text-secondary">Auto-refreshes every 15s</span>
          <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-text-secondary hover:text-red-500 transition-colors" title="Sign Out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ChefHat className="w-16 h-16 text-text-secondary/20 mb-4" />
          <h2 className="text-lg font-heading font-bold text-text-primary mb-2">No Active Orders</h2>
          <p className="text-text-secondary text-sm">New orders will appear here automatically</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingOrders.map((order: any) => {
            const status = order.status?.toUpperCase?.() || order.status || 'PENDING'
            const isOverdue = order.status === 'PENDING' || order.status === 'CONFIRMED'
            return (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-2xl p-4 border-2 ${isOverdue ? 'border-amber-500 animate-pulse' : 'border-gray-100'} bg-white dark:bg-primary-light shadow-soft`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-lg font-bold text-text-primary dark:text-white">
                        {order.orderNumber || `#${order.id.slice(0, 8)}`}
                      </span>
                      <Badge variant={status === 'READY' ? 'success' : status === 'PREPARING' ? 'warning' : 'info'} size="sm">
                        {status}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {order.tableNumber > 0 ? `Table ${order.tableNumber}` : 'Takeaway'} · <Clock className="w-3 h-3 inline" />{' '}
                      {order.createdAt ? Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000) : 0} min ago
                      {(() => {
                        const info = order.tableId ? tableInfo.get(order.tableId) : null
                        if (!info) return null
                        return (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-medium">
                            {info.zone || info.label}
                          </span>
                        )
                      })()}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {(order.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-text-primary dark:text-white">
                        <span className="w-6 h-6 rounded-md bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">{item.quantity || 1}x</span>
                        {item.name || item.itemName || `Item ${i + 1}`}
                      </span>
                    </div>
                  ))}
                </div>

                {order.specialInstructions && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-3">
                    📝 {order.specialInstructions}
                  </p>
                )}

                <div className="flex gap-2">
                  {(status === 'PENDING' || status === 'NEW' || status === 'CONFIRMED') && (
                    <Button size="sm" fullWidth loading={busyId === order.id} disabled={busyId !== null} onClick={() => handleStatusUpdate(order.id, 'preparing')}>
                      <Timer className="w-3.5 h-3.5" /> Start Preparing
                    </Button>
                  )}
                  {status === 'PREPARING' && (
                    <Button size="sm" fullWidth loading={busyId === order.id} disabled={busyId !== null} onClick={() => handleStatusUpdate(order.id, 'ready')}>
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Ready
                    </Button>
                  )}
                  {status === 'READY' && (
                    <Button size="sm" fullWidth variant="ghost" loading={busyId === order.id} disabled={busyId !== null} onClick={() => handleStatusUpdate(order.id, 'served')}>
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Served
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
