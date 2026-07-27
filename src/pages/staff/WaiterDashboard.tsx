import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  ClipboardList, Clock, CheckCircle2, AlertTriangle, AlertCircle,
  UtensilsCrossed, ArrowLeft, Loader2, X, MessageSquare,
  ThumbsUp, FileText, Camera, Upload, Image, User
} from 'lucide-react'
import { fetchLiveOrders, updateOrderStatus } from '@/api/orders'
import api from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'

const statusLabels: Record<string, string> = {
  PENDING: 'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

const paymentStatusColors: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  UNPAID: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
}

interface ComplaintForm {
  orderId: string
  type: 'complaint' | 'refund' | 'additional_order'
  description: string
  evidence: string[]
}

export default function WaiterDashboard() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'served'>('active')
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [showComplaint, setShowComplaint] = useState(false)
  const [complaintForm, setComplaintForm] = useState<ComplaintForm>({ orderId: '', type: 'complaint', description: '', evidence: [] })
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [servedOrders, setServedOrders] = useState<any[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadOrders = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [live, historyRes] = await Promise.all([
        fetchLiveOrders(),
        api.get('/orders/history', { params: { perPage: 50 } }),
      ])
      setOrders(Array.isArray(live) ? live : [])
      const histData = historyRes.data
      const hist = histData?.data || histData || []
      setServedOrders(Array.isArray(hist) ? hist : [])
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to load orders'
      setLoadError(msg)
      showErrorToast(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders(); const iv = setInterval(loadOrders, 15000); return () => clearInterval(iv) }, [])

  const handleMarkServed = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      await updateOrderStatus(orderId, 'SERVED')
      showSuccessToast('Order marked as served')
      loadOrders()
    } catch {
      showErrorToast('Failed to mark as served')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSubmitComplaint = async () => {
    if (!complaintForm.description) return
    try {
      await api.post(`/orders/${complaintForm.orderId}/complaint`, {
        type: complaintForm.type,
        description: complaintForm.description,
        evidence: complaintForm.evidence,
      })
      showSuccessToast('Complaint submitted')
      setShowComplaint(false)
      setComplaintForm({ orderId: '', type: 'complaint', description: '', evidence: [] })
    } catch {
      showErrorToast('Failed to submit complaint')
    }
  }

  const staffRole = localStorage.getItem('staffRole')
  const staffName = localStorage.getItem('staffName')

  const openComplaint = (order: any) => {
    setComplaintForm({ orderId: order.id, type: 'complaint', description: '', evidence: [] })
    setSelectedOrder(null)
    setShowComplaint(true)
  }

  const OrderCard = ({ order }: { order: any }) => {
    const items = order.items || []
    const paymentStatus = order.paymentStatus || 'UNPAID'
    const totalAmount = order.totalAmount || order.total || 0

    return (
      <motion.div layout className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-primary">Table {order.tableNumber || '?'}</h3>
                <span className="text-xs text-text-secondary">#{order.orderNumber}</span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : ''}
                {order.estimatedPrepMinutes ? ` · ~${order.estimatedPrepMinutes}min` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[order.status] || 'bg-gray-100'}>{statusLabels[order.status] || order.status}</Badge>
              <Badge className={paymentStatusColors[paymentStatus] || 'bg-gray-100'}>{paymentStatus}</Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">{item.quantity}x</span>
                  <span className="text-primary font-medium">{item.itemName || item.name}</span>
                </div>
                <span className="text-text-secondary">KES {Number(item.itemPrice || item.price || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {order.specialNotes && (
            <p className="text-xs text-text-secondary bg-gray-50 rounded-xl p-2">{order.specialNotes}</p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <span className="font-bold text-secondary">KES {Number(totalAmount).toLocaleString()}</span>
            <div className="flex items-center gap-2">
              {order.status !== 'SERVED' && order.status !== 'CANCELLED' && (
                <>
                  {order.status === 'READY' && (
                    <Button size="sm" variant="primary" loading={updatingId === order.id} onClick={() => handleMarkServed(order.id)}>
                      <CheckCircle2 className="w-4 h-4" /> Serve
                    </Button>
                  )}
                  <button onClick={() => openComplaint(order)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50" title="Complaint / Refund">
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </>
              )}
              <button onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)} className="text-xs text-secondary font-medium">
                {selectedOrder?.id === order.id ? 'Less' : 'Details'}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {selectedOrder?.id === order.id && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-50 bg-gray-50/50">
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Order ID</span><span className="text-primary font-mono text-xs">{order.id}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Payment Method</span><span className="text-primary">{order.paymentMethod || 'N/A'}</span></div>
                {order.waiterName && <div className="flex justify-between"><span className="text-text-secondary">Waiter</span><span className="text-primary">{order.waiterName}</span></div>}
                {order.servedAt && <div className="flex justify-between"><span className="text-text-secondary">Served at</span><span className="text-primary">{new Date(order.servedAt).toLocaleString()}</span></div>}
                {order.specialNotes && <div className="pt-2"><span className="text-text-secondary">Notes: </span><span>{order.specialNotes}</span></div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const displayedOrders = activeTab === 'active' ? orders : servedOrders

  return (
    <div className="min-h-screen bg-background-light">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-soft">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/staff/login')} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-primary text-lg">Waiter Dashboard</h1>
            {staffName && <p className="text-xs text-text-secondary">Welcome, {staffName}</p>}
          </div>
          <button onClick={() => navigate('/staff/profile')} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <User className="w-4 h-4 text-text-secondary" />
          </button>
          <button onClick={loadOrders} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center" disabled={loading}>
            <Loader2 className={`w-4 h-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center gap-2">
          <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-secondary text-white' : 'bg-gray-100 text-text-secondary'}`}>
            Active ({orders.length})
          </button>
          <button onClick={() => setActiveTab('served')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'served' ? 'bg-secondary text-white' : 'bg-gray-100 text-text-secondary'}`}>
            Served ({servedOrders.length})
          </button>
        </div>
      </header>

      {loadError && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
            <button onClick={loadOrders} className="ml-auto text-red-600 underline text-xs shrink-0">Retry</button>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-16 h-16 text-text-secondary/30 mx-auto mb-4" />
            <h2 className="text-lg font-heading font-bold text-primary mb-2">No orders</h2>
            <p className="text-sm text-text-secondary">No {activeTab === 'active' ? 'active' : 'served'} orders yet</p>
          </div>
        ) : (
          displayedOrders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </main>

      <AnimatePresence>
        {showComplaint && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowComplaint(false)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-heading font-bold text-primary">Order Issue</h2>
                <button onClick={() => setShowComplaint(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-text-secondary" /></button>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  {(['complaint', 'refund', 'additional_order'] as const).map((type) => (
                    <button key={type} onClick={() => setComplaintForm((f) => ({ ...f, type }))}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                        complaintForm.type === type ? 'bg-secondary text-white' : 'bg-gray-100 text-text-secondary'
                      }`}>
                      {type === 'complaint' ? 'Complaint' : type === 'refund' ? 'Refund' : 'Add Order'}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Description</label>
                  <textarea value={complaintForm.description} onChange={(e) => setComplaintForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
                    rows={4} placeholder="Describe the issue..." />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Evidence (photos/videos)</label>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-text-secondary hover:bg-gray-50">
                      <Camera className="w-4 h-4" /> Take Photo
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-text-secondary hover:bg-gray-50">
                      <Upload className="w-4 h-4" /> Upload
                    </button>
                  </div>
                  {complaintForm.evidence.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {complaintForm.evidence.map((url, i) => (
                        <div key={i} className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Image className="w-6 h-6 text-text-secondary" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" fullWidth onClick={() => setShowComplaint(false)}>Cancel</Button>
                  <Button variant="primary" fullWidth disabled={!complaintForm.description} onClick={handleSubmitComplaint}>
                    Submit
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
