import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, UserPlus, ListOrdered, Plus, X, RefreshCw, LogIn, XCircle, Clock, Users, Armchair } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as reservationsApi from '@/api/reservations'
import * as tablesApi from '@/api/tables'

const RES_STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: 'Confirmed', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  CHECKED_IN: { label: 'Checked in', cls: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-500/10 text-gray-500' },
  NO_SHOW: { label: 'No show', cls: 'bg-red-500/10 text-red-500' },
  COMPLETED: { label: 'Completed', cls: 'bg-gray-500/10 text-gray-500' },
}

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reservations, setReservations] = useState<any[]>([])
  const [waitlist, setWaitlist] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])

  const [showResModal, setShowResModal] = useState(false)
  const [resForm, setResForm] = useState({ customerName: '', customerPhone: '', partySize: '2', reservedAt: '', notes: '' })
  const [savingRes, setSavingRes] = useState(false)

  const [showWaitModal, setShowWaitModal] = useState(false)
  const [waitForm, setWaitForm] = useState({ customerName: '', customerPhone: '', partySize: '2' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, wait, tablesRes] = await Promise.all([
        reservationsApi.fetchReservations(date),
        reservationsApi.fetchWaitlist(),
        tablesApi.fetchTables(),
      ])
      setReservations(Array.isArray(res) ? res : [])
      setWaitlist(Array.isArray(wait) ? wait : [])
      const raw = Array.isArray(tablesRes) ? tablesRes : tablesRes?.tables || tablesRes
      setTables(Array.isArray(raw) ? raw : [])
    } catch { showErrorToast('Failed to load reservations') }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  const createReservation = async () => {
    if (!resForm.customerName.trim() || !resForm.customerPhone.trim() || !resForm.reservedAt) {
      showErrorToast('Name, phone and time are required'); return
    }
    setSavingRes(true)
    try {
      await reservationsApi.createReservation({
        customerName: resForm.customerName.trim(),
        customerPhone: resForm.customerPhone.trim(),
        partySize: Number(resForm.partySize),
        reservedAt: new Date(resForm.reservedAt).toISOString(),
        notes: resForm.notes.trim() || undefined,
      })
      showSuccessToast('Reservation created')
      setShowResModal(false)
      setResForm({ customerName: '', customerPhone: '', partySize: '2', reservedAt: '', notes: '' })
      load()
    } catch (err: any) { showErrorToast(err?.response?.data?.message || 'Failed to create reservation') }
    finally { setSavingRes(false) }
  }

  const addWait = async () => {
    if (!waitForm.customerName.trim() || !waitForm.customerPhone.trim()) { showErrorToast('Name and phone are required'); return }
    try {
      await reservationsApi.addToWaitlist({
        customerName: waitForm.customerName.trim(),
        customerPhone: waitForm.customerPhone.trim(),
        partySize: Number(waitForm.partySize),
      })
      showSuccessToast('Added to waitlist')
      setShowWaitModal(false)
      setWaitForm({ customerName: '', customerPhone: '', partySize: '2' })
      load()
    } catch { showErrorToast('Failed to add to waitlist') }
  }

  const actReservation = async (id: string, action: 'check-in' | 'cancel' | 'no-show') => {
    try {
      const fn = action === 'check-in' ? reservationsApi.checkInReservation : action === 'cancel' ? reservationsApi.cancelReservation : reservationsApi.markNoShow
      await fn(id)
      showSuccessToast(action === 'check-in' ? 'Checked in' : action === 'cancel' ? 'Reservation cancelled' : 'Marked no-show')
      load()
    } catch (err: any) { showErrorToast(err?.response?.data?.message || 'Action failed') }
  }

  const seatFromWaitlist = async (entryId: string) => {
    const freeTable = tables.find((t) => t.status === 'FREE' && (!t.capacity || t.capacity >= Number(waitForm.partySize) || true))
    const candidate = freeTable || tables.find((t) => t.status === 'FREE')
    if (!candidate) { showErrorToast('No free table available'); return }
    if (!confirm(`Seat this party at ${candidate.label || `Table ${candidate.tableNumber}`}?`)) return
    try {
      await reservationsApi.seatWaitlist(entryId, candidate.id)
      showSuccessToast('Party seated')
      load()
    } catch (err: any) { showErrorToast(err?.response?.data?.message || 'Seating failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Reservations & Waitlist</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Bookings, check-ins and walk-in queue</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto text-sm" />
          <Button size="sm" onClick={() => setShowResModal(true)}><Plus className="h-3.5 w-3.5" /> Reservation</Button>
          <Button size="sm" variant="outline" onClick={() => setShowWaitModal(true)}><UserPlus className="h-3.5 w-3.5" /> Add to Waitlist</Button>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton variant="card" className="h-72" />
          <Skeleton variant="card" className="h-72" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Reservations */}
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-secondary" /> Reservations
            </h3>
            {reservations.length === 0 ? (
              <EmptyState icon={<CalendarDays className="h-10 w-10" />} title="No reservations" description="Bookings for this day appear here" />
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto">
                {reservations.map((r) => (
                  <div key={r.id} className={`rounded-xl p-3 border ${r.status === 'CANCELLED' || r.status === 'NO_SHOW' ? 'border-white/10 opacity-60' : 'border-black/5 dark:border-white/10'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-bold text-text-primary dark:text-white truncate">{r.customerName}</p>
                        <p className="font-accent text-xs text-text-secondary mt-0.5">
                          {new Date(r.reservedAt).toLocaleTimeString('en-KE', { hour12: true })} · {r.partySize} guest(s)
                          {r.table?.label ? ` · ${r.table.label}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RES_STATUS[r.status]?.cls || ''}`}>{RES_STATUS[r.status]?.label || r.status}</span>
                      </div>
                    </div>
                    {(r.status === 'CONFIRMED' || r.status === 'CHECKED_IN') && (
                      <div className="flex gap-1.5 mt-2">
                        {r.status === 'CONFIRMED' && <Button size="sm" onClick={() => actReservation(r.id, 'check-in')}><LogIn className="h-3 w-3" /> Check in</Button>}
                        <Button size="sm" variant="outline" onClick={() => actReservation(r.id, 'cancel')}><XCircle className="h-3 w-3" /> Cancel</Button>
                        {r.status === 'CONFIRMED' && <Button size="sm" variant="ghost" onClick={() => actReservation(r.id, 'no-show')}>No show</Button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waitlist */}
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-3 flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-secondary" /> Waitlist
            </h3>
            {waitlist.length === 0 ? (
              <EmptyState icon={<ListOrdered className="h-10 w-10" />} title="Waitlist is empty" description="Walk-in parties added here wait for a free table" />
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto">
                {waitlist.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl p-3 border border-black/5 dark:border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center font-heading font-bold shrink-0">{w.position}</span>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-bold text-text-primary dark:text-white truncate">{w.customerName}</p>
                        <p className="font-accent text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                          <Users className="h-3 w-3" /> {w.partySize} · <Clock className="h-3 w-3" /> ~{w.estimatedWaitMinutes} min
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => seatFromWaitlist(w.id)}><Armchair className="h-3 w-3" /> Seat</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reservation modal */}
      {showResModal && (
        <ModalShell title="New Reservation" onClose={() => setShowResModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={resForm.customerName} onChange={(e) => setResForm({ ...resForm, customerName: e.target.value })} />
            <Input label="Phone *" type="tel" value={resForm.customerPhone} onChange={(e) => setResForm({ ...resForm, customerPhone: e.target.value })} placeholder="+2547XX XXX XXX" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Party size" type="number" min={1} value={resForm.partySize} onChange={(e) => setResForm({ ...resForm, partySize: e.target.value })} />
              <Input label="Time *" type="datetime-local" value={resForm.reservedAt} onChange={(e) => setResForm({ ...resForm, reservedAt: e.target.value })} />
            </div>
            <Input label="Notes" value={resForm.notes} onChange={(e) => setResForm({ ...resForm, notes: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button fullWidth loading={savingRes} onClick={createReservation}>Create Reservation</Button>
              <Button variant="ghost" onClick={() => setShowResModal(false)}>Cancel</Button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Waitlist modal */}
      {showWaitModal && (
        <ModalShell title="Add to Waitlist" onClose={() => setShowWaitModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={waitForm.customerName} onChange={(e) => setWaitForm({ ...waitForm, customerName: e.target.value })} />
            <Input label="Phone *" type="tel" value={waitForm.customerPhone} onChange={(e) => setWaitForm({ ...waitForm, customerPhone: e.target.value })} placeholder="+2547XX XXX XXX" />
            <Input label="Party size" type="number" min={1} value={waitForm.partySize} onChange={(e) => setWaitForm({ ...waitForm, partySize: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button fullWidth onClick={addWait}>Add to Waitlist</Button>
              <Button variant="ghost" onClick={() => setShowWaitModal(false)}>Cancel</Button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-md shadow-soft border border-white/10 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-lg text-text-primary dark:text-white">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><X className="h-4 w-4" /></button>
          </div>
          {children}
        </div>
      </motion.div>
    </>
  )
}
