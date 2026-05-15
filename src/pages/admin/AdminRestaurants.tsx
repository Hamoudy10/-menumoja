import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, MoreVertical, Eye, Ban, CheckCircle,
  Store, MapPin, User, ChevronDown, X, ArrowUp, ArrowDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { SearchBar } from '@/components/ui/SearchBar'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'

interface RestaurantRow {
  id: string
  name: string
  owner: string
  location: string
  city: string
  plan: 'starter' | 'business' | 'premium'
  status: 'active' | 'suspended'
  ordersToday: number
  revenueMonth: number
  joinedDate: string
  email: string
  phone: string
  cuisine: string
}

const allRestaurants: RestaurantRow[] = [
  { id: '1', name: 'Bahari Restaurant', owner: 'James Ochieng', location: 'Mombasa, Kenya', city: 'Mombasa', plan: 'business', status: 'active', ordersToday: 47, revenueMonth: 485000, joinedDate: '2025-01-15', email: 'james@bahari.co.ke', phone: '+254712345678', cuisine: 'Swahili & Grill' },
  { id: '2', name: 'Safari Grill', owner: 'John Kamau', location: 'Nairobi, Kenya', city: 'Nairobi', plan: 'starter', status: 'active', ordersToday: 32, revenueMonth: 245000, joinedDate: '2025-03-01', email: 'john@safarigrill.com', phone: '+254723456789', cuisine: 'Grill & BBQ' },
  { id: '3', name: 'Coastal Delights', owner: 'Amina Hassan', location: 'Mombasa, Kenya', city: 'Mombasa', plan: 'premium', status: 'active', ordersToday: 58, revenueMonth: 720000, joinedDate: '2024-11-20', email: 'amina@coastal.com', phone: '+254734567890', cuisine: 'Coastal & Seafood' },
  { id: '4', name: 'Mountain View Cafe', owner: 'Peter Njoroge', location: 'Nyeri, Kenya', city: 'Nyeri', plan: 'starter', status: 'active', ordersToday: 18, revenueMonth: 120000, joinedDate: '2025-05-10', email: 'peter@mountainview.com', phone: '+254745678901', cuisine: 'Cafe & Pastries' },
  { id: '5', name: 'Spice Garden', owner: 'Fatima Ahmed', location: 'Zanzibar, Tanzania', city: 'Zanzibar', plan: 'business', status: 'suspended', ordersToday: 0, revenueMonth: 0, joinedDate: '2024-08-12', email: 'fatima@spicegarden.com', phone: '+255712345678', cuisine: 'Indian & Spice' },
  { id: '6', name: 'Lake Side Inn', owner: 'David Omondi', location: 'Kisumu, Kenya', city: 'Kisumu', plan: 'starter', status: 'active', ordersToday: 24, revenueMonth: 189000, joinedDate: '2025-02-28', email: 'david@lakeside.com', phone: '+254756789012', cuisine: 'Fish & Grill' },
  { id: '7', name: 'Savannah Bistro', owner: 'Grace Mwangi', location: 'Nairobi, Kenya', city: 'Nairobi', plan: 'premium', status: 'active', ordersToday: 41, revenueMonth: 560000, joinedDate: '2024-06-15', email: 'grace@savannah.com', phone: '+254767890123', cuisine: 'Continental' },
  { id: '8', name: 'Quick Bites', owner: 'Hassan Ali', location: 'Dar es Salaam, Tanzania', city: 'Dar es Salaam', plan: 'starter', status: 'suspended', ordersToday: 0, revenueMonth: 0, joinedDate: '2025-04-05', email: 'hassan@quickbites.com', phone: '+255723456789', cuisine: 'Fast Food' },
  { id: '9', name: 'Riverside Kitchen', owner: 'Sarah Wanjiku', location: 'Nairobi, Kenya', city: 'Nairobi', plan: 'business', status: 'active', ordersToday: 36, revenueMonth: 410000, joinedDate: '2024-09-01', email: 'sarah@riverside.com', phone: '+254778901234', cuisine: 'Fusion & Healthy' },
  { id: '10', name: 'The Golden Wok', owner: 'Li Wei', location: 'Nairobi, Kenya', city: 'Nairobi', plan: 'business', status: 'active', ordersToday: 52, revenueMonth: 635000, joinedDate: '2024-10-01', email: 'li@goldenwok.com', phone: '+254789012345', cuisine: 'Chinese & Asian' },
]

const formatKES = (value: number) => {
  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `KES ${(value / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}K`
  return `KES ${value}`
}

