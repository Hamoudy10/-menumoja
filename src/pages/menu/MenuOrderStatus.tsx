import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, ChefHat, Package, ArrowLeft, Home } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import * as ordersApi from '@/api/orders'

const steps = [
  { id: 'new', label: 'Order Received', icon: Clock },
  { id: 'preparing', label: 'Preparing', icon: ChefHat },
  { id: 'ready', label: 'Ready to Serve', icon: Package },
  { id: 'served', label: 'Served', icon: CheckCircle },
]

export default function MenuOrderStatus() {
  const { restaurantSlug, id } = useParams()
  const navigate = useNavigate()
  const { orders } = useStore()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const fetchOrder = async () => {
      try {
        const existing = orders.find(o => o.id === id)
        if (existing) {
          if (!cancelled) {
            setOrder(existing)
            setLoading(false)
          }
          return
        }
        const data = await ordersApi.getOrderStatus(id)
        if (!cancelled) {
          setOrder(data.order || data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError('Order not found')
          setLoading(false)
        }
      }
    }

    fetchOrder()
    const pollInterval = setInterval(fetchOrder, 10000)
    return () => {
      cancelled = true
      clearInterval(pollInterval)
    }
  }, [id, orders])

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="font-accent text-xs text-text-secondary">Loading order status...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-heading font-bold text-primary mb-2">Order not found</h2>
          <p className="text-text-secondary mb-6">This order doesn't seem to exist</p>
          <Button variant="primary" onClick={() => navigate(`/menu/${restaurantSlug}`)}>
            Back to Menu
          </Button>
        </div>
      </div>
    )
  }

  const currentStepIndex = steps.findIndex(s => s.id === order.status)

  return (
    <div className="min-h-screen bg-background-light">
      <header className="bg-white border-b border-gray-100 shadow-soft">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/menu/${restaurantSlug}`)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="font-heading font-bold text-primary text-lg">Order Status</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft text-center mb-6"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="w-8 h-8 text-success" />
          </motion.div>
          <h2 className="text-xl font-heading font-bold text-primary mb-1">
            Order #{order.orderNumber || order.id?.slice(-4)}
          </h2>
          <p className="text-text-secondary text-sm">Thank you! Your order is being processed.</p>
        </motion.div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft mb-6">
          <div className="space-y-6">
            {steps.map((step, i) => {
              const Icon = step.icon
              const isComplete = i <= currentStepIndex
              const isCurrent = i === currentStepIndex
              return (
                <div key={step.id} className="flex items-center gap-4">
                  <div className="relative flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isComplete ? 'bg-success text-white' : 'bg-gray-100 text-text-secondary'
                    } ${isCurrent ? 'ring-4 ring-success/20' : ''}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-0.5 h-8 mt-1 ${isComplete ? 'bg-success' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isComplete ? 'text-primary' : 'text-text-secondary'}`}>{step.label}</p>
                    <p className="text-xs text-text-secondary/60">
                      {isCurrent ? 'In progress...' : isComplete ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {order.items && order.items.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft mb-6">
            <h3 className="text-sm font-semibold text-primary mb-3">Order Summary</h3>
            <div className="space-y-2">
              {order.items.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{item.quantity}x {item.name}</span>
                  <span className="font-medium text-primary">KES {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
              <span className="font-semibold text-primary">Total</span>
              <span className="font-bold text-secondary">KES {order.total?.toLocaleString() || 0}</span>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          fullWidth
          icon={<Home className="w-5 h-5" />}
          onClick={() => navigate(`/menu/${restaurantSlug}`)}
        >
          Back to Menu
        </Button>
      </main>
    </div>
  )
}
