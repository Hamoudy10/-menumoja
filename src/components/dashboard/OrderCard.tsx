import { motion } from 'framer-motion'
import { Clock, ChefHat, CheckCircle2, CookingPot } from 'lucide-react'
import type { Order } from '@/types'

interface OrderCardProps {
  order: Order
  onStatusChange: (id: string, status: "new" | "preparing" | "ready" | "served") => void
}

type OrderStatus = 'new' | 'preparing' | 'ready' | 'served'

const statusConfig: Record<OrderStatus, { label: string; icon: any; color: string; next: OrderStatus | '' }> = {
  new: { label: 'New', icon: Clock, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', next: 'preparing' },
  preparing: { label: 'Preparing', icon: CookingPot, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', next: 'ready' },
  ready: { label: 'Ready', icon: ChefHat, color: 'bg-success/10 text-success', next: 'served' },
  served: { label: 'Served', icon: CheckCircle2, color: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60', next: '' },
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const config = statusConfig[order.status as OrderStatus] || statusConfig.new
  const StatusIcon = config.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl border border-white/10 bg-white dark:bg-primary-light p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="font-accent text-xs font-bold text-text-primary dark:text-white">
          Table {order.tableNumber}
        </span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}>
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </span>
      </div>

      <div className="space-y-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="font-body text-text-primary dark:text-white/80">
              {item.quantity}x {item.name}
            </span>
            <span className="font-accent text-text-secondary">KES {item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      {order.specialInstructions && (
        <p className="font-accent text-[10px] text-amber-500 italic">
          Note: {order.specialInstructions}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="font-accent text-xs font-bold text-secondary">
          KES {order.total.toLocaleString()}
        </span>
        {config.next && (
          <button
            onClick={() => onStatusChange(order.id, config.next as OrderStatus)}
            className="rounded-lg bg-secondary/10 px-3 py-1 text-[10px] font-accent font-medium text-secondary hover:bg-secondary/20 transition-colors"
          >
            Move to {config.next}
          </button>
        )}
      </div>
    </motion.div>
  )
}
