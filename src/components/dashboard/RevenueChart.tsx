import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Period = 'today' | 'week' | 'month' | 'year'

const periods: Period[] = ['today', 'week', 'month', 'year']

const generateData = (period: Period) => {
  const data: { time: string; mpesa: number; cash: number }[] = []
  const now = new Date()
  if (period === 'today') {
    for (let h = 7; h <= 23; h++) {
      data.push({
        time: `${h.toString().padStart(2, '0')}:00`,
        mpesa: Math.round(Math.random() * 8000 + 1000),
        cash: Math.round(Math.random() * 3000 + 500),
      })
    }
  } else if (period === 'week') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    days.forEach((d) => {
      data.push({
        time: d,
        mpesa: Math.round(Math.random() * 60000 + 15000),
        cash: Math.round(Math.random() * 25000 + 5000),
      })
    })
  } else if (period === 'month') {
    for (let d = 1; d <= 30; d++) {
      data.push({
        time: `Day ${d}`,
        mpesa: Math.round(Math.random() * 80000 + 20000),
        cash: Math.round(Math.random() * 30000 + 8000),
      })
    }
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    months.forEach((m) => {
      data.push({
        time: m,
        mpesa: Math.round(Math.random() * 2000000 + 500000),
        cash: Math.round(Math.random() * 800000 + 200000),
      })
    })
  }
  return data
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null
  return (
    <div className="rounded-xl bg-white dark:bg-primary-light border border-white/10 p-3 shadow-soft">
      <p className="font-accent text-xs text-text-secondary dark:text-white/50 mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm font-accent">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="font-bold text-text-primary dark:text-white">KES {entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>('today')
  const data = useMemo(() => generateData(period), [period])

  const totals = useMemo(() => {
    const mpesa = data.reduce((s, d) => s + d.mpesa, 0)
    const cash = data.reduce((s, d) => s + d.cash, 0)
    return { mpesa, cash, total: mpesa + cash }
  }, [data])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">Revenue</h3>
          <p className="font-accent text-2xl font-bold text-secondary">KES {totals.total.toLocaleString()}</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
          {periods.map((p) => (
            <motion.button
              key={p}
              onClick={() => setPeriod(p)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`rounded-lg px-3 py-1.5 text-xs font-accent font-medium transition-colors ${
                period === p
                  ? 'bg-secondary text-white'
                  : 'text-text-secondary dark:text-white/60 hover:text-text-primary dark:hover:text-white'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
          <span className="font-accent text-xs text-text-secondary dark:text-white/50">M-Pesa (KES {totals.mpesa.toLocaleString()})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B35]" />
          <span className="font-accent text-xs text-text-secondary dark:text-white/50">Cash (KES {totals.cash.toLocaleString()})</span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="mpesaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fontFamily: 'Space Grotesk' }} stroke="rgba(255,255,255,0.2)" />
            <YAxis tick={{ fontSize: 11, fontFamily: 'Space Grotesk' }} stroke="rgba(255,255,255,0.2)" tickFormatter={(v) => `KES ${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="mpesa"
              name="M-Pesa"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#mpesaGrad)"
              animationBegin={0}
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="cash"
              name="Cash"
              stroke="#FF6B35"
              strokeWidth={2}
              fill="url(#cashGrad)"
              animationBegin={300}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
