import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'

export function PopularItems() {
  const categories = useStore((s) => s.categories)

  const items = categories
    .flatMap((c) => c.items)
    .map((item) => ({
      ...item,
      orderCount: Math.floor(Math.random() * 80) + 10,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 8)

  const maxCount = items[0]?.orderCount || 1

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">Popular Items</h3>
        <Badge variant="default" size="sm">{items.length} items</Badge>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group flex items-center gap-3 rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-accent text-xs font-bold ${
              i === 0
                ? 'bg-gradient-to-br from-accent to-yellow-400 text-primary'
                : i === 1
                  ? 'bg-gray-200 dark:bg-white/10 text-text-secondary dark:text-white/60'
                  : i === 2
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-black/5 dark:bg-white/5 text-text-secondary dark:text-white/50'
            }`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-sm font-medium text-text-primary dark:text-white truncate">{item.name}</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.orderCount / maxCount) * 100}%` }}
                  transition={{ duration: 1, delay: i * 0.05 }}
                  className={`h-full rounded-full ${
                    i === 0
                      ? 'bg-gradient-to-r from-accent to-yellow-400'
                      : 'bg-secondary/60'
                  }`}
                />
              </div>
            </div>
            <span className="font-accent text-sm font-bold text-secondary shrink-0">
              {item.orderCount}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
