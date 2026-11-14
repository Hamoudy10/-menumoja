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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-accent font-semibold uppercase tracking-wide text-text-secondary dark:text-white/40">
          Daily briefing
        </p>
        {data?.date && (
          <span className="text-[10px] font-accent text-text-secondary dark:text-white/50">
            {new Date(data.date).toLocaleDateString('en-KE')}
          </span>
        )}
      </div>
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

function MenuItems({ data }: { data: any }) {
  const items = Array.isArray(data?.items) ? data.items : []
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">Menu items</p>
        <span className="text-[10px] font-accent text-text-secondary dark:text-white/50">
          {Number(data?.total || items.length)} total
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-white/50">No items found.</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {items.map((item: any, index: number) => (
            <Row
              key={item.id || index}
              left={
                <span>
                  <span className="font-medium">{item.name}</span>
                  {item.category && (
                    <span className="text-text-secondary dark:text-white/50"> · {item.category}</span>
                  )}
                </span>
              }
              right={
                <span>
                  {money(item.price)}
                  {item.available === false && <span className="text-danger"> · 86</span>}
                  {item.special === true && <span className="text-secondary"> · special</span>}
                </span>
              }
            />
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

function PaymentsSummary({ data }: { data: any }) {
  const methods = Array.isArray(data?.byMethod) ? data.byMethod : []
  const recent = Array.isArray(data?.recent) ? data.recent : []
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Collected" value={money(data?.total)} />
        <Metric label="Payments" value={Number(data?.count || 0)} />
      </div>
      {methods.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {methods.map((row: any, index: number) => (
            <Row key={index} left={row.method} right={`${money(row.amount)} · ${row.count}`} />
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-black/5 pt-2 dark:border-white/10">
          {recent.slice(0, 4).map((payment: any, index: number) => (
            <Row
              key={index}
              left={payment.orderNumber || 'Payment'}
              right={`${money(payment.amount)} · ${payment.method}`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function OrderHistory({ data }: { data: any }) {
  const orders = Array.isArray(data?.orders) ? data.orders : []
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">
          Orders · {String(data?.period || '')}
        </p>
        <span className="text-[10px] font-accent text-text-secondary dark:text-white/50">{Number(data?.total || 0)} total</span>
      </div>
      {orders.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-white/50">No orders found.</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {orders.slice(0, 10).map((order: any, index: number) => (
            <Row
              key={index}
              left={
                <span>
                  <span className="font-medium">{order.orderNumber}</span>
                  <span className="text-text-secondary dark:text-white/50"> · {order.table}</span>
                </span>
              }
              right={`${order.status} · ${money(order.total)}`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function Customers({ data }: { data: any }) {
  const customers = Array.isArray(data?.customers) ? data.customers : []
  const segments = data?.segments && typeof data.segments === 'object' ? Object.entries(data.segments) : []
  const topSegment = segments.sort((a: any, b: any) => Number(b[1]) - Number(a[1]))[0]
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Customers" value={Number(data?.total || 0)} />
        <Metric label="Top segment" value={topSegment ? `${topSegment[0]} (${topSegment[1]})` : '—'} />
      </div>
      {customers.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {customers.slice(0, 8).map((customer: any, index: number) => (
            <Row
              key={index}
              left={customer.name}
              right={`${money(customer.totalSpend)} · ${customer.visits} visits`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function RecipeCosts({ data }: { data: any }) {
  const recipes = Array.isArray(data?.recipes) ? data.recipes : []
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">Recipe margins</p>
        <span className="text-[10px] font-accent text-text-secondary dark:text-white/50">{Number(data?.total || 0)} costed</span>
      </div>
      {recipes.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-white/50">No costed recipes yet.</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {recipes.slice(0, 10).map((recipe: any, index: number) => (
            <Row
              key={index}
              left={recipe.item}
              right={`${money(recipe.price)} · cost ${money(recipe.cost)} · ${recipe.marginPct}%`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function Reservations({ data }: { data: any }) {
  const reservations = Array.isArray(data?.reservations) ? data.reservations : []
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">
          Reservations · {String(data?.period || '')}
        </p>
        <span className="text-[10px] font-accent text-text-secondary dark:text-white/50">{Number(data?.total || 0)}</span>
      </div>
      {reservations.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-white/50">No reservations for this period.</p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {reservations.slice(0, 8).map((reservation: any, index: number) => (
            <Row
              key={index}
              left={reservation.name}
              right={`${reservation.partySize}p · ${new Date(reservation.at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} · ${reservation.status}`}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function Promotions({ data }: { data: any }) {
  const promotions = Array.isArray(data?.promotions) ? data.promotions : []
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-accent uppercase tracking-wide text-text-secondary dark:text-white/40">Promotions</p>
        <span className="text-[10px] font-accent text-text-secondary dark:text-white/50">{Number(data?.total || 0)}</span>
      </div>
      {promotions.length === 0 ? (
        <p className="text-xs text-text-secondary dark:text-white/50">No promotions found.</p>
      ) : (
        <ul className="space-y-1.5">
          {promotions.slice(0, 8).map((promotion: any, index: number) => (
            <Row
              key={index}
              left={
                <span>
                  <span className="font-medium">{promotion.title}</span>
                  <span className="text-text-secondary dark:text-white/50"> · {promotion.type}</span>
                </span>
              }
              right={promotion.specialPrice !== null ? money(promotion.specialPrice) : undefined}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function QrStats({ data }: { data: any }) {
  const codes = Array.isArray(data?.codes) ? data.codes : []
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Scans" value={Number(data?.totalScans || 0)} />
        <Metric label="Codes" value={codes.length} />
      </div>
      {codes.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {codes.slice(0, 6).map((code: any, index: number) => (
            <Row key={index} left={code.label} right={`${code.scans} scans`} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function Subscription({ data }: { data: any }) {
  const invoices = Array.isArray(data?.outstandingInvoices) ? data.outstandingInvoices : []
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Plan" value={data?.plan?.name || '—'} />
        <Metric label="Status" value={data?.status || '—'} />
        <Metric label="Renews" value={data?.planExpiresAt ? new Date(data.planExpiresAt).toLocaleDateString('en-KE') : '—'} />
        <Metric label="Trial ends" value={data?.trialEndsAt ? new Date(data.trialEndsAt).toLocaleDateString('en-KE') : '—'} />
      </div>
      {invoices.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {invoices.map((invoice: any, index: number) => (
            <Row key={index} left={invoice.invoiceNumber} right={`${money(invoice.amountKes)} · ${invoice.status}`} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function StaffShifts({ data }: { data: any }) {
  const shifts = Array.isArray(data?.shifts) ? data.shifts : []
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Active shifts" value={Number(data?.active || 0)} />
        <Metric label="Listed" value={Number(data?.total || 0)} />
      </div>
      {shifts.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {shifts.slice(0, 8).map((shift: any, index: number) => (
            <Row
              key={index}
              left={`${shift.staff}${shift.role ? ` · ${shift.role}` : ''}`}
              right={shift.active ? 'On shift' : new Date(shift.clockOut || shift.clockIn).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function Settings({ data }: { data: any }) {
  const languages = Array.isArray(data?.languages) ? data.languages.join(', ') : '—'
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Ordering" value={data?.allowOrdering ? 'On' : 'Off'} />
        <Metric label="M-Pesa" value={data?.payments?.mpesa ? 'On' : 'Off'} />
        <Metric label="Cash" value={data?.payments?.cash ? 'On' : 'Off'} />
        <Metric label="Tax" value={`${Number(data?.taxPercent || 0)}%`} />
        <Metric label="Service charge" value={`${Number(data?.serviceChargePercent || 0)}%`} />
        <Metric label="Languages" value={languages} />
      </div>
    </Card>
  )
}

function MultiResults({ data }: { data: any }) {
  const results = Array.isArray(data?.results) ? data.results : []
  return (
    <div className="space-y-2">
      {results.map((result: any, index: number) => (
        <DataSummary key={index} tool={result.tool} data={result.data} />
      ))}
    </div>
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
    case 'get_menu_items':
      return <MenuItems data={data} />
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
    case 'get_payments_summary':
      return <PaymentsSummary data={data} />
    case 'get_order_history':
      return <OrderHistory data={data} />
    case 'get_customers':
      return <Customers data={data} />
    case 'get_recipe_costs':
      return <RecipeCosts data={data} />
    case 'get_reservations':
      return <Reservations data={data} />
    case 'get_promotions':
      return <Promotions data={data} />
    case 'get_qr_stats':
      return <QrStats data={data} />
    case 'get_subscription':
      return <Subscription data={data} />
    case 'get_staff_shifts':
      return <StaffShifts data={data} />
    case 'get_settings':
      return <Settings data={data} />
    case 'multi':
      return <MultiResults data={data} />
    default:
      return <Raw data={data} />
  }
}
