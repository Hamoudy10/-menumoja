import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, CreditCard, Banknote, Smartphone, CheckCircle, Clock,
  Receipt, Calculator, ShoppingBag, X, ChevronDown, ChevronUp,
  Coffee, UtensilsCrossed, ArrowRight, Loader2, Hash, User, Printer
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import { useStore } from '@/store/useStore'
import * as ordersApi from '@/api/orders'
import * as paymentsApi from '@/api/payments'

const ITEMS_PER_PAGE = 15

export default function CashierDashboard() {
  const { restaurant } = useStore()
  const [orders, setOrders] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash')
  const [discount, setDiscount] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastPayment, setLastPayment] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState({ todayTotal: 0, ordersCount: 0, pendingCount: 0 })

  const fetchOrders = async () => {
    try {
      const [ordersRes, summaryRes] = await Promise.all([
        ordersApi.fetchOrders({ perPage: 100 }),
        paymentsApi.fetchTodaySummary(),
      ])
      const raw = Array.isArray(ordersRes) ? ordersRes : ordersRes?.orders || ordersRes || []
      const normalized = raw.map((o: any) => ({
        ...o,
        total: Number(o.total ?? o.totalAmount ?? 0),
        items: (o.items || []).map((i: any) => ({
          ...i,
          name: i.name || i.itemName || 'Item',
          price: Number(i.price || i.itemPrice || 0),
          quantity: i.quantity || 1,
        })),
        tableNumber: o.tableNumber ?? 0,
        paymentMethod: o.paymentMethod || 'CASH',
        paymentStatus: o.paymentStatus || 'UNPAID',
        createdAt: o.createdAt || new Date().toISOString(),
        orderNumber: o.orderNumber || o.id?.slice(0, 8).toUpperCase(),
      }))
      setAllOrders(normalized)
      setOrders(normalized.filter((o: any) => {
        if (activeTab === 'pending') return o.paymentStatus !== 'PAID'
        return o.paymentStatus === 'PAID'
      }))
      if (summaryRes) setStats({
        todayTotal: summaryRes.totalRevenue || summaryRes.total || 0,
        ordersCount: summaryRes.totalOrders || summaryRes.orderCount || 0,
        pendingCount: normalized.filter((o: any) => o.paymentStatus !== 'PAID').length,
      })
    } catch { showErrorToast('Failed to load orders') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchOrders() }, [activeTab])
  useEffect(() => { const interval = setInterval(fetchOrders, 30000); return () => clearInterval(interval) }, [activeTab])

  const filtered = useMemo(() => {
    return orders.filter((o: any) => {
      const q = search.toLowerCase()
      const matchSearch = !q || o.orderNumber?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) ||
        o.items.some((i: any) => i.name.toLowerCase().includes(q))
      const matchTable = !filterTable || String(o.tableNumber) === filterTable
      return matchSearch && matchTable
    })
  }, [orders, search, filterTable])

  const paginated = filtered.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = paginated.length < filtered.length

  const orderTotal = useMemo(() => {
    if (!selectedOrder) return 0
    const subtotal = selectedOrder.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
    const disc = parseFloat(discount) || 0
    return Math.max(0, subtotal - disc)
  }, [selectedOrder, discount])

  const change = useMemo(() => {
    if (!cashReceived) return 0
    return Math.max(0, parseFloat(cashReceived) - orderTotal)
  }, [cashReceived, orderTotal])

  const handlePayment = async () => {
    if (!selectedOrder) return
    setProcessing(true)
    try {
      if (paymentMethod === 'cash') {
        if (parseFloat(cashReceived) < orderTotal) { showErrorToast('Insufficient amount'); return }
        await paymentsApi.recordCashPayment({
          orderId: selectedOrder.id,
          amount: orderTotal,
          amountTendered: parseFloat(cashReceived),
        })
      } else if (paymentMethod === 'card') {
        await paymentsApi.recordCardPayment(selectedOrder.id, orderTotal)
      } else {
        showErrorToast('M-Pesa: use the customer phone prompt')
        return
      }
      const receiptNo = genReceiptNo()
      const receipt = {
        receiptNo,
        orderNumber: selectedOrder.orderNumber,
        table: selectedOrder.tableNumber,
        items: selectedOrder.items,
        subtotal: selectedOrder.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0),
        discount: parseFloat(discount) || 0,
        total: orderTotal,
        method: paymentMethod,
        cashReceived: parseFloat(cashReceived) || 0,
        change,
        time: new Date().toLocaleString('en-KE', { hour12: true }),
        date: new Date().toLocaleDateString('en-KE'),
      }
      setLastPayment(receipt)
      setShowReceipt(true)
      showSuccessToast(`Payment recorded!${paymentMethod === 'cash' ? ` Change: KES ${change.toLocaleString()}` : ''}`)
      setSelectedOrder(null)
      setCashReceived('')
      setDiscount('')
      fetchOrders()
    } catch { showErrorToast('Payment failed') }
    finally { setProcessing(false) }
  }

  const formatKES = (v: number) => `KES ${v.toLocaleString('en-KE')}`
  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
  }
  const genReceiptNo = () => {
    const now = new Date()
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
    const t = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    return `ETR-${d}-${t}${String(Math.floor(Math.random()*9000)+1000)}`
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="flex h-screen overflow-hidden">
        {/* LEFT: Order List */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/10">
          <header className="shrink-0 bg-white dark:bg-primary-light border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-heading text-lg font-bold text-text-primary dark:text-white">POS Terminal</h1>
                <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                  <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {stats.ordersCount} orders</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Receipt className="w-3 h-3" /> {formatKES(stats.todayTotal)}</span>
                  <span>·</span>
                  <Badge size="sm" variant={stats.pendingCount > 0 ? 'warning' : 'default'}>{stats.pendingCount} pending</Badge>
                </div>
              </div>
              <button onClick={fetchOrders} className="p-2 rounded-xl hover:bg-black/5">
                <Clock className="h-4 w-4 text-text-secondary" />
              </button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Search order # or item..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                icon={<Search className="h-4 w-4" />} containerClassName="flex-1" />
              <Input placeholder="Table #" value={filterTable} onChange={(e) => { setFilterTable(e.target.value); setPage(1) }}
                icon={<Hash className="h-4 w-4" />} containerClassName="w-28" />
            </div>
            <div className="flex gap-2 mt-2">
              {(['pending', 'paid'] as const).map((tab) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); setSelectedOrder(null) }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === tab ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary'
                  }`}>
                  {tab === 'pending' ? 'Unpaid' : 'Paid Today'}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-20 text-text-secondary/50">
                <Coffee className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-accent text-sm">All caught up!</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/5">
                  {paginated.map((order: any) => {
                    const isSelected = selectedOrder?.id === order.id
                    const itemCount = order.items.reduce((s: number, i: any) => s + i.quantity, 0)
                    const subtotal = order.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
                    return (
                      <motion.div key={order.id} layout initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setSelectedOrder(isSelected ? null : order)}
                        className={`cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                          isSelected ? 'bg-secondary/10 dark:bg-secondary/5 border-l-4 border-secondary' : 'border-l-4 border-transparent'
                        }`}>
                        <div className="px-4 py-3">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-text-primary dark:text-white">
                                  #{order.orderNumber || order.id.slice(0, 6)}
                                </span>
                                <Badge size="sm" variant={order.paymentMethod === 'MPESA' ? 'info' : order.paymentMethod === 'CARD' ? 'warning' : 'default'}>
                                  {order.paymentMethod}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                                <span>{order.tableNumber > 0 ? `Table ${order.tableNumber}` : 'Takeaway'}</span>
                                <span>·</span>
                                <Clock className="w-3 h-3" /> {timeAgo(order.createdAt)}
                                <span>·</span>
                                <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <span className="text-base font-bold text-secondary">{formatKES(order.total)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {order.items.slice(0, 4).map((item: any, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-text-secondary">
                                {item.quantity}x {item.name}
                              </span>
                            ))}
                            {order.items.length > 4 && (
                              <span className="text-[10px] text-text-secondary/50">+{order.items.length - 4} more</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                {hasMore && (
                  <button onClick={() => setPage(p => p + 1)}
                    className="w-full py-3 text-xs text-secondary hover:bg-secondary/5 font-medium transition-colors border-t border-white/10">
                    <ChevronDown className="h-3 w-3 inline mr-1" /> Load More ({filtered.length - paginated.length} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Payment Panel */}
        <div className="w-96 shrink-0 bg-white dark:bg-primary-light flex flex-col">
          <AnimatePresence mode="wait">
            {showReceipt ? (
              <motion.div key="receipt" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-heading font-bold text-text-primary">Receipt</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
                    <button onClick={() => setShowReceipt(false)} className="p-1.5 rounded-lg hover:bg-black/5"><X className="h-4 w-4 text-text-secondary" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed" id="etr-receipt">
                  <div className="text-center border-b-2 border-dashed border-gray-300 dark:border-white/20 pb-3 mb-3">
                    <h3 className="font-bold text-sm uppercase tracking-wider">{restaurant?.name || 'MenuMoja'}</h3>
                    <p className="text-text-secondary mt-0.5">{restaurant?.address || ''}</p>
                    <p className="text-text-secondary">PIN: {restaurant?.kraPin || 'P051234567X'}</p>
                    <p className="text-text-secondary">Tel: {restaurant?.phone || ''}</p>
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-300 dark:border-white/20">
                      <p className="font-bold">ETR RECEIPT</p>
                      <p className="text-[10px] text-text-secondary">Serial: {lastPayment?.receiptNo}</p>
                      <p className="text-[10px] text-text-secondary">Date: {lastPayment?.date}</p>
                      <p className="text-[10px] text-text-secondary">Time: {lastPayment?.time}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-[10px] text-text-secondary">
                      <span>Order:</span><span>#{lastPayment?.orderNumber}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-secondary">
                      <span>Table:</span><span>{lastPayment?.table > 0 ? `T${lastPayment.table}` : 'Takeaway'}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-text-secondary">
                      <span>Payment:</span><span className="uppercase">{lastPayment?.method}</span>
                    </div>
                  </div>
                  <table className="w-full text-[11px] border-y border-dashed border-gray-300 dark:border-white/20">
                    <thead>
                      <tr className="text-text-secondary border-b border-gray-200 dark:border-white/10">
                        <th className="text-left py-1 font-normal">Item</th>
                        <th className="text-center py-1 w-8 font-normal">Qty</th>
                        <th className="text-right py-1 w-20 font-normal">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastPayment?.items?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-white/5 last:border-0">
                          <td className="py-1 text-text-primary">{item.name}</td>
                          <td className="py-1 text-center">{item.quantity}</td>
                          <td className="py-1 text-right">{formatKES(item.price * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-b border-dashed border-gray-300 dark:border-white/20 pb-2 mt-2 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-text-secondary">Subtotal</span>
                      <span>{formatKES(lastPayment?.subtotal || 0)}</span>
                    </div>
                    {lastPayment?.discount > 0 && (
                      <div className="flex justify-between text-[11px] text-success">
                        <span>Discount</span>
                        <span>-{formatKES(lastPayment.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] text-text-secondary">
                      <span>VAT (16%)</span>
                      <span>{formatKES(Math.round((lastPayment?.total || 0) * 0.16 / 1.16))}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200 dark:border-white/10">
                      <span>TOTAL</span>
                      <span>{formatKES(lastPayment?.total || 0)}</span>
                    </div>
                  </div>
                  {lastPayment?.method === 'cash' && (
                    <div className="border-b border-dashed border-gray-300 dark:border-white/20 pb-2 mt-2 space-y-1 text-[11px]">
                      <div className="flex justify-between"><span className="text-text-secondary">Cash Received</span><span>{formatKES(lastPayment.cashReceived)}</span></div>
                      <div className="flex justify-between font-bold text-success"><span>Change Due</span><span>{formatKES(lastPayment.change)}</span></div>
                    </div>
                  )}
                  <div className="text-center mt-3 pt-3 border-t-2 border-dashed border-gray-300 dark:border-white/20">
                    <p className="text-[10px] text-text-secondary">Goods once sold cannot be returned</p>
                    <p className="text-[10px] text-text-secondary">Thank you for your business!</p>
                    <p className="text-[9px] text-text-secondary mt-1">Served by: {localStorage.getItem('staffName') || 'Cashier'}</p>
                    <p className="text-[9px] text-text-secondary font-bold mt-2">ETR PIN: {restaurant?.kraPin || 'P051234567X'}</p>
                  </div>
                </div>
                <div className="p-4 border-t border-white/10">
                  <Button fullWidth size="sm" onClick={() => setShowReceipt(false)}>Close Receipt</Button>
                </div>
              </motion.div>
            ) : selectedOrder ? (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="font-heading font-bold text-text-primary dark:text-white">
                    #{selectedOrder.orderNumber}
                  </h3>
                  <button onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-lg hover:bg-black/5">
                    <X className="h-4 w-4 text-text-secondary" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span>{selectedOrder.tableNumber > 0 ? `Table ${selectedOrder.tableNumber}` : 'Takeaway'}</span>
                    <span>·</span>
                    <span>{timeAgo(selectedOrder.createdAt)}</span>
                  </div>

                  <div className="space-y-2">
                    {selectedOrder.items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary shrink-0">
                            {item.quantity}
                          </span>
                          <span className="text-sm text-text-primary dark:text-white truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-text-primary dark:text-white/80 shrink-0 ml-2">
                          {formatKES(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Subtotal</span>
                      <span className="font-medium">{formatKES(selectedOrder.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0))}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-secondary">Discount</span>
                      <Input value={discount} onChange={(e) => setDiscount(e.target.value)}
                        placeholder="0" type="number" containerClassName="w-24" />
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
                      <span>Total Due</span>
                      <span className="text-secondary">{formatKES(orderTotal)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-500' },
                        { id: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-500' },
                        { id: 'mpesa', label: 'M-Pesa', icon: Smartphone, color: 'text-secondary' },
                      ] as const).map((m) => (
                        <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                          className={`flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium transition-colors ${
                            paymentMethod === m.id ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary'
                          }`}>
                          <m.icon className={`h-5 w-5 ${paymentMethod === m.id ? 'text-white' : m.color}`} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div>
                      <Input label="Cash Received" type="number" value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        icon={<Banknote className="h-4 w-4" />} />
                      {parseFloat(cashReceived) >= orderTotal && (
                        <div className="mt-2 p-3 rounded-xl bg-success/10 text-success">
                          <span className="text-xs">Change Due:</span>
                          <span className="text-xl font-bold ml-2">{formatKES(change)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-white/10">
                  <Button fullWidth size="lg" loading={processing}
                    disabled={paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < orderTotal)}
                    onClick={handlePayment}
                    icon={<CheckCircle className="h-5 w-5" />}>
                    Process Payment · {formatKES(orderTotal)}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center justify-center p-8">
                <div className="text-center text-text-secondary/40">
                  <Calculator className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="font-accent text-sm">Select an order</p>
                  <p className="text-xs mt-1">Tap any order on the left to process payment</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
