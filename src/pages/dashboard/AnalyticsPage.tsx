import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  TrendingUp, DollarSign, ShoppingBag, ScanLine, Star, Clock, RefreshCw,
  Smartphone, Monitor, Loader2, CreditCard, Users, Coffee, ChefHat, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Badge } from '@/components/ui/Badge'
import * as analyticsApi from '@/api/analytics'

type Period = 'today' | 'week' | 'month'
const periods: Period[] = ['today', 'week', 'month']

const MUTED = 'text-text-secondary dark:text-white/40'
const COLORS = ['#FF6B35', '#3B82F6', '#2ECC71', '#8B5CF6', '#F59E0B']

function formatKES(v: number) { return v ? `KES ${v.toLocaleString()}` : 'KES 0' }
function safeNum(v: any, fallback = 0) { const n = Number(v); return isNaN(n) ? fallback : n }

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<any>(null)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderData, setOrderData] = useState<any[]>([])
  const [topItems, setTopItems] = useState<any[]>([])
  const [paymentSplit, setPaymentSplit] = useState<any[]>([])
  const [scanData, setScanData] = useState<any[]>([])

  const fetchData = async (p: Period) => {
    setLoading(true)
    try {
      const [overviewRes, revenueRes, orderRes, itemsRes, scansRes] = await Promise.allSettled([
        analyticsApi.getOverview(p),
        analyticsApi.getRevenue({ period: p, groupBy: p === 'today' ? 'hour' : 'day' }),
        analyticsApi.getOrderAnalytics({ period: p }),
        analyticsApi.getTopMenuItems({ period: p, limit: 8, sortBy: 'orders' }),
        analyticsApi.getScanAnalytics({ period: p }),
      ])

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
      if (revenueRes.status === 'fulfilled') {
        const data = revenueRes.value
        setRevenueData(Array.isArray(data) ? data : data.data || [])
      }
      if (orderRes.status === 'fulfilled') {
        const data = orderRes.value
        setOrderData(Array.isArray(data) ? data : data.data || [])
      }
      if (itemsRes.status === 'fulfilled') {
        const data = itemsRes.value
        setTopItems(Array.isArray(data) ? data : data.items || data.data || [])
      }
      if (scansRes.status === 'fulfilled') {
        const data = scansRes.value
        setScanData(Array.isArray(data) ? data : data.data || [])
      }

      const paymentData = overviewRes.status === 'fulfilled' ? overviewRes.value : null
      if (paymentData) {
        const parts: any[] = []
        const mpesa = safeNum(paymentData.revenueMpesa)
        const cash = safeNum(paymentData.revenueCash)
        const totalRev = safeNum(paymentData.totalRevenue)
        if (totalRev > 0) {
          if (mpesa > 0) parts.push({ name: 'M-Pesa', value: Math.round((mpesa / totalRev) * 100), color: '#3B82F6' })
          if (cash > 0) parts.push({ name: 'Cash', value: Math.round((cash / totalRev) * 100), color: '#FF6B35' })
          const card = totalRev - mpesa - cash
          if (card > 0) parts.push({ name: 'Card', value: Math.round((card / totalRev) * 100), color: '#2ECC71' })
        }
        setPaymentSplit(parts)
      } else {
        setPaymentSplit([])
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchData(period) }, [period])

  const stats = useMemo(() => {
    const rev = safeNum(overview?.totalRevenue)
    const orders = safeNum(overview?.totalOrders)
    const scans = safeNum(overview?.totalScans)
    const avgOrder = orders > 0 ? Math.round(rev / orders) : 0
    const topItem = topItems[0]
    return [
      { icon: DollarSign, label: 'Revenue', value: formatKES(rev), sub: overview?.revenueChange != null ? `${overview.revenueChange > 0 ? '+' : ''}${overview.revenueChange}%` : null, color: 'from-secondary to-accent' },
      { icon: ShoppingBag, label: 'Orders', value: orders.toLocaleString(), sub: overview?.ordersChange != null ? `${overview.ordersChange > 0 ? '+' : ''}${overview.ordersChange}%` : null, color: 'from-blue-500 to-purple-500' },
      { icon: TrendingUp, label: 'Avg Order', value: formatKES(avgOrder), sub: null, color: 'from-success to-emerald-400' },
      { icon: ScanLine, label: 'QR Scans', value: scans.toLocaleString(), sub: null, color: 'from-pink-500 to-rose-400' },
      { icon: Star, label: 'Top Item', value: topItem?.name || '--', sub: topItem?.orders ? `${topItem.orders} orders` : null, color: 'from-amber-500 to-yellow-300' },
      { icon: Clock, label: `${period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}`, value: `${orders} orders`, sub: null, color: 'from-purple-500 to-indigo-500' },
    ]
  }, [overview, topItems, period])

  const emptyState = (icon: any, msg: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon}
      <p className={`text-sm ${MUTED} mt-3`}>{msg}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Analytics</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Restaurant performance at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(period)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20">
            <RefreshCw className={`h-4 w-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
            {periods.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-2 text-sm font-accent font-medium transition-colors ${period === p ? 'bg-secondary text-white' : 'text-text-secondary dark:text-white/60 hover:text-text-primary'}`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {stats.map((metric, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${metric.color} mb-2`}>
                  <metric.icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-[10px] text-text-secondary dark:text-white/50 uppercase tracking-wider mb-0.5">{metric.label}</p>
                <p className="font-accent text-sm font-bold text-text-primary dark:text-white truncate">{metric.value}</p>
                {metric.sub ? (
                  <p className={`text-[10px] mt-0.5 ${metric.sub.startsWith('+') ? 'text-success' : metric.sub.startsWith('-') ? 'text-red-500' : 'text-text-secondary'}`}>
                    {metric.sub.startsWith('+') ? <ArrowUp className="h-3 w-3 inline mr-0.5" /> : metric.sub.startsWith('-') ? <ArrowDown className="h-3 w-3 inline mr-0.5" /> : null}
                    {metric.sub}
                  </p>
                ) : null}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Revenue</h3>
              <div className="h-64">
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} /><stop offset="95%" stopColor="#FF6B35" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey={revenueData[0]?.time || revenueData[0]?.date || 'name'} tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip />
                      <Area type="monotone" dataKey={revenueData[0]?.revenue !== undefined ? 'revenue' : revenueData[0]?.amount !== undefined ? 'amount' : 'value'} stroke="#FF6B35" strokeWidth={2} fill="url(#revGrad)" animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : emptyState(<DollarSign className={`h-10 w-10 ${MUTED} opacity-30`} />, 'No revenue data for this period')}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Orders Over Time</h3>
              <div className="h-64">
                {orderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orderData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey={orderData[0]?.time || orderData[0]?.date || 'name'} tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                      <Tooltip />
                      <Bar dataKey={orderData[0]?.orders !== undefined ? 'orders' : orderData[0]?.count !== undefined ? 'count' : 'value'} fill="#FF6B35" radius={[6, 6, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : emptyState(<ShoppingBag className={`h-10 w-10 ${MUTED} opacity-30`} />, 'No order data for this period')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Top Items</h3>
              {topItems.length > 0 ? (
                <div className="space-y-2">
                  {topItems.slice(0, 6).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold ${i === 0 ? 'bg-gradient-to-br from-accent to-yellow-400 text-primary' : 'bg-black/5 dark:bg-white/10 text-text-secondary'}`}>{i + 1}</span>
                      <span className="flex-1 font-body text-sm text-text-primary dark:text-white truncate">{item.name || item.itemName}</span>
                      <div className="w-16 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, ((item.orders || 1) / (topItems[0]?.orders || 1)) * 100)}%` }} />
                      </div>
                      <span className="font-accent text-xs font-bold text-text-secondary w-10 text-right">{item.orders || 0}</span>
                    </div>
                  ))}
                </div>
              ) : emptyState(<ChefHat className={`h-10 w-10 ${MUTED} opacity-30`} />, 'No item data yet')}
            </div>

            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Payment Methods</h3>
              {paymentSplit.length > 0 ? (
                <>
                  <div className="flex items-center justify-center" style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentSplit} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" animationDuration={1000}>
                          {paymentSplit.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    {paymentSplit.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-xs text-text-secondary">{entry.name} {entry.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : emptyState(<CreditCard className={`h-10 w-10 ${MUTED} opacity-30`} />, 'No payment data yet')}
            </div>

            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">QR Scans</h3>
              {scanData.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scanData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey={scanData[0]?.time || scanData[0]?.date || 'name'} tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                      <Tooltip />
                      <Bar dataKey={scanData[0]?.scans !== undefined ? 'scans' : scanData[0]?.count !== undefined ? 'count' : 'value'} fill="#8B5CF6" radius={[4, 4, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : emptyState(<ScanLine className={`h-10 w-10 ${MUTED} opacity-30`} />, 'No scan data yet')}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">Traffic Sources</h3>
              <div className="flex items-center gap-3">
                {[['Mobile', 'blue-500'], ['Desktop', 'secondary'], ['Tablet', 'success']].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full bg-${color}`} />
                    <span className="text-xs text-text-secondary">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-48">
              {scanData.length > 0 && scanData[0]?.device ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scanData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.2)" />
                    <Tooltip />
                    <Bar dataKey="mobile" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="desktop" stackId="a" fill="#FF6B35" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="tablet" stackId="a" fill="#2ECC71" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : emptyState(<Monitor className={`h-10 w-10 ${MUTED} opacity-30`} />, 'Traffic data will appear as customers scan your QR codes')}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
