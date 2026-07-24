import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Smartphone, Banknote, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/dashboard/StatCard'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="rounded-xl bg-white dark:bg-primary-light border border-white/10 p-3 shadow-soft">
      <p className="font-accent text-xs text-text-secondary dark:text-white/50 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm font-accent">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-bold text-text-primary dark:text-white">KES {entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function PaymentsPage() {
  const transactions = useStore((s) => s.transactions)

  const totals = useMemo(() => {
    const mpesaTotal = transactions.filter((t) => t.method === 'mpesa' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
    const cashTotal = transactions.filter((t) => t.method === 'cash' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
    const cardTotal = transactions.filter((t) => t.method === 'card' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
    const pending = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + t.amount, 0)
    return { total: mpesaTotal + cashTotal + cardTotal, mpesaTotal, cashTotal, cardTotal, pending }
  }, [transactions])

  const hourlyData = useMemo(() => {
    const hours: Record<number, { mpesa: number; cash: number; card: number }> = {}
    for (let h = 7; h <= 23; h++) {
      hours[h] = { mpesa: 0, cash: 0, card: 0 }
    }
    transactions.filter((t) => t.status === 'confirmed').forEach((t) => {
      const h = new Date(t.createdAt).getHours()
      if (hours[h]) hours[h][t.method] += t.amount
    })
    return Object.entries(hours).map(([hour, data]) => ({
      time: `${hour.padStart(2, '0')}:00`,
      ...data,
    }))
  }, [transactions])

  const pieData = [
    { name: 'M-Pesa', value: totals.mpesaTotal, color: '#3B82F6' },
    { name: 'Cash', value: totals.cashTotal, color: '#FF6B35' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Payments</h1>
        <p className="font-body text-sm text-text-secondary dark:text-white/50">Track transactions and reconcile payments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="h-6 w-6" />} label="Today's Total" value={totals.total} prefix="KES " trend={15} trendLabel="vs yesterday" color="secondary" />
        <StatCard icon={<Smartphone className="h-6 w-6" />} label="M-Pesa Total" value={totals.mpesaTotal} prefix="KES " trend={22} trendLabel="vs yesterday" color="success" />
        <StatCard icon={<Banknote className="h-6 w-6" />} label="Cash Total" value={totals.cashTotal} prefix="KES " trend={-5} trendLabel="vs yesterday" color="primary" />
        <StatCard icon={<Clock className="h-6 w-6" />} label="Pending" value={totals.pending} prefix="KES " trend={0} trendLabel="vs yesterday" color="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Live Transactions</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {transactions.length === 0 ? (
                <p className="text-center font-body text-sm text-text-secondary dark:text-white/40 py-8">No transactions</p>
              ) : (
                transactions.map((tx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 rounded-xl p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      tx.method === 'mpesa' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'
                    }`}>
                      {tx.method === 'mpesa' ? <Smartphone className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-text-primary dark:text-white">
                        {tx.method === 'mpesa' ? `M-Pesa ${tx.reference}` : 'Cash Payment'}
                      </p>
                      <p className="font-accent text-xs text-text-secondary dark:text-white/50">
                        Table {tx.tableNumber} · {new Date(tx.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-accent text-sm font-bold text-text-primary dark:text-white">KES {tx.amount.toLocaleString()}</p>
                      <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'pending' ? 'warning' : 'danger'} size="sm">
                        {tx.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Payment Split</h3>
            <div className="flex items-center justify-center h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1500}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="font-accent text-xs text-text-secondary dark:text-white/50">{entry.name}: {((entry.value / (totals.total || 1)) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Hourly Breakdown</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fontFamily: 'Space Grotesk' }} stroke="rgba(255,255,255,0.2)" />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'Space Grotesk' }} stroke="rgba(255,255,255,0.2)" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="mpesa" name="M-Pesa" fill="#3B82F6" radius={[4, 4, 0, 0]} animationBegin={0} animationDuration={1500} />
                  <Bar dataKey="cash" name="Cash" fill="#FF6B35" radius={[4, 4, 0, 0]} animationBegin={300} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
        <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Cash Reconciliation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
            <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase tracking-wider">Expected Cash</p>
            <p className="font-heading text-2xl font-bold text-text-primary dark:text-white mt-1">KES {totals.cashTotal.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
            <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase tracking-wider">Declared Cash</p>
            <p className="font-heading text-2xl font-bold text-text-primary dark:text-white mt-1">KES {totals.cashTotal.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-success/10 p-4">
            <p className="font-accent text-xs text-success uppercase tracking-wider">Variance</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-heading text-2xl font-bold text-success">KES 0</p>
              <span className="flex items-center gap-0.5 text-xs font-accent text-success">
                <CheckCircleIcon className="h-3 w-3" /> Matched
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckCircleIcon(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  )
}
