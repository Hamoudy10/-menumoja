import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Store, ShoppingCart, DollarSign, UserPlus, TrendingDown, Activity,
  ArrowUp, ArrowDown, Loader2, AlertTriangle,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/Skeleton'
import { showErrorToast } from '@/components/ui/Toast'
import * as adminApi from '@/api/admin'

export default function AdminOverview() {
  const [stats, setStats] = useState<any>(null)
  const [revenue, setRevenue] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([adminApi.fetchAdminStats(), adminApi.fetchAdminRevenue()])
      .then(([s, r]) => {
        if (cancelled) return
        if (s.status === 'fulfilled') setStats(s.value)
        if (r.status === 'fulfilled') setRevenue(r.value)
      })
      .catch(() => { if (!cancelled) showErrorToast('Failed to load platform data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
        <Skeleton variant="card" className="h-80" />
      </div>
    )
  }

  const mrrChart = (revenue?.mrrChart || []).map((m: any) => ({ ...m, mrr: Number(m.mrr || 0) }))
  const planRevenue = revenue?.revenueByPlan || []
  const upcomingRenewals = revenue?.upcomingRenewals || []

  const cards = [
    { label: 'Restaurants', value: stats?.totalRestaurants ?? 0, icon: <Store className="h-5 w-5" />, sub: `${stats?.activeRestaurants ?? 0} active`, accent: 'text-secondary' },
    { label: 'Suspended', value: stats?.suspendedRestaurants ?? 0, icon: <AlertTriangle className="h-5 w-5" />, sub: stats?.churnRate ? `${Number(stats.churnRate).toFixed(1)}% churn` : '', accent: 'text-red-500' },
    { label: 'Total Orders', value: (stats?.totalOrders ?? 0).toLocaleString(), icon: <ShoppingCart className="h-5 w-5" />, sub: stats?.newThisMonth ? `+${stats.newThisMonth} this month` : '', accent: 'text-blue-500' },
    { label: 'MRR', value: `KES ${(Number(stats?.mrr ?? 0)).toLocaleString()}`, icon: <DollarSign className="h-5 w-5" />, sub: 'monthly recurring revenue', accent: 'text-success' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <div className={`flex items-center gap-2 ${c.accent}`}>{c.icon}<span className="font-accent text-xs uppercase tracking-wider text-text-secondary">{c.label}</span></div>
            <p className="font-heading text-2xl font-bold text-text-primary dark:text-white mt-2">{c.value}</p>
            <p className="text-[11px] text-text-secondary mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">MRR Trend (12 months)</h3>
          <div className="h-64">
            {mrrChart.length === 0 ? (
              <p className="text-sm text-text-secondary text-center pt-24">No revenue history yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrChart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip />
                  <Line type="monotone" dataKey="mrr" stroke="#FF6B35" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Revenue by Plan</h3>
          <div className="h-64">
            {planRevenue.length === 0 ? (
              <p className="text-sm text-text-secondary text-center pt-24">No plan data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planRevenue} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="planName" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip />
                  <Bar dataKey="monthlyRevenue" name="Monthly revenue" fill="#FF6B35" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {planRevenue.length > 0 && (
            <div className="flex justify-center gap-6 mt-2">
              {planRevenue.map((p: any) => (
                <span key={p.planName} className="text-xs text-text-secondary">{p.planName}: <b className="text-text-primary">{p.subscriberCount}</b> · KES {Number(p.monthlyRevenue).toLocaleString()}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {upcomingRenewals.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-3">Upcoming Renewals (30 days)</h3>
          <div className="space-y-1.5">
            {upcomingRenewals.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                <span className="text-text-primary dark:text-white">{r.name}</span>
                <span className="text-text-secondary">{r.planName} · expires {new Date(r.planExpiresAt).toLocaleDateString('en-KE')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
