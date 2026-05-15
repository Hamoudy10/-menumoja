import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/Badge'

const revenueByPlanDonut = [
  { name: 'Starter', value: 850000, color: '#6B7280', restaurants: 145 },
  { name: 'Business', value: 1200000, color: '#FF6B35', restaurants: 78 },
  { name: 'Premium', value: 650000, color: '#FFD700', restaurants: 24 },
]

const mrrTrend = [
  { month: 'Jan', mrr: 1800000, previous: 1500000 },
  { month: 'Feb', mrr: 1950000, previous: 1650000 },
  { month: 'Mar', mrr: 2100000, previous: 1800000 },
  { month: 'Apr', mrr: 2250000, previous: 1950000 },
  { month: 'May', mrr: 2400000, previous: 2100000 },
  { month: 'Jun', mrr: 2600000, previous: 2250000 },
  { month: 'Jul', mrr: 2750000, previous: 2400000 },
  { month: 'Aug', mrr: 2900000, previous: 2550000 },
  { month: 'Sep', mrr: 3100000, previous: 2700000 },
  { month: 'Oct', mrr: 3250000, previous: 2850000 },
  { month: 'Nov', mrr: 3400000, previous: 3000000 },
  { month: 'Dec', mrr: 2300000, previous: 3200000 },
]

const newVsCancel = [
  { month: 'Jan', new: 22, cancellations: 4 },
  { month: 'Feb', new: 25, cancellations: 3 },
  { month: 'Mar', new: 28, cancellations: 5 },
  { month: 'Apr', new: 30, cancellations: 4 },
  { month: 'May', new: 35, cancellations: 6 },
  { month: 'Jun', new: 32, cancellations: 5 },
  { month: 'Jul', new: 38, cancellations: 7 },
  { month: 'Aug', new: 40, cancellations: 6 },
  { month: 'Sep', new: 36, cancellations: 8 },
  { month: 'Oct', new: 42, cancellations: 5 },
  { month: 'Nov', new: 45, cancellations: 7 },
  { month: 'Dec', new: 18, cancellations: 12 },
]

const renewals = [
  { restaurant: 'Savannah Bistro', plan: 'premium', amount: 55000, date: '2026-01-15', status: 'upcoming' },
  { restaurant: 'Bahari Restaurant', plan: 'business', amount: 35000, date: '2026-01-18', status: 'upcoming' },
  { restaurant: 'Riverside Kitchen', plan: 'business', amount: 35000, date: '2026-01-22', status: 'upcoming' },
  { restaurant: 'The Golden Wok', plan: 'business', amount: 35000, date: '2026-01-25', status: 'upcoming' },
  { restaurant: 'Coastal Delights', plan: 'premium', amount: 55000, date: '2026-02-01', status: 'upcoming' },
  { restaurant: 'Mountain View Cafe', plan: 'starter', amount: 15000, date: '2026-02-05', status: 'upcoming' },
  { restaurant: 'Spice Garden', plan: 'business', amount: 35000, date: '2026-02-10', status: 'overdue' },
]

const formatKES = (value: number) => {
  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `KES ${(value / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K`
  return `KES ${value}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-primary-light border border-white/10 rounded-xl p-3 shadow-xl">
        <p className="text-white text-xs mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.name.includes('KES') || entry.dataKey === 'mrr' ? formatKES(entry.value) : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AdminSubscriptions() {
  const [animate, setAnimate] = useState(false)
  useEffect(() => { setAnimate(true) }, [])

  const currentMRR = 2700000
  const previousMRR = 2400000
  const mrrChange = ((currentMRR - previousMRR) / previousMRR) * 100
  const totalRevenue = revenueByPlanDonut.reduce((s, p) => s + p.value, 0)
  const totalRestaurants = revenueByPlanDonut.reduce((s, p) => s + p.restaurants, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Subscriptions</h1>
        <p className="text-sm text-white/50">Platform revenue and subscription management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">Monthly Recurring Revenue</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
              <DollarSign className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-heading font-bold text-white">{formatKES(currentMRR)}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`flex items-center gap-0.5 text-xs font-medium ${mrrChange >= 0 ? 'text-success' : 'text-red-400'}`}>
              {mrrChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {mrrChange.toFixed(1)}%
            </span>
            <span className="text-xs text-white/40">vs last month</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">Active Subscriptions</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-success to-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-heading font-bold text-white">{totalRestaurants}</p>
          <p className="text-xs text-white/40 mt-2">Across all plan tiers</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">Upcoming Renewals</p>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <p className="text-3xl font-heading font-bold text-white">{renewals.filter(r => r.status === 'upcoming').length}</p>
          <p className="text-xs text-white/40 mt-2">Next 30 days</p>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Revenue by Plan Tier</h3>
          <div className="flex items-center gap-8">
            <div className="shrink-0">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={revenueByPlanDonut}
                    cx="50%" cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="none"
                  >
                    {revenueByPlanDonut.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {revenueByPlanDonut.map((plan, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
                      <span className="text-sm text-white/80">{plan.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{((plan.value / totalRevenue) * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-white/40">{plan.restaurants} restaurants • {formatKES(plan.value)}/mo</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">New Subscriptions vs Cancellations</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={newVsCancel}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="new" stroke="#2ECC71" strokeWidth={2} dot={{ fill: '#2ECC71', r: 3 }} name="New" />
              <Line type="monotone" dataKey="cancellations" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 3 }} name="Cancelled" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-primary-light border border-white/5 rounded-2xl p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-4">Upcoming Renewals</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-3 py-2.5 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Restaurant</th>
                <th className="text-left px-3 py-2.5 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Plan</th>
                <th className="text-right px-3 py-2.5 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Amount</th>
                <th className="text-right px-3 py-2.5 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Due Date</th>
                <th className="text-right px-3 py-2.5 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {renewals.map((r, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="px-3 py-3">
                    <span className="text-sm text-white font-medium">{r.restaurant}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={r.plan === 'premium' ? 'info' : r.plan === 'business' ? 'warning' : 'default'} size="sm">
                      {r.plan.charAt(0).toUpperCase() + r.plan.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatKES(r.amount)}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-white/70">{r.date}</td>
                  <td className="px-3 py-3 text-right">
                    <Badge variant={r.status === 'overdue' ? 'danger' : 'warning'} size="sm" dot>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