type SortField = 'name' | 'ordersToday' | 'revenueMonth' | 'joinedDate'
type SortDir = 'asc' | 'desc'

export default function AdminRestaurants() {
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState<string>('all')
  const [filterPlan, setFilterPlan] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [restaurants, setRestaurants] = useState(allRestaurants)
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantRow | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const cities = useMemo(() => [...new Set(restaurants.map(r => r.city))], [restaurants])

  const filtered = useMemo(() => {
    let data = [...restaurants]

    if (search) {
      const q = search.toLowerCase()
      data = data.filter(r => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q) || r.location.toLowerCase().includes(q))
    }

    if (filterCity !== 'all') data = data.filter(r => r.city === filterCity)
    if (filterPlan !== 'all') data = data.filter(r => r.plan === filterPlan)
    if (filterStatus !== 'all') data = data.filter(r => r.status === filterStatus)

    data.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      if (sortField === 'ordersToday') cmp = a.ordersToday - b.ordersToday
      if (sortField === 'revenueMonth') cmp = a.revenueMonth - b.revenueMonth
      if (sortField === 'joinedDate') cmp = a.joinedDate.localeCompare(b.joinedDate)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return data
  }, [restaurants, search, filterCity, filterPlan, filterStatus, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleSuspend = (id: string) => {
    setRestaurants(prev => prev.map(r => {
      if (r.id !== id) return r
      const newStatus = r.status === 'active' ? 'suspended' : 'active'
      if (newStatus === 'active') showSuccessToast(`${r.name} has been reactivated`)
      else showErrorToast(`${r.name} has been suspended`)
      return { ...r, status: newStatus as 'active' | 'suspended' }
    }))
    setMenuOpenId(null)
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
          <p className="text-sm text-white/50">{filtered.length} restaurants on platform</p>
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
                onChange={e => setFilterCity(e.target.value)}
                className="px-3 py-2 rounded-xl bg-primary-light border border-white/10 text-white/80 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterPlan}
                onChange={e => setFilterPlan(e.target.value)}
                className="px-3 py-2 rounded-xl bg-primary-light border border-white/10 text-white/80 text-sm outline-none focus:border-secondary"
              >
                <option value="all">All Plans</option>
                <option value="starter">Starter</option>
                <option value="business">Business</option>
                <option value="premium">Premium</option>
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
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
                        {r.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-white">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-sm text-white/70">{r.owner}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-sm text-white/70">{r.location}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.plan === 'premium' ? 'info' : r.plan === 'business' ? 'warning' : 'default'} size="sm">
                      {r.plan.charAt(0).toUpperCase() + r.plan.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === 'active' ? 'success' : 'danger'} size="sm" dot>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{r.ordersToday}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-white">{formatKES(r.revenueMonth)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-white/50">{r.joinedDate}</span>
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
                            <Eye className="w-4 h-4" /> View Dashboard
                          </button>
                          <button
                            onClick={() => toggleSuspend(r.id)}
                            className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-all ${
                              r.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-success hover:bg-success/10'
                            }`}
                          >
                            {r.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
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

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Store className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No restaurants match your filters</p>
          </div>
        )}
      </div>

      <Modal open={!!selectedRestaurant} onClose={() => setSelectedRestaurant(null)} title={selectedRestaurant?.name} size="lg">
        {selectedRestaurant && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Owner</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.owner}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Email</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.email}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Phone</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.phone}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Location</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.location}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Cuisine</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.cuisine}</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4">
                <p className="text-xs text-white/40 mb-1">Plan</p>
                <p className="text-sm text-white font-medium">{selectedRestaurant.plan.charAt(0).toUpperCase() + selectedRestaurant.plan.slice(1)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-primary-light rounded-xl p-4 text-center">
                <p className="text-2xl font-heading font-bold text-white">{selectedRestaurant.ordersToday}</p>
                <p className="text-xs text-white/40 mt-1">Orders Today</p>
              </div>
              <div className="bg-primary-light rounded-xl p-4 text-center">
                <p className="text-2xl font-heading font-bold text-white">{formatKES(selectedRestaurant.revenueMonth)}</p>
                <p className="text-xs text-white/40 mt-1">Revenue This Month</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Toggle
                checked={selectedRestaurant.status === 'active'}
                onChange={() => toggleSuspend(selectedRestaurant.id)}
                label={selectedRestaurant.status === 'active' ? 'Active' : 'Suspended'}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
