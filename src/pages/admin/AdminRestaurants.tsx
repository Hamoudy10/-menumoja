import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MoreVertical, Eye, Ban, CheckCircle,
  Store, MapPin, User, ChevronDown, X, ArrowUp, ArrowDown, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { SearchBar } from '@/components/ui/SearchBar'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as adminApi from '@/api/admin'

const formatKES = (value: number) => {
  if (!value) return 'KES 0'
  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `KES ${(value / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K`
  return `KES ${value}`
}

type SortField = 'name' | 'ordersToday' | 'revenueMonth' | 'joinedDate'
type SortDir = 'asc' | 'desc'

const planName = (r: any) => (typeof r.plan === 'string' ? r.plan : r.plan?.name || r.planName || 'free')

export default function AdminRestaurants() {
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState<string>('all')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [restaurants, setRestaurants] = useState<any[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<any | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true)
    try {
      const params: any = { page: p, limit: 20, q: q || undefined }
      if (filterCity !== 'all') params.city = filterCity
      if (filterPlan !== 'all') params.plan = filterPlan
      if (filterStatus !== 'all') params.status = filterStatus
      const res: any = await adminApi.fetchAdminRestaurants(params)
      const raw = Array.isArray(res) ? res : res?.data
      const data = Array.isArray(raw) ? raw : Array.isArray(res?.restaurants) ? res.restaurants : []
      setRestaurants(data)
      setTotalPages(res?.meta?.totalPages || Math.max(1, Math.ceil((res?.meta?.total || data.length) / 20)))
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to load restaurants')
    } finally {
      setLoading(false)
    }
  }, [filterCity, filterPlan, filterStatus])

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1, search) }, 300)
    return () => clearTimeout(t)
  }, [search, load])

  useEffect(() => { load(page, search) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const cities = useMemo(() => [...new Set(restaurants.map(r => r.city || 'Unknown'))], [restaurants])

  const filtered = useMemo(() => {
    const data = [...restaurants]
    data.sort((a, b) => {
      const cmp = (() => {
        if (sortField === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sortField === 'ordersToday') return (a.ordersToday || 0) - (b.ordersToday || 0)
        if (sortField === 'revenueMonth') return (a.revenueMonth || 0) - (b.revenueMonth || 0)
        return (a.createdAt || '').localeCompare(b.createdAt || '')
      })()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return data
  }, [restaurants, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleSuspend = async (r: any) => {
    setBusyId(r.id)
    try {
      if (r.status === 'suspended') {
        await adminApi.activateAdminRestaurant(r.id)
        showSuccessToast(`${r.name} has been reactivated`)
      } else {
        await adminApi.suspendAdminRestaurant(r.id, 'Suspended by platform admin')
        showErrorToast(`${r.name} has been suspended`)
      }
      setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, status: x.status === 'active' ? 'suspended' : 'active' } : x))
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Action failed')
    } finally {
      setBusyId(null)
      setMenuOpenId(null)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Restaurants</h1>
          <p className="text-sm text-white/50">{loading ? 'Loading...' : `${filtered.length} restaurants on page`}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar
            placeholder="Search restaurants, owners, locations..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2"
            >
              <select
                value={filterCity}
                onChange={e => { setFilterCity(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-xl bg-primary-light border border-white/10 text-white/80 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterPlan}
                onChange={e => { setFilterPlan(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-xl bg-primary-light border border-white/10 text-white/80 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="business">Business</option>
                <option value="premium">Premium</option>
              </select>
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-xl bg-primary-light border border-white/10 text-white/80 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-primary-light border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">Restaurant <SortIcon field="name" /></div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Location</th>
                <th className="text-left px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('ordersToday')}>
                  <div className="flex items-center justify-end gap-1">Orders Today <SortIcon field="ordersToday" /></div>
                </th>
                <th className="text-right px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('revenueMonth')}>
                  <div className="flex items-center justify-end gap-1">Revenue/Month <SortIcon field="revenueMonth" /></div>
                </th>
                <th className="text-right px-4 py-3 text-xs font-accent font-semibold text-white/40 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('joinedDate')}>
                  <div className="flex items-center justify-end gap-1">Joined <SortIcon field="joinedDate" /></div>
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center text-white text-xs font-bold">
                        {(r.name || 'R').charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-white">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-sm text-white/70">{r.ownerName || r.owner || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-sm text-white/70">{r.city || r.location || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={planName(r) === 'premium' ? 'info' : planName(r) === 'business' ? 'warning' : 'default'} size="sm">
                      {planName(r).charAt(0).toUpperCase() + planName(r).slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === 'active' ? 'success' : 'danger'} size="sm" dot>
                      {(r.status || 'active').charAt(0).toUpperCase() + (r.status || 'active').slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{r.ordersToday ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatKES(r.revenueMonth ?? 0)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-white/50">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-KE') : '—'}</span>
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {menuOpenId === r.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 w-40 bg-primary border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden"
                        >
                          <button
                            onClick={() => { setSelectedRestaurant(r); setMenuOpenId(null) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/80 hover:bg-white/5 transition-all"
                          >
                            <Eye className="w-4 h-4" /> View Details
                          </button>
                          <button
                            onClick={() => toggleSuspend(r)}
                            disabled={busyId === r.id}
                            className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-all ${
                              r.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-success hover:bg-success/10'
                            } disabled:opacity-50`}
                          >
                            {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : r.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            {r.status === 'active' ? 'Suspend' : 'Unsuspend'}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-white/30 animate-spin mx-auto" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Store className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No restaurants match your filters</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-white/5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded-lg bg-white/5 text-white/70 text-sm hover:bg-white/10 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-sm text-white/50">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-lg bg-white/5 text-white/70 text-sm hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <Modal open={!!selectedRestaurant} onClose={() => setSelectedRestaurant(null)} title={selectedRestaurant?.name} size="lg">
        {selectedRestaurant && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Owner</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.ownerName || selectedRestaurant.owner || '—'}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Email</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.email || '—'}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Phone</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.phone || '—'}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Location</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.city || selectedRestaurant.location || '—'}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Cuisine</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.cuisine || '—'}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Plan</p>
                <p className="text-sm text-white font-medium">{planName(selectedRestaurant).charAt(0).toUpperCase() + planName(selectedRestaurant).slice(1)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary-light rounded-xl p-4 text-center">
                <p className="text-2xl font-heading font-bold text-white">{selectedRestaurant.ordersToday ?? 0}</p>
                <p className="text-xs text-white/40 mt-1">Orders Today</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4 text-center">
                <p className="text-2xl font-heading font-bold text-white">{formatKES(selectedRestaurant.revenueMonth ?? 0)}</p>
                <p className="text-xs text-white/40 mt-1">Revenue This Month</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Toggle
                checked={selectedRestaurant.status !== 'suspended'}
                onChange={() => toggleSuspend(selectedRestaurant)}
                label={selectedRestaurant.status === 'suspended' ? 'Suspended' : 'Active'}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
