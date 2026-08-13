import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown, DollarSign, TrendingUp, Calendar, Loader2 } from 'lucide-react'
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { showErrorToast } from '@/components/ui/Toast'
import * as adminApi from '@/api/admin'

const formatKES = (value: number) => {
  if (!value) return 'KES 0'
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
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AdminSubscriptions() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    adminApi.fetchAdminRevenue()
      .then((r) => { if (!cancelled) setData(r) })
      .catch((err: any) => {
        if (!cancelled) showErrorToast(err?.response?.data?.message || 'Failed to load subscription data')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="card" className="h-24" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton variant="card" className="h-72" />
          <Skeleton variant="card" className="h-72" />
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    )
  }

  const currentMRR = Number(data?.mrr ?? 0)
  const previousMRR = Number(data?.previousMrr ?? currentMRR)
  const mrrChange = previousMRR > 0 ? ((currentMRR - previousMRR) / previousMRR) * 100 : 0
  const planRevenue = (data?.revenueByPlan || []) as any[]
  const totalRevenue = planRevenue.reduce((s: number, p: any) => s + Number(p.monthlyRevenue || 0), 0)
  const totalRestaurants = planRevenue.reduce((s: number, p: any) => s + Number(p.subscriberCount || 0), 0)
  const renewals = (data?.upcomingRenewals || []) as any[]
  const newVsCancel = (data?.newVsCancel || []) as any[]

  const donut = planRevenue.map((p: any, i: number) => ({
    name: p.planName,
    value: Number(p.monthlyRevenue || 0),
    restaurants: p.subscriberCount,
    color: i === 0 ? '#6B7280' : i === 1 ? 'var(--color-secondary)' : 'var(--color-accent)',
  }))

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
              <DollarSign className="w-4 h-4 text-white" />
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
              <TrendingUp className="w-4 h-4 text-white" />
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
            <div className="w-9 h-9 rounded-xl grad-brand flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-3xl font-heading font-bold text-white">{renewals.length}</p>
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
          {donut.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-16">No paid subscriptions yet</p>
          ) : (
            <div className="flex items-center gap-8">
              <div className="shrink-0">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={donut}
                      cx="50%" cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      stroke="none"
                    >
                      {donut.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {donut.map((plan, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
                        <span className="text-sm text-white/80">{plan.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{totalRevenue > 0 ? ((plan.value / totalRevenue) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <p className="text-xs text-white/40">{plan.restaurants} restaurants • {formatKES(plan.value)}/mo</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">New Subscriptions vs Cancellations</h3>
          {newVsCancel.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-16">No subscription activity yet</p>
          ) : (
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
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-primary-light border border-white/5 rounded-2xl p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-4">Upcoming Renewals</h3>
        {renewals.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-10">No renewals in the next 30 days</p>
        ) : (
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
                {renewals.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-3">
                      <span className="text-sm text-white font-medium">{r.name}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={r.planName === 'premium' ? 'info' : r.planName === 'business' ? 'warning' : 'default'} size="sm">
                        {r.planName.charAt(0).toUpperCase() + r.planName.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-medium text-white">{formatKES(r.amount)}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-white/70">{new Date(r.planExpiresAt).toLocaleDateString('en-KE')}</td>
                    <td className="px-3 py-3 text-right">
                      <Badge variant="warning" size="sm" dot>
                        Upcoming
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
