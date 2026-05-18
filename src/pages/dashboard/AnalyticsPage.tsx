import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  TrendingUp, DollarSign, ShoppingBag, ScanLine, Star, Clock, RefreshCw,
  BarChart3, PieChart, Activity, Smartphone, Monitor, Loader2,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'
import * as analyticsApi from '@/api/analytics'

type Period = 'today' | 'week' | 'month'

const periods: Period[] = ['today', 'week', 'month']

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="rounded-xl bg-white dark:bg-primary-light border border-white/10 p-3 shadow-soft">
      <p className="font-accent text-xs text-text-secondary dark:text-white/50 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm font-accent">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-bold text-text-primary dark:text-white">{entry.name}: {typeof entry.value === 'number' ? `KES ${entry.value.toLocaleString()}` : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('week')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<any>(null)
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [orderData, setOrderData] = useState<any[]>([])
  const [topItems, setTopItems] = useState<any[]>([])
  const [paymentSplit, setPaymentSplit] = useState<any[]>([])
  const [tablePerformance, setTablePerformance] = useState<any[]>([])
  const [deviceData, setDeviceData] = useState<any[]>([])
  const [busiestHour, setBusiestHour] = useState('')

  const fetchData = async (p: Period) => {
    setLoading(true)
    try {
      const [overviewRes, revenueRes, orderRes, itemsRes, tablesRes, scansRes] = await Promise.allSettled([
        analyticsApi.getOverview(p),
        analyticsApi.getRevenue({ period: p, groupBy: p === 'today' ? 'hour' : 'day' }),
        analyticsApi.getOrderAnalytics({ period: p }),
        analyticsApi.getTopMenuItems({ period: p, limit: 8, sortBy: 'orders' }),
        analyticsApi.getTablePerformance(),
        analyticsApi.getScanAnalytics({ period: p }),
      ])

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value)
      if (revenueRes.status === 'fulfilled') {
        const data = revenueRes.value
        setRevenueData(Array.isArray(data) ? data : data.data || data.chart || [])
      }
      if (orderRes.status === 'fulfilled') {
        const data = orderRes.value
        setOrderData(Array.isArray(data) ? data : data.data || data.chart || [])
      }
      if (itemsRes.status === 'fulfilled') {
        const data = itemsRes.value
        setTopItems(Array.isArray(data) ? data : data.items || data.data || [])
      }
      if (tablesRes.status === 'fulfilled') {
        const data = tablesRes.value
        setTablePerformance(Array.isArray(data) ? data : data.tables || data.data || [])
      }

      const paymentData = overviewRes.status === 'fulfilled' ? overviewRes.value : null
      if (paymentData) {
        const mpesaPct = paymentData.revenueMpesa && paymentData.totalRevenue
          ? Math.round((paymentData.revenueMpesa / paymentData.totalRevenue) * 100)
          : 72
        setPaymentSplit([
          { name: 'M-Pesa', value: mpesaPct, color: '#3B82F6' },
          { name: 'Cash', value: 100 - mpesaPct, color: '#FF6B35' },
        ])
      } else {
        setPaymentSplit([
          { name: 'M-Pesa', value: 72, color: '#3B82F6' },
          { name: 'Cash', value: 28, color: '#FF6B35' },
        ])
      }

      if (paymentData?.devices) {
        setDeviceData([
          { name: 'Mobile', value: paymentData.devices.mobile || 0, color: '#3B82F6' },
          { name: 'Desktop', value: paymentData.devices.desktop || 0, color: '#FF6B35' },
          { name: 'Tablet', value: paymentData.devices.tablet || 0, color: '#2ECC71' },
        ])
      } else {
        setDeviceData([])
      }
      setBusiestHour(paymentData?.peakHour ? `${paymentData.peakHour}:00` : '')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(period) }, [period])

  const formatKES = (v: number | string | undefined) => v ? `KES ${Number(v).toLocaleString()}` : 'KES 0'
  const safeStr = (v: string | undefined, fallback = '') => v || fallback

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Analytics</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Deep insights into your restaurant performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(period)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors">
            <RefreshCw className={`h-4 w-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-4 py-2 text-sm font-accent font-medium transition-colors ${
                  period === p ? 'bg-secondary text-white' : 'text-text-secondary dark:text-white/60 hover:text-text-primary'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { icon: DollarSign, label: 'Revenue', value: formatKES(overview?.totalRevenue), change: overview?.revenueChange ? `${overview.revenueChange > 0 ? '+' : ''}${overview.revenueChange}%` : '+12%', color: 'secondary' },
              { icon: ShoppingBag, label: 'Orders', value: String(overview?.totalOrders || '347'), change: overview?.ordersChange ? `${overview.ordersChange > 0 ? '+' : ''}${overview.ordersChange}%` : '+8%', color: 'accent' },
              { icon: TrendingUp, label: 'Avg Order', value: formatKES(overview?.averageOrderValue), change: '+3%', color: 'success' },
              { icon: ScanLine, label: 'Scans', value: String(overview?.totalScans || '1,284'), change: '+23%', color: 'primary' },
              { icon: Star, label: 'Top Item', value: topItems[0]?.name || 'Nyama Choma', change: `${topItems[0]?.orders || 142} orders`, color: 'accent' },
              { icon: Clock, label: 'Busiest Hour', value: busiestHour, change: 'peak time', color: 'secondary' },
            ].map((metric, i) => (
              <AnimatedSection key={i}>
                <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${metric.color}/10 text-${metric.color} mb-2`}>
                    <metric.icon className="h-4 w-4" />
                  </div>
                  <p className="font-accent text-[10px] text-text-secondary dark:text-white/50 uppercase tracking-wider mb-0.5">{metric.label}</p>
                  <p className="font-accent text-sm font-bold text-text-primary dark:text-white truncate">{metric.value}</p>
                  <p className="font-accent text-[10px] text-success mt-0.5">{metric.change}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatedSection>
              <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Revenue Trend</h3>
                <div className="h-64">
                  {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey={revenueData[0]?.time || revenueData[0]?.date || 'name'} tick={{ fontSize: 11, fontFamily: 'Space Grotesk' }} stroke="rgba(255,255,255,0.2)" />
                        <YAxis tick={{ fontSize: 11, fontFamily: 'Space Grotesk' }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v) => `KES ${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey={(revenueData[0]?.revenue !== undefined) ? 'revenue' : (revenueData[0]?.amount !== undefined) ? 'amount' : 'value'} stroke="#FF6B35" strokeWidth={2} fill="url(#revGrad)" animationDuration={1500} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-secondary dark:text-white/40 font-body text-sm">No revenue data for this period</div>
                  )}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection>
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
                        <Bar dataKey={(orderData[0]?.orders !== undefined) ? 'orders' : (orderData[0]?.count !== undefined) ? 'count' : 'value'} fill="#FF6B35" radius={[6, 6, 0, 0]} animationDuration={1500} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-secondary dark:text-white/40 font-body text-sm">No order data for this period</div>
                  )}
                </div>
              </div>
            </AnimatedSection>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AnimatedSection>
              <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Top Items</h3>
                <div className="space-y-2">
                  {topItems.length > 0 ? topItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold font-accent ${
                        i === 0 ? 'bg-gradient-to-br from-accent to-yellow-400 text-primary' : 'bg-black/5 dark:bg-white/10 text-text-secondary'
                      }`}>{i + 1}</span>
                      <span className="flex-1 font-body text-sm text-text-primary dark:text-white truncate">{item.name || item.itemName}</span>
                      <span className="font-accent text-xs font-bold text-text-secondary">{item.orders || item.count || 0}</span>
                    </div>
                  )) : (
                    <p className="text-center font-body text-sm text-text-secondary dark:text-white/40 py-4">No item data yet</p>
                  )}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection>
              <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Payment Methods</h3>
                <div className="flex items-center justify-center h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={paymentSplit} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" animationDuration={1500}>
                        {paymentSplit.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4">
                  {paymentSplit.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="font-accent text-xs text-text-secondary dark:text-white/50">{entry.name} ({entry.value}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection>
              <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Devices</h3>
                {deviceData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-text-secondary/50">
                    <Smartphone className="h-8 w-8 mb-2" />
                    <p className="font-accent text-xs">No device data available</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={deviceData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" animationDuration={1500}>
                            {deviceData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {deviceData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-3">
                          {entry.name === 'Mobile' ? <Smartphone className="h-4 w-4 text-blue-500" /> : entry.name === 'Desktop' ? <Monitor className="h-4 w-4 text-secondary" /> : <Smartphone className="h-4 w-4 text-success" />}
                          <div className="flex-1">
                            <div className="flex justify-between text-xs font-accent mb-1">
                              <span className="text-text-primary dark:text-white/80">{entry.name}</span>
                              <span className="text-text-secondary">{entry.value}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${entry.value}%`, backgroundColor: entry.color }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </AnimatedSection>
          </div>

          <AnimatedSection>
            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
              <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">Table Performance</h3>
              <div className="h-64">
                {tablePerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tablePerformance} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey={tablePerformance[0]?.table || 'name'} tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v) => `KES ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#FF6B35" radius={[6, 6, 0, 0]} animationDuration={1500} />
                      <Bar dataKey="orders" name="Orders" fill="#3B82F6" radius={[6, 6, 0, 0]} animationDuration={1500} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-text-secondary dark:text-white/40 font-body text-sm">No table performance data yet</div>
                )}
              </div>
            </div>
          </AnimatedSection>
        </>
      )}
    </div>
  )
}