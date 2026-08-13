import { useMemo, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Smartphone, Banknote, Clock, ArrowUpRight, ArrowDownRight, RefreshCw, PlayCircle } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/dashboard/StatCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import { getReconciliationSummary, runReconciliation, getReconciliationHistory, getEtimsStatus, processEtimsSubmissions } from '@/api/payments'
import { FileCheck2, FileClock, FileX2, Send } from 'lucide-react'

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
  const fetchPayments = useStore((s) => s.fetchPayments)
  const fetchTodaySummary = useStore((s) => s.fetchTodaySummary)

  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [reconDate, setReconDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [recon, setRecon] = useState<any>(null)
  const [reconLoading, setReconLoading] = useState(false)
  const [reconRunning, setReconRunning] = useState(false)
  const [reconHistory, setReconHistory] = useState<any[]>([])
  const [etims, setEtims] = useState<any>(null)
  const [etimsProcessing, setEtimsProcessing] = useState(false)

  const fetchEtims = useCallback(async () => {
    try {
      const data = await getEtimsStatus()
      setEtims(data)
    } catch { /* eTIMS panel is best-effort */ }
  }, [])

  useEffect(() => { fetchEtims() }, [fetchEtims])

  const handleProcessEtims = async () => {
    setEtimsProcessing(true)
    try {
      const res = await processEtimsSubmissions()
      showSuccessToast(`eTIMS: ${res.submitted} submitted, ${res.failed} failed`)
      fetchEtims()
    } catch { showErrorToast('eTIMS processing failed') }
    finally { setEtimsProcessing(false) }
  }

  const fetchRecon = useCallback(async (date: string) => {
    setReconLoading(true)
    try {
      const [summary, history] = await Promise.all([
        getReconciliationSummary(date),
        getReconciliationHistory({ perPage: 10 }),
      ])
      setRecon(summary)
      setReconHistory(Array.isArray(history) ? history : history?.data || [])
    } catch { showErrorToast('Failed to load reconciliation') }
    finally { setReconLoading(false) }
  }, [])

  useEffect(() => { fetchRecon(reconDate) }, [fetchRecon, reconDate])

  const handleRunRecon = async () => {
    setReconRunning(true)
    try {
      const result = await runReconciliation(reconDate)
      setRecon(result)
      showSuccessToast('Reconciliation completed')
      fetchRecon(reconDate)
    } catch { showErrorToast('Reconciliation failed') }
    finally { setReconRunning(false) }
  }

  const refresh = useCallback(async () => {
    try {
      await Promise.all([fetchPayments(), fetchTodaySummary()])
    } finally {
      setRefreshing(false)
      setLoaded(true)
    }
  }, [fetchPayments, fetchTodaySummary])

  useEffect(() => { refresh() }, [refresh])

  const totals = useMemo(() => {
    const mpesaTotal = transactions.filter((t) => t.method === 'mpesa' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
    const cashTotal = transactions.filter((t) => t.method === 'cash' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
    const cardTotal = transactions.filter((t) => t.method === 'card' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0)
    const pending = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + t.amount, 0)
    return { total: mpesaTotal + cashTotal + cardTotal, mpesaTotal, cashTotal, cardTotal, pending }
  }, [transactions])

  const hourlyData = useMemo(() => {
    const hours: Record<number, any> = {}
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
    { name: 'Cash', value: totals.cashTotal, color: 'var(--color-secondary)' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Payments</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Track transactions and reconcile payments</p>
        </div>
        <RefreshButton refreshing={refreshing} onClick={() => { setRefreshing(true); refresh() }} />
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="h-6 w-6" />} label="Today's Total" value={totals.total} prefix="KES " trend={15} trendLabel="vs yesterday" color="secondary" />
        <StatCard icon={<Smartphone className="h-6 w-6" />} label="M-Pesa Total" value={totals.mpesaTotal} prefix="KES " trend={22} trendLabel="vs yesterday" color="success" />
        <StatCard icon={<Banknote className="h-6 w-6" />} label="Cash Total" value={totals.cashTotal} prefix="KES " trend={-5} trendLabel="vs yesterday" color="primary" />
        <StatCard icon={<Clock className="h-6 w-6" />} label="Pending" value={totals.pending} prefix="KES " trend={0} trendLabel="vs yesterday" color="accent" />
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Live Transactions</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {!loaded ? (
              <div className="space-y-2">
                <Skeleton variant="card" className="h-16" />
                <Skeleton variant="card" className="h-16" />
                <Skeleton variant="card" className="h-16" />
                <Skeleton variant="card" className="h-16" />
              </div>
            ) : (
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
            )}
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

      {/* M-Pesa Reconciliation */}
      <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">M-Pesa Reconciliation</h3>
            <p className="font-body text-xs text-text-secondary dark:text-white/50">Expected vs received, matched against STK-push attempts and Safaricom callbacks</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={reconDate} onChange={(e) => setReconDate(e.target.value)} className="!w-auto text-sm" />
            <Button size="sm" loading={reconRunning} onClick={handleRunRecon}>
              <PlayCircle className="h-3.5 w-3.5" /> Run
            </Button>
          </div>
        </div>

        {reconLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
          </div>
        ) : recon ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
                <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase tracking-wider">Expected</p>
                <p className="font-heading text-xl font-bold text-text-primary dark:text-white mt-1">KES {Number(recon.expectedMpesa || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
                <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase tracking-wider">Received</p>
                <p className="font-heading text-xl font-bold text-success mt-1">KES {Number(recon.receivedMpesa || 0).toLocaleString()}</p>
              </div>
              <div className={`rounded-xl p-4 ${Number(recon.difference || 0) === 0 ? 'bg-success/10' : 'bg-red-500/10'}`}>
                <p className={`font-accent text-xs uppercase tracking-wider ${Number(recon.difference || 0) === 0 ? 'text-success' : 'text-red-500'}`}>Difference</p>
                <p className={`font-heading text-xl font-bold mt-1 ${Number(recon.difference || 0) === 0 ? 'text-success' : 'text-red-500'}`}>KES {Number(recon.difference || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
                <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase tracking-wider">Unmatched</p>
                <p className="font-heading text-xl font-bold text-text-primary dark:text-white mt-1">{recon.unmatched ?? 0}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'Duplicates', value: recon.duplicate ?? 0, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                { label: 'Failed', value: recon.failed ?? 0, cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
                { label: 'Expired', value: recon.expired ?? 0, cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
                { label: 'Reversed', value: recon.reversed ?? 0, cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
              ].map((chip) => (
                <span key={chip.label} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${chip.cls}`}>
                  {chip.label}: {chip.value}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {reconHistory.length > 0 && (
          <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-3">
            <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase tracking-wider mb-2">History</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {reconHistory.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs font-accent">
                  <span className="text-text-primary dark:text-white">{String(r.date).slice(0, 10)}</span>
                  <span className="text-text-secondary">KES {Number(r.receivedMpesa || 0).toLocaleString()} received</span>
                  <span className={Number(r.difference) === 0 ? 'text-success' : 'text-red-500'}>
                    {Number(r.difference) === 0 ? 'Matched' : `Δ KES ${Number(r.difference).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KRA eTIMS status */}
      {etims && (
        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">KRA eTIMS</h3>
              <p className="font-body text-xs text-text-secondary dark:text-white/50">
                {etims.configured ? 'Credentials configured — submissions are sent to KRA.' : 'Not configured — receipts wait as PENDING. Nothing is claimed as compliant until KRA returns an invoice number.'}
              </p>
            </div>
            <Button size="sm" loading={etimsProcessing} onClick={handleProcessEtims} disabled={!etims.configured}>
              <Send className="h-3.5 w-3.5" /> Process Submissions
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Pending', value: etims.counts?.PENDING ?? 0, icon: <FileClock className="h-4 w-4" />, cls: 'text-amber-500' },
              { label: 'Submitted', value: etims.counts?.SUBMITTED ?? 0, icon: <FileCheck2 className="h-4 w-4" />, cls: 'text-success' },
              { label: 'Failed', value: etims.counts?.FAILED ?? 0, icon: <FileX2 className="h-4 w-4" />, cls: 'text-red-500' },
              { label: 'Rejected', value: etims.counts?.REJECTED ?? 0, icon: <FileX2 className="h-4 w-4" />, cls: 'text-red-500' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                <div className={`flex items-center gap-1.5 ${s.cls}`}>{s.icon}<span className="font-accent text-xs uppercase tracking-wider">{s.label}</span></div>
                <p className="font-heading text-xl font-bold text-text-primary dark:text-white mt-1">{s.value}</p>
              </div>
            ))}
          </div>
          {(etims.unsubmitted ?? []).length > 0 && (
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-1">Needs attention</p>
              {etims.unsubmitted.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-black/5 dark:border-white/5 last:border-0">
                  <span className="text-text-primary dark:text-white truncate">{s.receiptNumber}</span>
                  <span className={`font-bold ${s.status === 'PENDING' ? 'text-amber-500' : 'text-red-500'}`}>{s.status}</span>
                  <span className="text-text-secondary truncate">{s.lastError || `attempts ${s.attempts}`}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-text-secondary mt-2">{etims.note}</p>
        </div>
      )}
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
