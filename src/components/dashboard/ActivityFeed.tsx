import { motion } from 'framer-motion'
import { ShoppingBag, Wallet, ScanLine, Star, Bot, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Activity {
  id: string
  type: 'order' | 'payment' | 'scan' | 'review' | 'ai'
  message: string
  timestamp: string
}

const now = Date.now()

const activities: Activity[] = [
  { id: 'a1', type: 'order', message: 'New order at Table 05 - KES 2,000', timestamp: new Date(now - 180000).toISOString() },
  { id: 'a2', type: 'payment', message: 'M-Pesa payment KES 650 confirmed', timestamp: new Date(now - 600000).toISOString() },
  { id: 'a3', type: 'scan', message: 'Menu scanned at Table 08', timestamp: new Date(now - 900000).toISOString() },
  { id: 'a4', type: 'review', message: '5★ review from Sarah M.', timestamp: new Date(now - 1500000).toISOString() },
  { id: 'a5', type: 'ai', message: 'AI post scheduled for Instagram', timestamp: new Date(now - 2000000).toISOString() },
  { id: 'a6', type: 'order', message: 'Order ready at Table 03', timestamp: new Date(now - 3000000).toISOString() },
  { id: 'a7', type: 'payment', message: 'Cash payment KES 1,800 confirmed', timestamp: new Date(now - 3600000).toISOString() },
]

const iconMap = {
  order: { icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  payment: { icon: Wallet, color: 'text-success', bg: 'bg-green-100 dark:bg-green-900/30' },
  scan: { icon: ScanLine, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  review: { icon: Star, color: 'text-accent', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  ai: { icon: Bot, color: 'text-secondary', bg: 'bg-orange-100 dark:bg-orange-900/30' },
}

export function ActivityFeed() {
  return (
    <div>
      <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Activity Feed</h3>
      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-black/10 dark:bg-white/10" />
        <div className="space-y-0">
          {activities.map((activity, i) => {
            const cfg = iconMap[activity.type]
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative flex items-start gap-3 py-2 pl-0"
              >
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                  <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="font-body text-sm text-text-primary dark:text-white/80">{activity.message}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-text-secondary dark:text-white/40" />
                    <span className="font-accent text-[11px] text-text-secondary dark:text-white/40">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
