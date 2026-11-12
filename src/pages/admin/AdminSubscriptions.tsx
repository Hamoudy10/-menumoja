import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUp, ArrowDown, DollarSign, TrendingUp, Calendar, Loader2,
  Plus, RefreshCw, Receipt, CheckCircle2, XCircle, PlayCircle,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { showErrorToast, showSuccessToast } from '@/components/ui/Toast'
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

  // Billing / invoicing
  const [billingStats, setBillingStats] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ restaurantId: '', amountKes: '', periodEnd: '', notes: '' })
  const [payingInvoice, setPayingInvoice] = useState<any | null>(null)
  const [payForm, setPayForm] = useState<{ method: string; reference: string; notes: string }>({
    method: 'MPESA',
    reference: '',
    notes: '',
  })

  const errMsg = (err: any, fallback: string) =>
    err?.response?.data?.error?.message || err?.response?.data?.message || fallback

  useEffect(() => {
    let cancelled = false
    adminApi.fetchAdminRevenue()
      .then((r) => { if (!cancelled) setData(r) })
      .catch((err: any) => {
        if (!cancelled) showErrorToast(errMsg(err, 'Failed to load subscription data'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    adminApi.fetchAdminRestaurants({ limit: 100 })
      .then((r: any) => setRestaurants(Array.isArray(r) ? r : r?.data || []))
      .catch(() => { /* non-fatal */ })
  }, [])

  const loadBilling = useCallback(async () => {
    setInvoicesLoading(true)
    try {
      const [stats, list] = await Promise.all([
        adminApi.fetchBillingStats().catch(() => null),
        adminApi.fetchAdminInvoices(statusFilter !== 'all' ? { status: statusFilter } : {}).catch(() => ({ data: [] })),
      ])
      setBillingStats(stats)
      setInvoices(Array.isArray(list) ? list : (list as any)?.data || [])
    } finally {
      setInvoicesLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void loadBilling() }, [loadBilling])

  const handleCreateInvoice = async () => {
    if (!createForm.restaurantId) {
      showErrorToast('Select a restaurant')
      return
    }
    setBusy(true)
    try {
      await adminApi.createAdminInvoice({
        restaurantId: createForm.restaurantId,
        amountKes: createForm.amountKes ? Number(createForm.amountKes) : undefined,
        periodEnd: createForm.periodEnd ? new Date(createForm.periodEnd).toISOString() : undefined,
        notes: createForm.notes || undefined,
      })
      showSuccessToast('Invoice created')
      setShowCreate(false)
      setCreateForm({ restaurantId: '', amountKes: '', periodEnd: '', notes: '' })
      await loadBilling()
    } catch (err: any) {
      showErrorToast(errMsg(err, 'Failed to create invoice'))
    } finally {
      setBusy(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!payingInvoice) return
    setBusy(true)
    try {
      await adminApi.markAdminInvoicePaid(payingInvoice.id, {
        method: (payForm.method || 'MANUAL') as any,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
      })
      showSuccessToast('Invoice marked as paid — subscription extended')
      setPayingInvoice(null)
      setPayForm({ method: 'MPESA', reference: '', notes: '' })
      await loadBilling()
    } catch (err: any) {
      showErrorToast(errMsg(err, 'Failed to mark invoice paid'))
    } finally {
      setBusy(false)
    }
  }

  const handleVoid = async (invoice: any) => {
    if (!window.confirm(`Void invoice ${invoice.invoiceNumber}?`)) return
    setBusy(true)
    try {
      await adminApi.voidAdminInvoice(invoice.id, 'Voided by platform admin')
      showSuccessToast('Invoice voided')
      await loadBilling()
    } catch (err: any) {
      showErrorToast(errMsg(err, 'Failed to void invoice'))
    } finally {
      setBusy(false)
    }
  }

  const handleRunExpiry = async () => {
    setBusy(true)
    try {
      const result: any = await adminApi.runBillingExpiry()
      showSuccessToast(
        `Sweep done: ${result?.expiredTrials || 0} trials, ${result?.expiredPlans || 0} plans expired, ${result?.markedOverdue || 0} invoices overdue`
      )
      await loadBilling()
    } catch (err: any) {
      showErrorToast(errMsg(err, 'Expiry sweep failed'))
    } finally {
      setBusy(false)
    }
  }

  const invoiceBadge = (status: string) =>
    status === 'PAID' ? 'success' : status === 'PENDING' ? 'warning' : status === 'OVERDUE' ? 'danger' : 'default'

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

      {/* ── Billing KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total billed', value: billingStats?.totalBilledKes, icon: Receipt, color: 'from-secondary to-accent' },
          { label: 'Collected', value: billingStats?.collectedKes, icon: CheckCircle2, color: 'from-success to-emerald-400' },
          { label: 'Outstanding', value: billingStats?.outstandingKes, icon: XCircle, color: 'from-red-500 to-rose-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-primary-light border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/40">{kpi.label}</p>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center`}>
                <kpi.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-white">{formatKES(Number(kpi.value || 0))}</p>
          </div>
        ))}
        <div className="bg-primary-light border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">Invoices</p>
            <div className="w-9 h-9 rounded-xl grad-brand flex items-center justify-center">
              <Receipt className="w-4 h-4 text-white" />
            </div>
          </div>
          <p className="text-2xl font-heading font-bold text-white">{billingStats?.invoiceCount ?? invoices.length}</p>
          <p className="text-xs text-white/40 mt-2">{billingStats?.outstandingCount ?? 0} outstanding</p>
        </div>
      </div>

      {/* ── Invoices ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-primary-light border border-white/5 rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Subscription Invoices</h3>
            <p className="text-xs text-white/40 mt-1">Issue invoices, reconcile payments, and run the expiry sweep</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-primary-dark px-3 py-2 text-xs text-white outline-none focus:border-secondary"
            >
              <option value="all">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="VOID">Void</option>
            </select>
            <button
              onClick={() => void loadBilling()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white"
              disabled={invoicesLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${invoicesLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={() => void handleRunExpiry()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Run expiry sweep
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-accent font-semibold text-white hover:bg-secondary-dark"
            >
              <Plus className="w-3.5 h-3.5" /> New invoice
            </button>
          </div>
        </div>

        {invoicesLoading && invoices.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-10">Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-10">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Invoice', 'Restaurant', 'Amount', 'Period end', 'Status', ''].map((h) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider ${['Amount', 'Period end', 'Status', ''].includes(h) ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-3">
                      <span className="text-sm text-white font-medium">{inv.invoiceNumber}</span>
                      {inv.reference && <p className="text-xs text-white/40 max-w-[180px] truncate">Ref: {inv.reference}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-white/80">{inv.restaurant?.name || '—'}</span>
                      {inv.plan?.name && <p className="text-xs text-white/40">{inv.plan.name}</p>}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-medium text-white">KES {Number(inv.amountKes || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-sm text-white/70">
                      {inv.periodEnd ? new Date(inv.periodEnd).toLocaleDateString('en-KE') : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Badge variant={invoiceBadge(inv.status) as any} size="sm" dot>{inv.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(inv.status === 'PENDING' || inv.status === 'OVERDUE') ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setPayingInvoice(inv); setPayForm({ method: 'MPESA', reference: inv.reference || '', notes: '' }) }}
                            className="rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/25"
                          >
                            Mark paid
                          </button>
                          <button
                            onClick={() => void handleVoid(inv)}
                            disabled={busy}
                            className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 disabled:opacity-50"
                          >
                            Void
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Create invoice modal ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New subscription invoice" size="sm">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Restaurant</label>
            <select
              value={createForm.restaurantId}
              onChange={(e) => setCreateForm((p) => ({ ...p, restaurantId: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            >
              <option value="">Select a restaurant</option>
              {restaurants.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Amount (KES) — optional, defaults to plan price</label>
            <input
              type="number"
              value={createForm.amountKes}
              onChange={(e) => setCreateForm((p) => ({ ...p, amountKes: e.target.value }))}
              placeholder="1500"
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Due date — optional (defaults to 1 month)</label>
            <input
              type="date"
              value={createForm.periodEnd}
              onChange={(e) => setCreateForm((p) => ({ ...p, periodEnd: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Notes</label>
            <input
              type="text"
              value={createForm.notes}
              onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. November subscription"
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowCreate(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/70 hover:bg-white/5">Cancel</button>
            <button onClick={() => void handleCreateInvoice()} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-accent font-semibold text-white hover:bg-secondary-dark disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create invoice
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Mark paid modal ── */}
      <Modal open={!!payingInvoice} onClose={() => setPayingInvoice(null)} title={`Mark ${payingInvoice?.invoiceNumber || 'invoice'} paid`} size="sm">
        <div className="space-y-3">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/40">Amount</p>
            <p className="text-xl font-heading font-bold text-white">KES {Number(payingInvoice?.amountKes || 0).toLocaleString()}</p>
            <p className="text-xs text-white/40 mt-1">{payingInvoice?.restaurant?.name}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Payment method</label>
            <select
              value={payForm.method}
              onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            >
              <option value="MPESA">M-Pesa</option>
              <option value="BANK">Bank transfer</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Transaction reference</label>
            <input
              type="text"
              value={payForm.reference}
              onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
              placeholder="e.g. QWE1ABC2DE"
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-accent font-medium text-white/60">Notes</label>
            <input
              type="text"
              value={payForm.notes}
              onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded-xl border border-white/10 bg-primary-dark px-3 py-2.5 text-sm text-white outline-none focus:border-secondary"
            />
          </div>
          <p className="text-xs text-white/40">Marking paid extends the restaurant's plan to the invoice period end and reactivates it.</p>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setPayingInvoice(null)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/70 hover:bg-white/5">Cancel</button>
            <button onClick={() => void handleMarkPaid()} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success py-2.5 text-sm font-accent font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
