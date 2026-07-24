import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Store, ShoppingCart, DollarSign, UserPlus, TrendingDown, Activity,
  ArrowUp, ArrowDown, Circle,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const mrrData = [
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

const revenueByPlan = [
  { plan: 'Starter', revenue: 850000, restaurants: 145 },
  { plan: 'Business', revenue: 1200000, restaurants: 78 },
  { plan: 'Premium', revenue: 650000, restaurants: 24 },
]

const newVsCancellations = [
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

const recentSignups = [
  { name: 'Safari Grill', owner: 'John Kamau', location: 'Nairobi, Kenya', plan: 'business', date: '2 min ago', avatar: '🍖' },
  { name: 'Coastal Delights', owner: 'Amina Hassan', location: 'Mombasa, Kenya', plan: 'premium', date: '15 min ago', avatar: '🐟' },
  { name: 'Mountain View Cafe', owner: 'Peter Njoroge', location: 'Nyeri, Kenya', plan: 'starter', date: '1 hour ago', avatar: '☕' },
  { name: 'Spice Garden', owner: 'Fatima Ahmed', location: 'Zanzibar, Tanzania', plan: 'business', date: '2 hours ago', avatar: '🌶️' },
  { name: 'Lake Side Inn', owner: 'David Omondi', location: 'Kisumu, Kenya', plan: 'starter', date: '3 hours ago', avatar: '🏖️' },
]

const activities = [
  { action: 'New restaurant registered', detail: 'Safari Grill - Nairobi', time: '2 min ago', type: 'signup' },
  { action: 'Payment processed', detail: 'KES 45,000 - Bahari Restaurant', time: '5 min ago', type: 'payment' },
  { action: 'Subscription upgraded', detail: 'Coastal Delights → Premium', time: '12 min ago', type: 'upgrade' },
  { action: 'Support ticket resolved', detail: 'Ticket #1234 - Billing inquiry', time: '20 min ago', type: 'support' },
  { action: 'System maintenance', detail: 'Scheduled backup completed', time: '30 min ago', type: 'system' },
  { action: 'New staff account', detail: 'Admin user "Grace" created', time: '1 hour ago', type: 'admin' },
  { action: 'Restaurant suspended', detail: 'Quick Bites - Payment overdue', time: '2 hours ago', type: 'alert' },
]

const formatKES = (value: number) => {
  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `KES ${(value / 1000).toFixed(0)}K`
  return `KES ${value}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-primary-light border border-white/10 rounded-xl p-3 shadow-xl">
        <p className="text-white text-xs mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {formatKES(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function AdminOverview() {
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => { setStatsVisible(true) }, [])

  const stats = [
    { label: 'Total Restaurants', value: '247', icon: Store, change: '+12%', up: true, color: 'from-secondary to-accent' },
    { label: 'Orders Today', value: '1,247', icon: ShoppingCart, change: '+8.3%', up: true, color: 'from-success to-emerald-400' },
    { label: 'Revenue Processed', value: 'KES 2.3M', icon: DollarSign, change: '+15.2%', up: true, color: 'from-blue-500 to-purple-500' },
    { label: 'New This Month', value: '18', icon: UserPlus, change: '+24%', up: true, color: 'from-pink-500 to-rose-400' },
    { label: 'Churn Rate', value: '2.3%', icon: TrendingDown, change: '-0.4%', up: false, color: 'from-amber-500 to-orange-400' },
    { label: 'Uptime', value: '99.9%', icon: Activity, change: '0.1%', up: true, color: 'from-green-500 to-teal-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Platform Overview</h1>
        <p className="text-sm text-white/50">Super admin dashboard for MenuMoja platform</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={statsVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.05 }}
              className="bg-primary-light border border-white/5 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span className={`flex items-center gap-0.5 text-xs font-medium ${stat.up ? 'text-success' : 'text-red-400'}`}>
                  {stat.up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-heading font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/50 mt-0.5">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">MRR Trend (KES)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mrrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="mrr" stroke="#FF6B35" strokeWidth={2} dot={{ fill: '#FF6B35', r: 3 }} />
              <Line type="monotone" dataKey="previous" stroke="#FFD700" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: '#FFD700', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Revenue by Plan Tier</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueByPlan} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <YAxis dataKey="plan" type="category" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#FF6B35" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">New vs Cancellations</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={newVsCancellations}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1A2A4A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
              <Area type="monotone" dataKey="new" stroke="#2ECC71" fill="#2ECC71" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="cancellations" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Plan Distribution</h3>
          <div className="space-y-4">
            {revenueByPlan.map((plan, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-white/80">{plan.plan}</span>
                  <span className="text-sm font-semibold text-white">{plan.restaurants} restaurants</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(plan.revenue / 2700000) * 100}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                    className={`h-full rounded-full ${i === 0 ? 'bg-secondary' : i === 1 ? 'bg-accent' : 'bg-success'}`}
                  />
                </div>
                <p className="text-xs text-white/40 mt-0.5">{formatKES(plan.revenue)} / month</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Recent Signups</h3>
          <div className="space-y-3">
            {recentSignups.map((signup, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-xl">{signup.avatar}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{signup.name}</p>
                  <p className="text-xs text-white/50">{signup.owner} • {signup.location}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    signup.plan === 'premium' ? 'bg-accent/20 text-accent' :
                    signup.plan === 'business' ? 'bg-secondary/20 text-secondary' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {(typeof signup.plan === 'string' ? signup.plan : (signup.plan as any)?.name || '').charAt(0).toUpperCase() + (typeof signup.plan === 'string' ? signup.plan : (signup.plan as any)?.name || '').slice(1)}
                  </span>
                  <p className="text-[10px] text-white/30 mt-0.5">{signup.date}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-primary-light border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Platform Activity</h3>
          <div className="space-y-0">
            {activities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
                <Circle className={`w-2 h-2 mt-1.5 shrink-0 ${
                  activity.type === 'signup' ? 'text-success fill-success' :
                  activity.type === 'payment' ? 'text-secondary fill-secondary' :
                  activity.type === 'upgrade' ? 'text-accent fill-accent' :
                  activity.type === 'alert' ? 'text-red-400 fill-red-400' :
                  'text-white/30 fill-white/30'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80">{activity.action}</p>
                  <p className="text-xs text-white/40">{activity.detail}</p>
                </div>
                <span className="text-[10px] text-white/30 shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
