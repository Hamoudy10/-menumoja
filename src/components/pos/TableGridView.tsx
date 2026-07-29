import { motion } from 'framer-motion'
import { Coffee, UtensilsCrossed, Clock } from 'lucide-react'

interface TableOrder {
  id: string
  tableNumber: number
  status: string
  paymentStatus: string
  total: number
  items: any[]
  createdAt: string
}

interface TableGridViewProps {
  orders: TableOrder[]
  selectedId?: string
  onSelect: (order: TableOrder) => void
}

const statusColors: Record<string, string> = {
  PENDING: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  CONFIRMED: 'border-purple-400 bg-purple-50',
  PREPARING: 'border-amber-400 bg-amber-50',
  READY: 'border-green-400 bg-green-50',
  SERVED: 'border-gray-300 bg-gray-50',
}

export default function TableGridView({ orders, selectedId, onSelect }: TableGridViewProps) {
  const occupied = orders.filter((o) => o.paymentStatus !== 'PAID')
  const paid = orders.filter((o) => o.paymentStatus === 'PAID')

  return (
    <div className="p-4">
      {occupied.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
            Active Tables ({occupied.length})
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {occupied.map((order) => (
              <motion.button
                key={order.id}
                layout
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => onSelect(order)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all
                  ${selectedId === order.id ? 'ring-2 ring-secondary border-secondary' : statusColors[order.status] || 'border-gray-200'}
                  hover:shadow-md active:scale-95`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg font-bold text-text-primary">
                    T{order.tableNumber}
                  </span>
                  <Clock className="w-3 h-3 text-text-secondary" />
                </div>
                <div className="text-xs text-text-secondary">
                  {order.items.reduce((s, i) => s + i.quantity, 0)} items
                </div>
                <div className="text-sm font-bold text-secondary mt-1">
                  KES {Number(order.total).toLocaleString()}
                </div>
                {order.status === 'READY' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-ping" />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}
      {paid.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">
            Paid Tables ({paid.length})
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {paid.map((order) => (
              <button
                key={order.id}
                onClick={() => onSelect(order)}
                className="rounded-xl border border-gray-200 dark:border-white/10 p-3 text-left opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-text-primary">
                    T{order.tableNumber}
                  </span>
                  <UtensilsCrossed className="w-3 h-3 text-success" />
                </div>
                <div className="text-xs text-text-secondary">
                  {formatTimeAgo(order.createdAt)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {occupied.length === 0 && paid.length === 0 && (
        <div className="text-center py-12 text-text-secondary/50">
          <Coffee className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">All tables empty</p>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}
