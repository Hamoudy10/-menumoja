import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Banknote, Search, CheckCircle, Calculator, Clock, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as ordersApi from '@/api/orders'
import * as paymentsApi from '@/api/payments'

export default function CashierDashboard() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [cashAmount, setCashAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending')

  const fetchOrders = async () => {
    try {
      const data = await ordersApi.fetchOrders({ paymentStatus: 'UNPAID' })
      const allOrders = Array.isArray(data) ? data : data.orders || data || []
      const normalized = allOrders.map((o: any) => ({
        ...o,
        total: o.total ?? o.totalAmount ?? 0,
        items: o.items || [],
        tableNumber: o.tableNumber ?? 0,
      }))
      setOrders(normalized.filter((o: any) => {
        if (activeTab === 'pending') return o.paymentStatus !== 'PAID'
        return o.paymentStatus === 'PAID'
      }))
    } catch { showErrorToast('Failed to load orders') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchOrders() }, [activeTab])
  useEffect(() => { const interval = setInterval(fetchOrders, 15000); return () => clearInterval(interval) }, [activeTab])

  const handleCashPayment = async () => {
    if (!selectedOrder || !cashAmount) return
    setProcessing(true)
    try {
      const tendered = parseFloat(cashAmount)
      const total = selectedOrder.total
      if (tendered < total) { showErrorToast('Amount tendered less than total'); return }
      await paymentsApi.recordCashPayment({
        orderId: selectedOrder.id,
        amount: total,
        amountTendered: tendered,
      })
      const change = tendered - total
      showSuccessToast(`Payment recorded! Change: KES ${change.toLocaleString()}`)
      setSelectedOrder(null)
      setCashAmount('')
      fetchOrders()
    } catch { showErrorToast('Failed to record payment') }
    finally { setProcessing(false) }
  }

  const handleCardPayment = async (order: any) => {
    setProcessing(true)
    try {
      await paymentsApi.recordCardPayment(order.id, order.total)
      showSuccessToast('Card payment recorded!')
      fetchOrders()
    } catch { showErrorToast('Failed to record card payment') }
    finally { setProcessing(false) }
  }

  const filtered = orders.filter((o: any) => {
    const q = search.toLowerCase()
    return o.id.toLowerCase().includes(q) ||
      String(o.tableNumber).includes(q) ||
      (o.items || []).some((i: any) => (i.name || i.itemName || '').toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Cashier Terminal</h1>
            <p className="text-xs text-text-secondary">
              {selectedOrder ? 'Processing payment...' : 'Select an order to process payment'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchOrders} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
              <Clock className="h-4 w-4 text-text-secondary" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {(['pending', 'paid'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary'}`}>
              {tab === 'pending' ? 'Unpaid Orders' : 'Paid Today'}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <Input placeholder="Search by table # or item..." value={search} onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />} />

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-text-secondary/50">
                <p className="font-accent text-sm">All caught up!</p>
                <p className="text-xs mt-1">No {activeTab === 'pending' ? 'unpaid' : 'paid'} orders</p>
              </div>
            ) : (
              filtered.map((order: any) => (
                <motion.div key={order.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  onClick={() => activeTab === 'pending' && setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                  className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                    selectedOrder?.id === order.id ? 'border-secondary bg-secondary/5' : 'border-white/10 bg-white dark:bg-primary-light hover:bg-black/5'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-text-primary dark:text-white">
                        {order.tableNumber > 0 ? `Table ${order.tableNumber}` : 'Takeaway'}
                      </span>
                      <Badge size="sm" variant={order.paymentMethod === 'MPESA' ? 'info' : order.paymentMethod === 'CARD' ? 'warning' : 'default'}>
                        {order.paymentMethod || 'CASH'}
                      </Badge>
                    </div>
                    <span className="font-bold text-secondary text-lg">KES {order.total?.toLocaleString() || 0}</span>
                  </div>
                  <div className="space-y-1">
                    {(order.items || []).slice(0, 4).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs text-text-secondary">
                        <span>{item.quantity || 1}x {item.name || item.itemName || 'Item'}</span>
                      </div>
                    ))}
                    {(order.items || []).length > 4 && (
                      <p className="text-xs text-text-secondary/50">+{(order.items || []).length - 4} more items</p>
                    )}
                  </div>
                  {activeTab === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                      <Button size="sm" variant="primary" onClick={() => { handleCashPayment(); setCashAmount(String(order.total)) }}>
                        <Banknote className="h-3 w-3" /> Cash
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCardPayment(order)}>
                        <CreditCard className="h-3 w-3" /> Card
                      </Button>
                      {order.paymentMethod === 'MPESA' && (
                        <Button size="sm" variant="ghost" disabled>
                          <Smartphone className="h-3 w-3" /> M-Pesa Pending
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {activeTab === 'pending' && selectedOrder && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-primary-light rounded-2xl p-4 border border-secondary/30 space-y-4 sticky top-4 h-fit">
              <h3 className="font-heading font-bold text-text-primary">Cash Payment</h3>
              <div className="bg-secondary/5 rounded-xl p-3">
                <p className="text-xs text-text-secondary">Total Due</p>
                <p className="text-2xl font-bold text-secondary">KES {selectedOrder.total?.toLocaleString()}</p>
              </div>
              <Input label="Amount Tendered" type="number" value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                icon={<Banknote className="h-4 w-4" />} />

              {cashAmount && parseFloat(cashAmount) >= selectedOrder.total && (
                <div className="bg-success/10 rounded-xl p-3">
                  <p className="text-xs text-text-secondary">Change Due</p>
                  <p className="text-xl font-bold text-success">
                    KES {(parseFloat(cashAmount) - selectedOrder.total).toLocaleString()}
                  </p>
                </div>
              )}

              <Button fullWidth size="lg" loading={processing}
                disabled={!cashAmount || parseFloat(cashAmount) < selectedOrder.total}
                onClick={handleCashPayment}>
                <CheckCircle className="h-4 w-4" /> Record Cash Payment
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
