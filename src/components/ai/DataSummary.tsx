import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Structured presentation for read-tool results.
 * Replaces the raw JSON dump with compact cards the operator can scan.
 */

const money = (value: any) => `KES ${Number(value || 0).toLocaleString()}`

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      {children}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-black/[0.03] p-2 dark:bg-white/5">
      <p className="text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">{label}</p>
      <p className="mt-0.5 font-heading text-sm font-bold text-text-primary dark:text-white">{value}</p>
    </div>
  )
}

function Row({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-2 text-xs">
      <span className="min-w-0 text-text-primary dark:text-white/85">{left}</span>
      {right !== undefined && (
        <span className="shrink-0 text-right text-text-secondary dark:text-white/50">{right}</span>
      )}
    </li>
  )
}

function Raw({ data }: { data: any }) {
  return (
    <details className="rounded-xl border border-black/5 bg-black/[0.02] p-2 text-[10px] text-text-secondary dark:border-white/10 dark:bg-white/5 dark:text-white/50">
      <summary className="flex cursor-pointer select-none items-center gap-1 font-accent font-medium">
        <ChevronDown className="h-3 w-3" /> Raw data
      </summary>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  )
}

function DailyBriefing({ data }: { data: any }) {
  const notes = (Array.isArray(data?.insights) ? data.insights : []).filter(
    (insight: any) => insight.type !== 'revenue'
  )

  return (
    <Card>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Revenue" value={money(data?.revenue)} />
        <Metric label="Orders" value={Number(data?.orders || 0)} />
        <Metric label="Avg order" value={money(data?.averageOrderValue)} />
      </div>

      {data?.changePct !== null && data?.changePct !== undefined && (
        <p className="mt-2 text-[10px] font-accent text-text-secondary dark:text-white/50">
          {data.changePct > 0 ? '+' : ''}{data.changePct}% vs the prior period
        </p>
      )}

      {notes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {notes.slice(0, 4).map((note: any, index: number) => (
            <li key={index} className="text-xs">
              <span className="font-medium text-text-primary dark:text-white/90">{note.title}</span>
              {note.reason && (
                <span className="text-text-secondary dark:text-white/50"> — {note.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function SalesSummary({ data }: { data: any }) {
  return (
    <Card>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Revenue" value={money(data?.revenue)} />
        <Metric label="Orders" value={Number(data?.orders || 0)} />
        <Metric label="Avg order" value={money(data?.averageOrderValue)} />
      </div>

      {data?.changePct !== null && data?.changePct !== undefined && (
        <p className="mt-2 text-[10px] font-accent text-text-secondary dark:text-white/50">
          {data.changePct > 0 ? '+' : ''}{data.changePct}% vs the prior period
        </p>
      )}

      {Array.isArray(data?.topItems) && data.topItems.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {data.topItems.slice(0, 5).map((item: any, index: number) => (
            <Row key={index} left={`${index + 1}. ${item.name}`} right={`${item.unitsSold} sold`} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function TopItems({ data }: { data: any }) {
  const items = Array.isArray(data?.items) ? data.items : []
  return (
    <Card>
      <p className="mb-1 text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">
        Top items · {String(data?.period || '')}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-white/50">No sales in this period.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item: any, index: number) => (
            <Row key={index} left={`${index + 1}. ${item.name}`} right={`${item.unitsSold} sold · ${money(item.revenue)}`} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function LowStock({ data }: { data: any }) {
  const items = Array.isArray(data?.critical) ? data.critical : []
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Low stock" value={Number(data?.lowStockCount || 0)} />
        <Metric label="Out of stock" value={Number(data?.outOfStockCount || 0)} />
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 6).map((item: any, index: number) => (
            <Row
              key={index}
              left={item.name}
              right={`${item.stock} left · reorder ${item.reorderLevel}`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function OpenOrders({ data }: { data: any }) {
  const orders = Array.isArray(data?.orders) ? data.orders : []
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Open orders" value={Number(data?.count ?? orders.length)} />
      </div>
      {orders.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {orders.slice(0, 6).map((order: any, index: number) => (
            <Row
              key={index}
              left={
                <span>
                  <span className="font-medium">{order.orderNumber}</span>
                  <span className="text-text-secondary dark:text-white/50"> · {order.table}</span>
                </span>
              }
              right={`${order.status} · ${order.elapsedMinutes}m`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function TableStatus({ data }: { data: any }) {
  return (
    <Card>
      <div className="grid grid-cols-4 gap-2">
        <Metric label="Free" value={Number(data?.free || 0)} />
        <Metric label="Occupied" value={Number(data?.occupied || 0)} />
        <Metric label="Reserved" value={Number(data?.reserved || 0)} />
        <Metric label="Off" value={Number(data?.unavailable || 0)} />
      </div>
    </Card>
  )
}

function Profitability({ data }: { data: any }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Net sales" value={money(data?.netSales)} />
        <Metric label="Est. COGS" value={money(data?.estimatedCogs)} />
        <Metric label="Margin" value={`${Number(data?.marginPct || 0)}%`} />
        <Metric label="Contribution" value={money(data?.contribution)} />
        <Metric label="Avg order" value={money(data?.averageOrderValue)} />
      </div>
    </Card>
  )
}

function StaffPerformance({ data }: { data: any }) {
  const waiters = Array.isArray(data?.waiters) ? data.waiters : []
  const cashiers = Array.isArray(data?.cashiers) ? data.cashiers : []
  return (
    <Card>
      {waiters.length > 0 && (
        <>
          <p className="mb-1 text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">Waiters</p>
          <ul className="space-y-1.5">
            {waiters.slice(0, 6).map((waiter: any, index: number) => (
              <Row key={index} left={waiter.name} right={`${waiter.ordersServed} orders`} />
            ))}
          </ul>
        </>
      )}
      {cashiers.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">Cashiers</p>
          <ul className="space-y-1.5">
            {cashiers.slice(0, 6).map((cashier: any, index: number) => (
              <Row key={index} left={cashier.name} right={`${cashier.payments} payments · ${money(cashier.totalCollected)}`} />
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

export default function DataSummary({ tool, data }: { tool?: string | null; data: any }) {
  if (data === undefined || data === null) return null

  switch (tool) {
    case 'get_daily_briefing':
      return <DailyBriefing data={data} />
    case 'get_sales_summary':
      return <SalesSummary data={data} />
    case 'get_top_items':
      return <TopItems data={data} />
    case 'get_low_stock':
      return <LowStock data={data} />
    case 'get_open_orders':
      return <OpenOrders data={data} />
    case 'get_table_status':
      return <TableStatus data={data} />
    case 'get_profitability':
      return <Profitability data={data} />
    case 'get_staff_performance':
      return <StaffPerformance data={data} />
    default:
      return <Raw data={data} />
  }
}
