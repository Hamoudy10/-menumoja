import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Clock, DollarSign } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'

const statusConfig = {
  free: { color: 'bg-success/20 border-success text-success', icon: '○', label: 'Free' },
  occupied: { color: 'bg-blue-500/20 border-blue-500 text-blue-400', icon: '●', label: 'Occupied' },
  'order-pending': { color: 'bg-amber-500/20 border-amber-500 text-amber-400', icon: '◉', label: 'Order Pending' },
  'bill-requested': { color: 'bg-red-500/20 border-red-500 text-red-400', icon: '!', label: 'Bill' },
}

export function TableMap() {
  const tables = useStore((s) => s.tables)
  const orders = useStore((s) => s.orders)
  const [selected, setSelected] = useState<number | null>(null)

  const selectedTable = tables.find((t) => t.number === selected)
  const tableOrder = selectedTable?.orderId
    ? orders.find((o) => o.id === selectedTable.orderId)
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">Table Map</h3>
        <div className="flex items-center gap-2">
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${cfg.color.split(' ')[0]}`} />
              <span className="font-accent text-[10px] text-text-secondary dark:text-white/50">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {tables.map((table) => {
          const cfg = statusConfig[table.status]
          return (
            <motion.button
              key={table.number}
              onClick={() => setSelected(table.number)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-2 transition-colors ${cfg.color} ${
                selected === table.number ? 'ring-2 ring-secondary' : ''
              }`}
            >
              <span className="font-accent text-lg font-bold">{table.number}</span>
              <span className="font-accent text-[9px] opacity-70">{cfg.label}</span>
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {selectedTable && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="mt-3 overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading font-bold text-text-primary dark:text-white">
                Table {selectedTable.number}
              </span>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                <X className="h-3 w-3 text-text-secondary" />
              </button>
            </div>
            <div className="space-y-1.5 text-sm font-body text-text-secondary dark:text-white/70">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Status: {statusConfig[selectedTable.status].label}
              </div>
              {tableOrder && (
                <>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" />
                    Total: KES {tableOrder.total.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    {tableOrder.items.length} items
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
