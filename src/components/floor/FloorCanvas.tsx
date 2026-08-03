import { useRef, useState, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Pencil } from 'lucide-react'
import type { FloorTable, FloorZone } from '@/types'

const S = 24
const CANVAS_W = 1100
const CANVAS_H = 700
const MAX_UNITS_X = CANVAS_W / S
const MAX_UNITS_Y = CANVAS_H / S

export interface FloorOrderInfo {
  orderCount: number
  unpaidCount: number
  hotStatus: string
  total: number
  itemCount: number
}

export interface ResolvedTableStatus {
  key: string
  label: string
  border: string
  fill: string
  text: string
  pulse?: boolean
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(100,116,139,${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function ordersAtTable(table: FloorTable, orders?: any[]): FloorOrderInfo {
  const list = (orders || []).filter(
    (o: any) =>
      !['CANCELLED', 'cancelled', 'CANCELED', 'canceled'].includes(o.status || '') &&
      (o.tableId === table.id || Number(o.tableNumber) === table.tableNumber)
  )
  const unpaid = list.filter((o: any) => String(o.paymentStatus || 'UNPAID').toUpperCase() !== 'PAID')
  const hotOrder = unpaid[0]
  const hotStatus = hotOrder ? String(hotOrder.status || '').toUpperCase() : ''
  const total = unpaid.reduce((s: number, o: any) => s + Number(o.totalAmount || o.total || 0), 0)
  const itemCount = unpaid.reduce((s: number, o: any) => s + (o.items || []).reduce((si: number, it: any) => si + Number(it.quantity || 1), 0), 0)
  return { orderCount: list.length, unpaidCount: unpaid.length, hotStatus, total, itemCount }
}

export function resolveTableStatus(table: FloorTable, orders?: any[]): ResolvedTableStatus {
  if (table.status === 'UNAVAILABLE') {
    return {
      key: 'UNAVAILABLE', label: 'Unavailable',
      border: '#94A3B8', fill: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.12) 0 6px, transparent 6px 12px)', text: '#94A3B8',
    }
  }
  if (table.status === 'RESERVED') {
    return { key: 'RESERVED', label: 'Reserved', border: '#3498DB', fill: 'rgba(52,152,219,0.10)', text: '#3498DB', pulse: true }
  }

  const info = ordersAtTable(table, orders)
  if (info.unpaidCount > 0) {
    if (info.hotStatus === 'READY') {
      return { key: 'READY', label: 'Ready to serve', border: '#2ECC71', fill: 'rgba(46,204,113,0.16)', text: '#2ECC71', pulse: true }
    }
    if (info.hotStatus === 'PREPARING' || info.hotStatus === 'NEW') {
      return { key: 'PREPARING', label: 'Preparing', border: '#F39C12', fill: 'rgba(243,156,18,0.14)', text: '#F39C12' }
    }
    if (info.hotStatus === 'CONFIRMED') {
      return { key: 'CONFIRMED', label: 'Confirmed', border: '#9B59B6', fill: 'rgba(155,89,182,0.12)', text: '#9B59B6' }
    }
    return { key: 'OCCUPIED', label: 'Occupied', border: '#3498DB', fill: 'rgba(52,152,219,0.10)', text: '#3498DB' }
  }

  if (info.orderCount > 0) {
    return { key: 'SETTLED', label: 'Settled', border: '#94A3B8', fill: 'rgba(148,163,184,0.08)', text: '#94A3B8' }
  }

  return { key: 'FREE', label: 'Free', border: '#2ECC71', fill: 'rgba(46,204,113,0.06)', text: '#2ECC71' }
}

export function shapeRadius(shape: string): string {
  switch (shape) {
    case 'ROUND':
    case 'OVAL':
      return '50%'
    case 'SQUARE':
      return '10%'
    case 'BOOTH':
      return '28% 28% 10% 10%'
    default:
      return '16%'
  }
}

interface DragState {
  kind: 'table' | 'zone' | 'resize-table' | 'resize-zone' | 'draw'
  id?: string
  startClientX: number
  startClientY: number
  baseX: number
  baseY: number
  baseW: number
  baseH: number
  moved: boolean
  curX: number
  curY: number
  curW: number
  curH: number
}

interface FloorCanvasProps {
  tables: FloorTable[]
  zones: FloorZone[]
  orders?: any[]
  mode: 'view' | 'edit'
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onMoveTable?: (id: string, x: number, y: number) => void
  onResizeTable?: (id: string, width: number, height: number) => void
  onMoveZone?: (id: string, x: number, y: number) => void
  onResizeZone?: (id: string, width: number, height: number) => void
  onZoneDrawn?: (zone: { positionX: number; positionY: number; width: number; height: number }) => void
  drawMode?: boolean
  className?: string
  emptyHint?: string
  onRequestAdd?: () => void
}

export default function FloorCanvas({
  tables, zones, orders, mode,
  selectedId, onSelect,
  onMoveTable, onResizeTable, onMoveZone, onResizeZone,
  onZoneDrawn, drawMode = false, className = '', emptyHint, onRequestAdd,
}: FloorCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({})
  const dragRef = useRef<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const unitRect = useCallback(() => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { left: rect.left, top: rect.top, k: S * zoom }
  }, [zoom])

