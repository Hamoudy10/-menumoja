import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'
import type { Order } from '@/types'

const statusConfig = {
  new: { label: 'New', variant: 'info' as const, color: 'border-l-blue-500' },
  preparing: { label: 'Preparing', variant: 'warning' as const, color: 'border-l-amber-500' },
  ready: { label: 'Ready', variant: 'success' as const, color: 'border-l-green-500' },
  served: { label: 'Served', variant: 'default' as const, color: 'border-l-gray-400' },
}

export function OrderCard({ order, onStatusChange }: { order: Order; onStatusChange?: (id: string, status: Order['status']) => void }) {
  const [elapsed, setElapsed] = useState('')
  const [flash, setFlash] = useState(false)
  const updateOrderStatus = useStore((s) => s.updateOrderStatus)

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(order.createdAt).getTime()
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsed(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [order.createdAt])

  useEffect(() => {
    if (order.status === 'new') {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 3000)
      return () => clearTimeout(t)
    }
  }, [order.status])

  const handleStatusClick = () => {
    const flow: Order['status'][] = ['new', 'preparing', 'ready', 'served']
    const idx = flow.indexOf(order.status)
    if (idx < flow.length - 1) {
      const next = flow[idx + 1]
      updateOrderStatus(order.id, next)
      onStatusChange?.(order.id, next)
    }
  }

  const cfg = statusConfig[order.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        borderColor: flash ? '#FF6B35' : undefined,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`group relative cursor-pointer rounded-2xl bg-white dark:bg-primary-light border border-white/10 border-l-4 ${cfg.color} p-4 shadow-soft hover:shadow-warm transition-all`}
      onClick={handleStatusClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-text-primary dark:text-white">
            T{tableNumberLabel(order.tableNumber)}
          </span>
          <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
        </div>
        <div className="flex items-center gap-1.5 font-accent text-xs text-text-secondary dark:text-white/50 tabular-nums">
          <Clock className="h-3 w-3" />
          {elapsed}
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="font-body text-text-primary dark:text-white/80">
              {item.quantity}x {item.name}
            </span>
            <span className="font-accent text-text-secondary dark:text-white/50">
              KES {(item.price * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="font-accent text-sm font-bold text-primary dark:text-white">
          KES {order.total.toLocaleString()}
        </span>
        <span className="flex items-center gap-1 text-xs text-secondary opacity-0 group-hover:opacity-100 transition-opacity font-accent">
          Click to advance <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  )
}

function tableNumberLabel(n: number): string {
  if (n <= 0) return '??'
  return n < 10 ? `0${n}` : `${n}`
}
