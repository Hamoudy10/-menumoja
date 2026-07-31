import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Save, Square, Circle, RectangleHorizontal, Armchair,
  Layers, List, Map, Grid3X3, RotateCcw, RotateCw, Trash2, QrCode, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '@/store/useStore'
import FloorCanvas, { resolveTableStatus } from '@/components/floor/FloorCanvas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import type { FloorTable, FloorZone, TableShape } from '@/types'

const SHAPE_OPTIONS: { value: TableShape; icon: LucideIcon; label: string }[] = [
  { value: 'ROUND', icon: Circle, label: 'Round' },
  { value: 'SQUARE', icon: Square, label: 'Square' },
  { value: 'RECTANGLE', icon: RectangleHorizontal, label: 'Rectangle' },
  { value: 'OVAL', icon: Circle, label: 'Oval' },
  { value: 'BOOTH', icon: Armchair, label: 'Booth' },
]

const ZONE_COLORS = ['#CBD5E1', '#FED7AA', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FDE68A', '#DDD6FE', '#99F6E4']

const LEGEND = [
  { key: 'FREE', label: 'Free', color: '#2ECC71' },
  { key: 'OCCUPIED', label: 'Occupied', color: '#3498DB' },
  { key: 'PREPARING', label: 'Preparing', color: '#F39C12' },
  { key: 'READY', label: 'Ready', color: '#2ECC71', pulse: true },
  { key: 'RESERVED', label: 'Reserved', color: '#3498DB', dashed: true },
  { key: 'UNAVAILABLE', label: 'Unavailable', color: '#94A3B8' },
]

const emptyTableForm = { tableNumber: '', label: '', capacity: '4', area: '', shape: 'ROUND' as TableShape, zoneId: '' }

export default function TablesPage() {
  const { tables, zones, orders, fetchTables, fetchZones, fetchOrders, updateTable, removeTable, createTable, setTableStatus, createZone, updateZone, removeZone } = useStore()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [zoneSaving, setZoneSaving] = useState(false)
  const [view, setView] = useState<'floor' | 'list'>('floor')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState(false)
  const [showTableForm, setShowTableForm] = useState(false)
  const [editTable, setEditTable] = useState<FloorTable | null>(null)
  const [form, setForm] = useState({ ...emptyTableForm })
  const [showBulk, setShowBulk] = useState(false)
  const [bulkForm, setBulkForm] = useState({ startNumber: '1', count: '8', capacity: '4', shape: 'ROUND' as TableShape, zoneId: '' })
  const [zoneModal, setZoneModal] = useState<{ mode: 'create' | 'edit'; zone?: FloorZone; draft?: { positionX: number; positionY: number; width: number; height: number } } | null>(null)
  const [zoneForm, setZoneForm] = useState({ name: '', color: ZONE_COLORS[0] })

  useEffect(() => {
    Promise.all([fetchTables(), fetchZones(), fetchOrders()]).finally(() => setLoading(false))
  }, [])

  const selectedTable = useMemo(() => tables.find((t) => t.id === selectedId) || null, [tables, selectedId])
  const selectedZone = useMemo(() => zones.find((z) => z.id === selectedId) || null, [zones, selectedId])

  const handleSelect = (id: string | null) => {
    setSelectedId(id)
    if (id) {
      const zone = zones.find((z) => z.id === id)
      if (zone) setZoneForm({ name: zone.name, color: zone.color })
    }
  }

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchTables(), fetchZones(), fetchOrders()])
    } finally {
      setRefreshing(false)
    }
  }, [fetchTables, fetchZones, fetchOrders])

  const openCreateTable = () => {
    setEditTable(null)
    setForm({ ...emptyTableForm })
    setShowTableForm(true)
  }

  const openEditTable = (table: FloorTable) => {
    setEditTable(table)
    setForm({
      tableNumber: String(table.tableNumber),
      label: table.label,
      capacity: String(table.capacity || 4),
      area: table.area || '',
      shape: (table.shape || 'ROUND') as TableShape,
      zoneId: table.zoneId || '',
    })
    setShowTableForm(true)
  }

  const handleSaveTable = async () => {
    if (!form.tableNumber || !form.label) return
    const payload = {
      tableNumber: parseInt(form.tableNumber),
      label: form.label,
      capacity: parseInt(form.capacity) || 4,
      area: form.area || undefined,
      shape: form.shape,
      zoneId: form.zoneId || undefined,
    }
    setSaving(true)
    try {
      if (editTable) {
        await updateTable(editTable.id, payload)
        showSuccessToast('Table updated')
      } else {
        const highest = tables.reduce((m, t) => Math.max(m, t.positionY * 100 + t.positionX), 0)
        await createTable({ ...payload, positionX: (highest % 100) + 2, positionY: Math.floor(highest / 100) + 2 })
        showSuccessToast('Table created')
        refresh()
      }
      setShowTableForm(false)
      setSelectedId(editTable?.id ?? null)
    } catch { showErrorToast('Failed to save table') } finally { setSaving(false) }
  }

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Delete this table?')) return
    try {
      await removeTable(id)
      setSelectedId(null)
      showSuccessToast('Table deleted')
    } catch { showErrorToast('Failed to delete table') }
  }

  const handleBulkAdd = async () => {
    const count = parseInt(bulkForm.count)
    const start = parseInt(bulkForm.startNumber)
    if (!count || count < 1 || count > 50 || !start || start < 1) { showErrorToast('Invalid bulk add values'); return }
    setBulkSaving(true)
    const width = bulkForm.shape === 'ROUND' || bulkForm.shape === 'SQUARE' ? 2 : bulkForm.shape === 'OVAL' ? 3 : 4
    const height = bulkForm.shape === 'ROUND' || bulkForm.shape === 'SQUARE' ? 2 : bulkForm.shape === 'OVAL' ? 2 : 2
    const perRow = 7
    const { createTable } = await import('@/api/tables')
    try {
      let i = 0
      for (let n = start; n < start + count; n++) {
        const col = i % perRow
        const row = Math.floor(i / perRow)
        await createTable({
          tableNumber: n,
          label: `Table ${n}`,
          capacity: parseInt(bulkForm.capacity) || 4,
          shape: bulkForm.shape,
          zoneId: bulkForm.zoneId || undefined,
          positionX: 2 + col * 3,
          positionY: 2 + row * 3,
          width, height,
        })
        i++
      }
      showSuccessToast(`${count} tables created`)
      setShowBulk(false)
      refresh()
    } catch { showErrorToast('Failed to create tables') } finally { setBulkSaving(false) }
  }

  const handleZoneDrawn = (draft: { positionX: number; positionY: number; width: number; height: number }) => {
    setZoneForm({ name: `Zone ${zones.length + 1}`, color: ZONE_COLORS[zones.length % ZONE_COLORS.length] })
    setZoneModal({ mode: 'create', draft })
    setDrawMode(false)
  }

  const handleSaveZone = async () => {
    if (!zoneModal) return
    setZoneSaving(true)
    try {
      if (zoneModal.mode === 'edit' && zoneModal.zone) {
        await updateZone(zoneModal.zone.id, { name: zoneForm.name, color: zoneForm.color })
        showSuccessToast('Zone updated')
      } else {
        await createZone({
          name: zoneForm.name,
          color: zoneForm.color,
          ...(zoneModal.draft || { positionX: 2, positionY: 2, width: 12, height: 8 }),
        })
        showSuccessToast('Zone created')
      }
      setZoneModal(null)
      refresh()
    } catch { showErrorToast('Failed to save zone') } finally { setZoneSaving(false) }
  }

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Delete this zone? Tables inside it will be kept.')) return
    try {
      await removeZone(id)
      setSelectedId(null)
      showSuccessToast('Zone deleted')
    } catch { showErrorToast('Failed to delete zone') }
  }

  const tableStatus = selectedTable ? resolveTableStatus(selectedTable, orders) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Tables &amp; Floor Plan</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Design your seating layout — it syncs with the waiter floor view and kitchen</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-black/5 dark:bg-white/10 p-1">
            <button onClick={() => setView('floor')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'floor' ? 'bg-white dark:bg-primary-light text-secondary shadow' : 'text-text-secondary'}`}>
              <Map className="w-3.5 h-3.5" /> Floor
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'list' ? 'bg-white dark:bg-primary-light text-secondary shadow' : 'text-text-secondary'}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <RefreshButton refreshing={refreshing} onClick={refresh} />
          <Button variant="outline" onClick={() => setShowBulk(true)}><Grid3X3 className="h-4 w-4" /> Bulk Add</Button>
          <Button onClick={openCreateTable}><Plus className="h-4 w-4" /> Add Table</Button>
        </div>
      </div>

      {view === 'floor' ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDrawMode(!drawMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                drawMode ? 'bg-secondary text-white border-secondary' : 'bg-white dark:bg-primary-light border-gray-200 dark:border-white/10 text-text-secondary hover:border-secondary'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> {drawMode ? 'Drawing… click & drag on canvas' : 'Add Zone'}
            </button>
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10">
              {LEGEND.map((l) => (
                <span key={l.key} className="flex items-center gap-1 text-[10px] font-medium text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded-sm border" style={{ background: l.color, borderColor: l.color, ...(l.dashed ? { borderStyle: 'dashed', background: 'transparent' } : {}) }} />
                  {l.label}
                </span>
              ))}
            </div>
            <span className="text-[11px] text-text-secondary ml-auto hidden sm:block">Drag tables to move · corner handle to resize · click to edit</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <FloorCanvas
              tables={tables}
              zones={zones}
              orders={orders}
              mode="edit"
              selectedId={selectedId}
              onSelect={handleSelect}
              onMoveTable={async (id, x, y) => { try { await updateTable(id, { positionX: x, positionY: y }) } catch { showErrorToast('Failed to save position') } }}
              onResizeTable={async (id, w, h) => { try { await updateTable(id, { width: w, height: h }) } catch { showErrorToast('Failed to save size') } }}
              onMoveZone={async (id, x, y) => { try { await updateZone(id, { positionX: x, positionY: y }) } catch { showErrorToast('Failed to save zone') } }}
              onResizeZone={async (id, w, h) => { try { await updateZone(id, { width: w, height: h }) } catch { showErrorToast('Failed to save zone') } }}
              onZoneDrawn={handleZoneDrawn}
              drawMode={drawMode}
              onRequestAdd={openCreateTable}
            />
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {loading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="card" />)
          ) : (
            <>
          {tables.map((table) => {
            const st = resolveTableStatus(table, orders)
            const ShapeIcon = SHAPE_OPTIONS.find((s) => s.value === (table.shape || 'ROUND'))?.icon || Circle
            return (
              <motion.div
                key={table.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border-2 p-4 text-center transition-all hover:shadow-soft cursor-pointer bg-white dark:bg-primary-light"
                style={{ borderColor: st.border }}
                onClick={() => { setView('floor'); setSelectedId(table.id) }}
              >
                <ShapeIcon className="h-8 w-8 mx-auto mb-2" style={{ color: st.border }} />
                <p className="font-heading text-xl font-bold text-text-primary dark:text-white">T{table.tableNumber}</p>
                <p className="text-xs text-text-secondary font-medium truncate">{table.label}</p>
                <p className="text-[10px] mt-1 px-2 py-0.5 rounded-full inline-block font-medium" style={{ color: st.text, background: `${st.fill}`, border: `1px solid ${st.border}66` }}>
                  {st.label}
                </p>
                {table.zone?.name && <p className="text-[10px] text-text-secondary mt-1.5 truncate">{table.zone.name}</p>}
              </motion.div>
            )
          })}
          {tables.length === 0 && !loading && (
            <div className="col-span-full text-center py-16">
              <Map className="w-12 h-12 text-text-secondary/30 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-text-primary mb-2">No tables yet</h2>
              <p className="text-sm text-text-secondary mb-6">Add your first table or use Bulk Add to generate many at once</p>
              <div className="flex justify-center gap-2">
                <Button onClick={openCreateTable}><Plus className="h-4 w-4" /> Add Table</Button>
                <Button variant="outline" onClick={() => setShowBulk(true)}><Grid3X3 className="h-4 w-4" /> Bulk Add</Button>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {(selectedTable || selectedZone) && (
          <motion.div
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-4 bottom-4 z-30 w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-white/10 bg-white dark:bg-primary-light px-4 py-3">
              <h2 className="font-heading text-base font-bold text-text-primary dark:text-white">
                {selectedTable ? `Table ${selectedTable.tableNumber} · ${selectedTable.label}` : `Zone · ${selectedZone!.name}`}
              </h2>
              <button onClick={() => handleSelect(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4 text-text-secondary" /></button>
            </div>

            {selectedTable ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: tableStatus!.text, background: tableStatus!.fill, border: `1px solid ${tableStatus!.border}` }}>
                    {tableStatus!.label}
                  </span>
                  {selectedTable.status === 'OCCUPIED' && (
                    <button onClick={() => setTableStatus(selectedTable.id, 'FREE')} className="text-[11px] font-semibold text-success hover:underline">
                      Mark free
                    </button>
                  )}
                  {selectedTable.status !== 'UNAVAILABLE' && selectedTable.status !== 'RESERVED' && selectedTable.status !== 'OCCUPIED' && (
                    <button onClick={() => setTableStatus(selectedTable.id, 'UNAVAILABLE')} className="text-[11px] font-semibold text-text-secondary hover:underline">
                      Mark unavailable
                    </button>
                  )}
                </div>
                {selectedTable.qrCode && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary bg-gray-50 dark:bg-white/5 rounded-xl p-2.5">
                    <QrCode className="w-4 h-4 shrink-0" /> QR ready · {selectedTable.qrCode.scanCount ?? 0} scans
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Table Number" type="number" value={String(selectedTable.tableNumber)} onChange={(e) => updateTable(selectedTable.id, { tableNumber: parseInt(e.target.value) || selectedTable.tableNumber })} />
                  <Input label="Capacity" type="number" value={String(selectedTable.capacity || 4)} onChange={(e) => updateTable(selectedTable.id, { capacity: parseInt(e.target.value) || 4 })} />
                </div>
                <Input label="Label / Name" value={selectedTable.label} onChange={(e) => updateTable(selectedTable.id, { label: e.target.value })} />

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Shape</label>
                  <div className="flex gap-1.5">
                    {SHAPE_OPTIONS.map((s) => (
                      <button key={s.value} onClick={() => updateTable(selectedTable.id, { shape: s.value })}
                        title={s.label}
                        className={`flex-1 flex items-center justify-center rounded-lg p-2 transition-all ${selectedTable.shape === s.value ? 'bg-secondary text-white' : 'bg-gray-100 dark:bg-white/5 text-text-secondary hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                        <s.icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Zone</label>
                  <select
                    value={selectedTable.zoneId || ''}
                    onChange={(e) => updateTable(selectedTable.id, { zoneId: e.target.value || null })}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-primary-light px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  >
                    <option value="">No zone</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input label="Position X" type="number" value={String(selectedTable.positionX)} onChange={(e) => updateTable(selectedTable.id, { positionX: parseInt(e.target.value) || 0 })} />
                  <Input label="Position Y" type="number" value={String(selectedTable.positionY)} onChange={(e) => updateTable(selectedTable.id, { positionY: parseInt(e.target.value) || 0 })} />
                  <Input label="Width" type="number" min={1} value={String(selectedTable.width)} onChange={(e) => updateTable(selectedTable.id, { width: parseInt(e.target.value) || 1 })} />
                  <Input label="Height" type="number" min={1} value={String(selectedTable.height)} onChange={(e) => updateTable(selectedTable.id, { height: parseInt(e.target.value) || 1 })} />
                </div>

                <div className="flex items-center gap-2">
                  <label className="font-accent text-sm font-medium text-text-primary dark:text-white/90">Rotation</label>
                  <button onClick={() => updateTable(selectedTable.id, { rotation: (selectedTable.rotation - 15 + 360) % 360 })} className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-text-secondary hover:text-secondary"><RotateCcw className="w-4 h-4" /></button>
                  <span className="text-xs font-bold text-text-primary w-10 text-center">{selectedTable.rotation}°</span>
                  <button onClick={() => updateTable(selectedTable.id, { rotation: (selectedTable.rotation + 15) % 360 })} className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-text-secondary hover:text-secondary"><RotateCw className="w-4 h-4" /></button>
                  <button onClick={() => updateTable(selectedTable.id, { rotation: 0 })} className="ml-auto text-[11px] font-semibold text-text-secondary hover:text-secondary">Reset</button>
                </div>

                {selectedTable.sessions?.[0] && !selectedTable.sessions[0].endedAt && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary bg-success/5 border border-success/20 rounded-xl p-2.5">
                    <Users className="w-4 h-4 text-success" />
                    Seated since {new Date(selectedTable.sessions[0].startedAt).toLocaleTimeString()}
                    {selectedTable.sessions[0].guestCount ? ` · ${selectedTable.sessions[0].guestCount} guests` : ''}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-white/10">
                  <Button fullWidth variant="outline" onClick={() => openEditTable(selectedTable)}><Save className="h-4 w-4" /> Edit Details</Button>
                  <Button fullWidth variant="ghost" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => handleDeleteTable(selectedTable.id)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            ) : selectedZone ? (
              <div className="p-4 space-y-3">
                <Input label="Zone Name" value={zoneForm.name} onChange={(e) => { setZoneForm({ ...zoneForm, name: e.target.value }); updateZone(selectedZone.id, { name: e.target.value }) }} />
                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {ZONE_COLORS.map((c) => (
                      <button key={c} onClick={() => { setZoneForm({ ...zoneForm, color: c }); updateZone(selectedZone.id, { color: c }) }}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${selectedZone.color === c ? 'border-secondary scale-110' : 'border-white/20'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="X" type="number" value={String(selectedZone.positionX)} onChange={(e) => updateZone(selectedZone.id, { positionX: parseInt(e.target.value) || 0 })} />
                  <Input label="Y" type="number" value={String(selectedZone.positionY)} onChange={(e) => updateZone(selectedZone.id, { positionY: parseInt(e.target.value) || 0 })} />
                  <Input label="Width" type="number" min={2} value={String(selectedZone.width)} onChange={(e) => updateZone(selectedZone.id, { width: parseInt(e.target.value) || 2 })} />
                  <Input label="Height" type="number" min={2} value={String(selectedZone.height)} onChange={(e) => updateZone(selectedZone.id, { height: parseInt(e.target.value) || 2 })} />
                </div>
                <p className="text-xs text-text-secondary">{selectedZone._count?.tables ?? 0} tables in this zone</p>
                <Button fullWidth variant="ghost" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => handleDeleteZone(selectedZone.id)}>
                  <Trash2 className="h-4 w-4" /> Delete Zone
                </Button>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTableForm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowTableForm(false)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-primary-light border-l border-white/10 shadow-soft overflow-y-auto"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-white/10 bg-white dark:bg-primary-light p-4">
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">{editTable ? 'Edit Table' : 'Add Table'}</h2>
                <button onClick={() => setShowTableForm(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="h-5 w-5 text-text-secondary" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Table Number" type="number" value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} />
                  <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
                <Input label="Label / Name" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Window Table 1" />
                <Input label="Area (text)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Terrace (optional)" />

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Table Shape</label>
                  <div className="flex gap-1.5">
                    {SHAPE_OPTIONS.map((s) => (
                      <button key={s.value} onClick={() => setForm({ ...form, shape: s.value })}
                        className={`flex-1 flex flex-col items-center gap-1 rounded-xl p-3 text-[10px] font-medium transition-all ${form.shape === s.value ? 'bg-secondary text-white' : 'bg-gray-100 dark:bg-white/5 text-text-secondary hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                        <s.icon className="h-4 w-4" /> {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Zone</label>
                  <select value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-primary-light px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-secondary/20">
                    <option value="">No zone</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
                  <Button fullWidth loading={saving} disabled={saving} onClick={handleSaveTable}><Save className="h-4 w-4" /> {editTable ? 'Update' : 'Create'}</Button>
                  {editTable && (
                    <Button fullWidth variant="ghost" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => handleDeleteTable(editTable.id)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulk && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowBulk(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 m-auto w-[calc(100vw-2rem)] max-w-md h-fit rounded-2xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 shadow-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">Bulk Add Tables</h2>
                <button onClick={() => setShowBulk(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4 text-text-secondary" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Input label="Start Number" type="number" value={bulkForm.startNumber} onChange={(e) => setBulkForm({ ...bulkForm, startNumber: e.target.value })} disabled={bulkSaving} />
                <Input label="How Many" type="number" value={bulkForm.count} onChange={(e) => setBulkForm({ ...bulkForm, count: e.target.value })} disabled={bulkSaving} />
                <Input label="Capacity" type="number" value={bulkForm.capacity} onChange={(e) => setBulkForm({ ...bulkForm, capacity: e.target.value })} disabled={bulkSaving} />
                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Shape</label>
                  <select value={bulkForm.shape} onChange={(e) => setBulkForm({ ...bulkForm, shape: e.target.value as TableShape })} disabled={bulkSaving}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-primary-light px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:cursor-not-allowed disabled:opacity-50">
                    {SHAPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Zone</label>
                <select value={bulkForm.zoneId} onChange={(e) => setBulkForm({ ...bulkForm, zoneId: e.target.value })} disabled={bulkSaving}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-primary-light px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-secondary/20 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="">No zone</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <p className="text-xs text-text-secondary mb-4">Tables are auto-arranged on the floor plan — drag them where you want afterwards.</p>
              <Button fullWidth loading={bulkSaving} disabled={bulkSaving} onClick={handleBulkAdd}><Grid3X3 className="h-4 w-4" /> Create {bulkForm.count || 0} Tables</Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {zoneModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setZoneModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 m-auto w-[calc(100vw-2rem)] max-w-sm h-fit rounded-2xl bg-white dark:bg-primary-light border border-gray-200 dark:border-white/10 shadow-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">New Zone</h2>
                <button onClick={() => setZoneModal(null)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4 text-text-secondary" /></button>
              </div>
              <div className="space-y-4">
                <Input label="Zone Name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="e.g. Main Hall" />
                <div>
                  <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {ZONE_COLORS.map((c) => (
                      <button key={c} onClick={() => setZoneForm({ ...zoneForm, color: c })}
                        className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${zoneForm.color === c ? 'border-secondary scale-110' : 'border-white/20'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <Button fullWidth loading={zoneSaving} disabled={zoneSaving} onClick={handleSaveZone}><Save className="h-4 w-4" /> Create Zone</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
