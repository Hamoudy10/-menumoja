import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Search, X, RefreshCw, Trash2, Download, Phone, Mail, Calendar, Clock, Heart, MessageSquare, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as customersApi from '@/api/customers'

const SEGMENT_COLORS: Record<string, string> = {
  VIP: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Frequent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  New: 'bg-green-500/10 text-green-600 dark:text-green-400',
  Dormant: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  'High spender': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Lunch customer': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'Dinner customer': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  'Weekend customer': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  'Category-loyal': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
}

export default function CustomersPage() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<any[]>([])
  const [segments, setSegments] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [consent, setConsent] = useState(false)
  const [optOut, setOptOut] = useState(false)
  const [preferredChannel, setPreferredChannel] = useState('')

  const load = useCallback(async (s: string, seg: string) => {
    setLoading(true)
    try {
      const res = await customersApi.fetchCustomers({ search: s || undefined, segment: seg || undefined, perPage: 100 })
      setCustomers(Array.isArray(res.data) ? res.data : [])
      setSegments(res.segments || {})
    } catch { showErrorToast('Failed to load customers') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search, segmentFilter), 300)
    return () => clearTimeout(t)
  }, [search, segmentFilter, load])

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const data = await customersApi.getCustomer(id)
      setDetail(data)
      setConsent(!!data.consentMarketing)
      setOptOut(!!data.isOptedOut)
      setPreferredChannel(data.preferredChannel || '')
    } catch { showErrorToast('Failed to load customer') }
    finally { setDetailLoading(false) }
  }

  const saveConsent = async () => {
    if (!detail) return
    try {
      await customersApi.updateCustomer(detail.id, { consentMarketing: consent, isOptedOut: optOut, preferredChannel })
      showSuccessToast(consent ? 'Marketing consent saved' : 'Marketing consent revoked')
      load(search, segmentFilter)
      openDetail(detail.id)
    } catch { showErrorToast('Failed to save consent') }
  }

  const handleDelete = async () => {
    if (!detail) return
    if (!confirm(`Delete ${detail.name || detail.phone}? Their order history will be anonymized (GDPR-style removal).`)) return
    try {
      await customersApi.deleteCustomer(detail.id)
      showSuccessToast('Customer deleted')
      setSelectedId(null)
      setDetail(null)
      load(search, segmentFilter)
    } catch { showErrorToast('Failed to delete customer') }
  }

  const handleExport = async () => {
    if (!detail) return
    try {
      const data = await customersApi.exportCustomerData(detail.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-${detail.phone}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      showSuccessToast('Data export downloaded')
    } catch { showErrorToast('Failed to export data') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Customers</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Profiles, spend, segments and marketing consent</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="pl-9 !w-56"
            />
          </div>
          <button onClick={() => load(search, segmentFilter)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Segment banner */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(segments).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
          <button
            key={name}
            onClick={() => setSegmentFilter(segmentFilter === name ? '' : name)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${SEGMENT_COLORS[name] || 'bg-black/5 dark:bg-white/10 text-text-secondary'} ${segmentFilter === name ? 'ring-2 ring-current' : ''}`}
          >
            {name} · {count}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="No customers yet" description="Customers are created automatically from orders, payments, SMS and USSD" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c.id)}
              className={`text-left rounded-2xl bg-white dark:bg-primary-light border p-4 transition-colors hover:border-secondary/50 ${selectedId === c.id ? 'border-secondary' : 'border-white/10'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-text-primary dark:text-white truncate">{c.name || 'Anonymous guest'}</p>
                  <p className="font-accent text-xs text-text-secondary mt-0.5">{c.phone}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-heading text-base font-bold text-text-primary dark:text-white">KES {Number(c.totalSpend || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-text-secondary">{c.totalVisits} visit(s)</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(c.segments || []).slice(0, 3).map((s: string) => (
                  <span key={s} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SEGMENT_COLORS[s] || 'bg-black/5 dark:bg-white/10 text-text-secondary'}`}>{s}</span>
                ))}
                {c.consentMarketing && <Badge variant="success" size="sm"><ShieldCheck className="h-2.5 w-2.5" /> consent</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedId(null)} />
        )}
        {selectedId && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-primary-light border-l border-white/10 shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 bg-white dark:bg-primary-light border-b border-black/5 dark:border-white/10 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">Customer Profile</h2>
                {detail?.consentMarketing && <Badge variant="success" size="sm"><ShieldCheck className="h-3 w-3" /> consented</Badge>}
                {detail?.isOptedOut && <Badge variant="danger" size="sm"><ShieldOff className="h-3 w-3" /> opted out</Badge>}
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
            </div>

            {detailLoading || !detail ? (
              <div className="p-5 space-y-3">
                <Skeleton variant="card" className="h-24" />
                <Skeleton variant="card" className="h-40" />
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div>
                  <p className="font-heading text-xl font-bold text-text-primary dark:text-white">{detail.name || 'Anonymous guest'}</p>
                  <p className="font-accent text-sm text-text-secondary mt-1 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {detail.phone}</p>
                  {detail.email && <p className="font-accent text-sm text-text-secondary mt-1 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {detail.email}</p>}
                  <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> First {new Date(detail.firstVisit).toLocaleDateString('en-KE')}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last {new Date(detail.lastVisit).toLocaleDateString('en-KE')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                    <p className="font-heading text-lg font-bold text-text-primary dark:text-white">{detail.totalVisits}</p>
                    <p className="text-[10px] text-text-secondary uppercase">Visits</p>
                  </div>
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                    <p className="font-heading text-lg font-bold text-text-primary dark:text-white">KES {Number(detail.totalSpend || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-text-secondary uppercase">Total spend</p>
                  </div>
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 p-3">
                    <p className="font-heading text-lg font-bold text-text-primary dark:text-white">KES {Number(detail.averageSpend || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-text-secondary uppercase">Avg / visit</p>
                  </div>
                </div>

                <div>
                  <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2">Segments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(detail.segment || []).length === 0 ? <p className="text-xs text-text-secondary">No segments yet</p> : detail.segment.map((s: string) => (
                      <span key={s} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${SEGMENT_COLORS[s] || 'bg-black/5 dark:bg-white/10 text-text-secondary'}`}>{s}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1"><Heart className="h-3 w-3" /> Favourite items</p>
                    <div className="space-y-1">
                      {(detail.favouriteItems || []).map((f: string) => <p key={f} className="text-sm text-text-primary dark:text-white">{f}</p>)}
                      {(detail.favouriteItems || []).length === 0 && <p className="text-xs text-text-secondary">No favourites yet</p>}
                    </div>
                  </div>
                  <div>
                    <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2">Favourite categories</p>
                    <div className="space-y-1">
                      {(detail.favouriteCategories || []).map((f: string) => <p key={f} className="text-sm text-text-primary dark:text-white">{f}</p>)}
                      {(detail.favouriteCategories || []).length === 0 && <p className="text-xs text-text-secondary">No data yet</p>}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-black/5 dark:border-white/10 p-3 space-y-3">
                  <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Marketing & privacy</p>
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-text-primary dark:text-white">Marketing consent</span>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 accent-[var(--color-secondary)]" />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span className="text-text-primary dark:text-white">Opt out of all contact</span>
                    <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} className="w-4 h-4 accent-[var(--color-secondary)]" />
                  </label>
                  <Input label="Preferred channel" value={preferredChannel} onChange={(e) => setPreferredChannel(e.target.value)} placeholder="whatsapp / sms / phone" />
                  <Button size="sm" fullWidth onClick={saveConsent}>Save Preferences</Button>
                </div>

                {detail.recentOrders && detail.recentOrders.length > 0 && (
                  <div>
                    <p className="font-accent text-xs text-text-secondary uppercase tracking-wider mb-2">Recent orders</p>
                    <div className="space-y-1.5">
                      {detail.recentOrders.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between text-xs">
                          <span className="text-text-primary dark:text-white truncate">{(o.itemNames || []).join(', ')}</span>
                          <span className="font-accent text-text-secondary shrink-0 ml-2">KES {Number(o.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-black/5 dark:border-white/10">
                  <Button size="sm" variant="outline" onClick={handleExport}><Download className="h-3.5 w-3.5" /> Export Data</Button>
                  <Button size="sm" variant="danger" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
