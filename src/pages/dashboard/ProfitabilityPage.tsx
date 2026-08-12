import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Receipt, TrendingUp, TrendingDown, ShoppingCart, PieChart as PieIcon, RefreshCw, Star, Package, Puzzle, Dog, HelpCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { showErrorToast } from '@/components/ui/Toast'
import * as analyticsApi from '@/api/analytics'
import { getProfitabilityOverview, getMenuEngineering } from '@/api/profitability'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
]

const CLASS_META: Record<string, { label: string; color: string; icon: React.ReactNode; quadrant: 'high-high' | 'high-low' | 'low-high' | 'low-low' | 'none' }> = {
  STAR: { label: 'Star', color: 'text-success', icon: <Star className="h-4 w-4" />, quadrant: 'high-high' },
  PLOW_HORSE: { label: 'Plow Horse', color: 'text-amber-500', icon: <Package className="h-4 w-4" />, quadrant: 'high-low' },
  PUZZLE: { label: 'Puzzle', color: 'text-blue-500', icon: <Puzzle className="h-4 w-4" />, quadrant: 'low-high' },
  DOG: { label: 'Dog', color: 'text-red-500', icon: <Dog className="h-4 w-4" />, quadrant: 'low-low' },
  NO_COST_DATA: { label: 'No Cost Data', color: 'text-text-secondary', icon: <HelpCircle className="h-4 w-4" />, quadrant: 'none' },
}

export default function ProfitabilityPage() {
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<any>(null)
  const [matrix, setMatrix] = useState<any[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const [ov, me] = await Promise.all([
        getProfitabilityOverview(p),
        getMenuEngineering(p),
      ])
      setOverview(ov)
      setMatrix(Array.isArray(me?.matrix) ? me.matrix : [])
      setSummary(me?.summary || {})
    } catch { showErrorToast('Failed to load profitability') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const quadrant = (q: string) => matrix.filter((m) => CLASS_META[m.classification]?.quadrant === q)

  const metrics = [
    { label: 'Gross Sales', value: overview?.grossSales ?? 0, icon: <DollarSign className="h-4 w-4" />, color: 'text-text-primary' },
    { label: 'Net Sales', value: overview?.netSales ?? 0, icon: <Receipt className="h-4 w-4" />, color: 'text-success' },
    { label: 'Est. COGS', value: overview?.cogs ?? 0, icon: <Package className="h-4 w-4" />, color: 'text-amber-500' },
    { label: 'Contribution', value: overview?.contribution ?? 0, icon: <TrendingUp className="h-4 w-4" />, color: 'text-blue-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Profitability</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Revenue, estimated food costs, margins and menu engineering</p>
        </div>
        <div className="flex items-center gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p.key ? 'bg-secondary text-white' : 'bg-white dark:bg-primary-light border border-white/10 text-text-secondary'}`}
            >
              {p.label}
            </button>
          ))}
          <button onClick={() => load(period)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading || !overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
          </div>
          <Skeleton variant="card" className="h-72" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                <div className="flex items-center gap-2">
                  <span className={m.color}>{m.icon}</span>
                  <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">{m.label}</p>
                </div>
                <p className={`font-heading text-2xl font-bold mt-2 ${m.color}`}>KES {Number(m.value).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-success/10 border border-success/20 p-4">
              <p className="font-accent text-xs text-success uppercase tracking-wider">Margin</p>
              <p className="font-heading text-3xl font-bold text-success mt-1">{overview.marginPct}%</p>
              <p className="text-[11px] text-text-secondary mt-1">contribution ÷ net sales</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
              <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Orders</p>
              <p className="font-heading text-3xl font-bold text-text-primary dark:text-white mt-1">{overview.orderCount}</p>
              <p className="text-[11px] text-text-secondary mt-1">avg KES {Number(overview.averageOrderValue).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
              <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Units Sold</p>
              <p className="font-heading text-3xl font-bold text-text-primary dark:text-white mt-1">{overview.unitsSold}</p>
              <p className="text-[11px] text-text-secondary mt-1">{overview.costedUnits} costed by recipes</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
              <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Refunds</p>
              <p className="font-heading text-3xl font-bold text-red-500 mt-1">KES {Number(overview.refunds).toLocaleString()}</p>
              <p className="text-[11px] text-text-secondary mt-1">discounts KES {Number(overview.discounts).toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">Menu Engineering Matrix</h2>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(CLASS_META).map(([key, meta]) => (
                  <span key={key} className={`flex items-center gap-1 text-[10px] font-semibold ${meta.color}`}>
                    {meta.icon} {meta.label} ({summary[key] ?? 0})
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-text-secondary mb-4">Classified by popularity (units sold) and profitability (margin %) vs the median of each axis. COGS is estimated from current recipe costs.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {([
                ['high-high', 'Popular & Profitable'],
                ['high-low', 'Popular, Low Margin'],
                ['low-high', 'High Margin, Less Popular'],
                ['low-low', 'Review Candidates'],
              ] as const).map(([q, title]) => {
                const items = quadrant(q)
                const meta = q === 'high-high' ? CLASS_META.STAR : q === 'high-low' ? CLASS_META.PLOW_HORSE : q === 'low-high' ? CLASS_META.PUZZLE : CLASS_META.DOG
                return (
                  <div key={q} className="rounded-xl border border-black/5 dark:border-white/10 p-3 min-h-[110px]">
                    <p className={`font-accent text-[11px] font-bold uppercase tracking-wider mb-2 ${meta.color}`}>{meta.icon} {title}</p>
                    {items.length === 0 ? (
                      <p className="text-xs text-text-secondary">Nothing here yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div key={item.menuItemId} className="flex items-center justify-between text-sm py-0.5">
                            <span className="text-text-primary dark:text-white truncate">{item.menuItemName}</span>
                            <span className="font-accent text-xs text-text-secondary shrink-0 ml-2">
                              {item.unitsSold} sold · {item.marginPct !== null ? `${item.marginPct}%` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {items.length > 0 && (
                      <p className="text-[10px] text-text-secondary mt-2 italic">{items[0].recommendation}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {matrix.filter((m) => m.classification === 'NO_COST_DATA').length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  {matrix.filter((m) => m.classification === 'NO_COST_DATA').length} item(s) have no recipe — add recipes to classify them.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