  const canvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const { left, top, k } = unitRect()
      return { x: (clientX - left) / k, y: (clientY - top) / k }
    },
    [unitRect]
  )

  const clampX = (x: number, w: number) => Math.min(Math.max(x, 0), MAX_UNITS_X - w)
  const clampY = (y: number, h: number) => Math.min(Math.max(y, 0), MAX_UNITS_Y - h)
  const snap = (v: number) => Math.round(v)

  const beginDrag = (e: React.PointerEvent, kind: DragState['kind'], id: string | undefined, baseX: number, baseY: number, baseW: number, baseH: number) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { kind, id, startClientX: e.clientX, startClientY: e.clientY, baseX, baseY, baseW, baseH, moved: false, curX: baseX, curY: baseY, curW: baseW, curH: baseH }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return

    const p = canvasPoint(e.clientX, e.clientY)
    const dx = p.x - canvasPoint(drag.startClientX, drag.startClientY).x
    const dy = p.y - canvasPoint(drag.startClientX, drag.startClientY).y

    if (Math.abs(e.clientX - drag.startClientX) + Math.abs(e.clientY - drag.startClientY) > 4) {
      drag.moved = true
    }
    if (!drag.moved) return

    if (drag.kind === 'table' || drag.kind === 'zone') {
      const x = clampX(drag.baseX + dx, drag.baseW)
      const y = clampY(drag.baseY + dy, drag.baseH)
      drag.curX = x
      drag.curY = y
      setDrafts((d) => ({ ...d, [drag.id!]: { x, y, w: drag.baseW, h: drag.baseH } }))
    } else if (drag.kind === 'resize-table' || drag.kind === 'resize-zone') {
      const w = Math.max(1, drag.baseW + dx)
      const h = Math.max(1, drag.baseH + dy)
      drag.curW = w
      drag.curH = h
      setDrafts((d) => ({ ...d, [drag.id!]: { x: drag.baseX, y: drag.baseY, w, h } }))
    } else if (drag.kind === 'draw') {
      const x = Math.min(drag.baseX, p.x)
      const y = Math.min(drag.baseY, p.y)
      const w = Math.max(1, snap(Math.abs(p.x - drag.baseX)))
      const h = Math.max(1, snap(Math.abs(p.y - drag.baseY)))
      setDrawRect({ x: clampX(x, 0), y: clampY(y, 0), w: Math.min(w, MAX_UNITS_X), h: Math.min(h, MAX_UNITS_Y) })
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    dragRef.current = null

    if (drag.kind === 'table') {
      if (drag.moved) {
        onMoveTable?.(drag.id!, Math.round(drag.curX), Math.round(drag.curY))
      } else if (onSelect) {
        onSelect(drag.id!)
      }
      setDrafts((s) => {
        const next = { ...s }
        delete next[drag.id!]
        return next
      })
    } else if (drag.kind === 'zone') {
      if (drag.moved) {
        onMoveZone?.(drag.id!, Math.round(drag.curX), Math.round(drag.curY))
      } else if (onSelect) {
        onSelect(drag.id!)
      }
      setDrafts((s) => {
        const next = { ...s }
        delete next[drag.id!]
        return next
      })
    } else if (drag.kind === 'resize-table') {
      onResizeTable?.(drag.id!, Math.max(1, Math.round(drag.curW)), Math.max(1, Math.round(drag.curH)))
      setDrafts((s) => {
        const next = { ...s }
        delete next[drag.id!]
        return next
      })
    } else if (drag.kind === 'resize-zone') {
      onResizeZone?.(drag.id!, Math.max(1, Math.round(drag.curW)), Math.max(1, Math.round(drag.curH)))
      setDrafts((s) => {
        const next = { ...s }
        delete next[drag.id!]
        return next
      })
    } else if (drag.kind === 'draw') {
      if (drawRect && drawRect.w >= 1 && drawRect.h >= 1 && onZoneDrawn) {
        onZoneDrawn({ positionX: drawRect.x, positionY: drawRect.y, width: drawRect.w, height: drawRect.h })
      }
      setDrawRect(null)
    }
  }

  const startDraw = (e: React.PointerEvent) => {
    if (!drawMode) return
    const p = canvasPoint(e.clientX, e.clientY)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'draw', startClientX: e.clientX, startClientY: e.clientY,
      baseX: clampX(p.x, 0), baseY: clampY(p.y, 0), baseW: 0, baseH: 0, moved: false,
      curX: 0, curY: 0, curW: 0, curH: 0,
    }
  }

  const fitZoom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const w = el.clientWidth - 32
    const h = el.clientHeight - 32
    const z = Math.min(Math.max(Math.min(w / CANVAS_W, h / CANVAS_H), 0.4), 1)
    setZoom(z)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    fitZoom()
    const ro = new ResizeObserver(() => fitZoom())
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitZoom])

  const renderedTables = tables.map((t) => {
    const d = drafts[t.id]
    return { ...t, positionX: d?.x ?? t.positionX, positionY: d?.y ?? t.positionY, width: d?.w ?? t.width, height: d?.h ?? t.height }
  })

  const statusFor = (t: FloorTable) => (mode === 'edit' ? null : resolveTableStatus(t, orders))

  return (
    <div className={`relative overflow-auto ${className || 'h-[calc(100vh-280px)]'}`} ref={containerRef}>
      <div
        className="relative bg-white dark:bg-primary-light rounded-2xl border border-gray-200 dark:border-white/10 shadow-soft overflow-hidden"
        style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
      >
        <div
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            backgroundImage: 'radial-gradient(circle, rgba(100,116,139,0.18) 1px, transparent 1px)',
            backgroundSize: `${S}px ${S}px`,
            touchAction: 'none',
            cursor: drawMode ? 'crosshair' : 'default',
          }}
          onPointerDown={startDraw}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
        >
          {zones.map((z) => {
            const d = drafts[z.id]
            const x = d?.x ?? z.positionX
            const y = d?.y ?? z.positionY
            const w = d?.w ?? z.width
            const h = d?.h ?? z.height
            const selected = selectedId === z.id
            return (
              <div
                key={z.id}
                className="absolute rounded-2xl"
                style={{
                  left: x * S, top: y * S, width: w * S, height: h * S,
                  background: hexToRgba(z.color, 0.13),
                  border: `1.5px dashed ${hexToRgba(z.color, 0.65)}`,
                  boxShadow: selected ? `0 0 0 2px var(--color-secondary)` : undefined,
                  cursor: mode === 'edit' ? 'move' : 'default',
                }}
                onPointerDown={(e) => {
                  if (mode !== 'edit') return
                  beginDrag(e, 'zone', z.id, x, y, w, h)
                }}
              >
                <div className="absolute left-2 top-2 flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/80 dark:bg-black/30"
                  style={{ color: z.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                  {z.name}
                  <span className="opacity-60 font-normal">{z._count?.tables ?? 0} tbl</span>
                </div>
                {mode === 'edit' && (
                  <div
                    className="absolute bottom-1 right-1 w-4 h-4 rounded-md bg-white border border-gray-300 dark:border-white/20 shadow cursor-nwse-resize"
                    onPointerDown={(e) => beginDrag(e, 'resize-zone', z.id, x, y, w, h)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                  />
                )}
              </div>
            )
          })}

          {drawRect && (
            <div
              className="absolute rounded-2xl border-2 border-dashed border-secondary pointer-events-none"
              style={{
                left: drawRect.x * S, top: drawRect.y * S, width: drawRect.w * S, height: drawRect.h * S,
                background: 'rgba(255,107,53,0.08)',
              }}
            />
          )}

          {renderedTables.map((t) => {
            const selected = selectedId === t.id
            const status = statusFor(t)
            const info = ordersAtTable(t, orders)
            const isEdit = mode === 'edit'
            const radius = shapeRadius(t.shape)
            return (
              <div
                key={t.id}
                className="absolute flex items-center justify-center select-none"
                style={{
                  left: t.positionX * S, top: t.positionY * S,
                  width: t.width * S, height: t.height * S,
                  transform: `rotate(${t.rotation || 0}deg)`,
                  borderRadius: radius,
                  background: isEdit
                    ? selected
                      ? 'linear-gradient(135deg, var(--color-secondary), var(--color-accent))'
                      : 'var(--color-card)'
                    : status!.fill,
                  border: isEdit
                    ? `2px solid ${selected ? 'var(--color-secondary)' : 'rgba(100,116,139,0.35)'}`
                    : `2px solid ${status!.border}`,
                  boxShadow: selected
                    ? `0 0 0 3px rgba(255,107,53,0.35), 0 6px 16px rgba(0,0,0,0.12)`
                    : '0 2px 8px rgba(0,0,0,0.08)',
                  cursor: isEdit ? 'grab' : 'pointer',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  if (isEdit) {
                    beginDrag(e, 'table', t.id, t.positionX, t.positionY, t.width, t.height)
                  } else {
                    e.stopPropagation()
                    onSelect?.(t.id)
                  }
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                title={`${t.label} — ${status?.label ?? t.status}`}
              >
                {!isEdit && status!.pulse && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-primary-light animate-ping"
                    style={{ background: status!.border }} />
                )}
                {isEdit && (
                  <span
                    className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-white/60"
                    style={{
                      background: resolveTableStatus(t, orders).border,
                    }}
                  />
                )}
                <div className="text-center leading-none pointer-events-none" style={{ transform: `rotate(${-(t.rotation || 0)}deg)` }}>
                  <div
                    className="font-heading font-bold"
                    style={{
                      fontSize: Math.max(9, Math.min(20, t.width * 5)),
                      color: isEdit && selected ? '#fff' : 'var(--color-text-primary)',
                    }}
                  >
                    {t.tableNumber}
                  </div>
                  {isEdit ? (
                    t.capacity ? (
                      <div className="text-[9px] opacity-60" style={{ color: selected ? '#fff' : 'var(--color-text-secondary)' }}>
                        {t.capacity} seats
                      </div>
                    ) : null
                  ) : info.unpaidCount > 0 ? (
                    <div className="text-[9px] font-semibold" style={{ color: status!.text }}>
                      {info.unpaidCount} ord · KES {Math.round(info.total).toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-[9px] font-medium opacity-70" style={{ color: status!.text }}>
                      {status!.label}
                    </div>
                  )}
                </div>
                {isEdit && (
                  <div
                    className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-md bg-white border border-gray-300 dark:border-white/20 shadow cursor-nwse-resize"
                    onPointerDown={(e) => beginDrag(e, 'resize-table', t.id, t.positionX, t.positionY, t.width, t.height)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                  />
                )}
              </div>
            )
          })}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <Pencil className="w-7 h-7 text-text-secondary/50" />
              </div>
              <p className="text-sm text-text-secondary font-medium">{emptyHint || 'Draw your floor plan — add tables and zones'}</p>
              {onRequestAdd && (
                <button onClick={onRequestAdd} className="pointer-events-auto px-4 py-2 rounded-xl text-sm font-semibold text-white bg-secondary hover:bg-secondary-dark transition-colors">
                  Add first table
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5">
        <button onClick={() => setZoom((z) => Math.min(z + 0.15, 1.6))} className="w-9 h-9 rounded-xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 shadow flex items-center justify-center text-text-secondary hover:text-secondary transition-colors" title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))} className="w-9 h-9 rounded-xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 shadow flex items-center justify-center text-text-secondary hover:text-secondary transition-colors" title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={fitZoom} className="w-9 h-9 rounded-xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 shadow flex items-center justify-center text-text-secondary hover:text-secondary transition-colors" title="Fit to screen">
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="w-9 text-center text-[10px] font-medium text-text-secondary bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 rounded-lg py-0.5 shadow">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  )
}
