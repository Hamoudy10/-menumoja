import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Megaphone, Gift, PartyPopper, Percent, Star, Trash2,
  Edit3, X, Calendar, Link2, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import * as promotionsApi from '@/api/promotions'
import * as menuApi from '@/api/menu'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import type { LucideIcon } from 'lucide-react'

interface PromotionItem {
  id: string
  name: string
  price: number
  photoUrl?: string | null
}

interface Promotion {
  id: string
  type: string
  title: string
  description?: string | null
  menuItemId?: string | null
  specialPrice?: number | null
  imageUrl?: string | null
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
  menuItem?: PromotionItem | null
}

interface MenuItemOption extends PromotionItem {
  categoryName?: string
}

const TYPE_META: Record<string, { label: string; icon: LucideIcon; badge: string; accent: string }> = {
  SPECIAL: { label: 'Special', icon: Star, badge: 'bg-orange-100 text-orange-700', accent: 'from-orange-500 to-amber-500' },
  OFFER: { label: 'Offer', icon: Percent, badge: 'bg-emerald-100 text-emerald-700', accent: 'from-emerald-500 to-teal-500' },
  EVENT: { label: 'Event', icon: PartyPopper, badge: 'bg-violet-100 text-violet-700', accent: 'from-violet-500 to-purple-500' },
  GIVEAWAY: { label: 'Giveaway', icon: Gift, badge: 'bg-rose-100 text-rose-700', accent: 'from-rose-500 to-pink-500' },
}

function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
}

const emptyForm = {
  type: 'SPECIAL' as string,
  title: '',
  description: '',
  menuItemId: '',
  specialPrice: '',
  imageUrl: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [items, setItems] = useState<MenuItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [nowTs] = useState(() => Date.now())

  const load = async () => {
    try {
      const [promos, menuData] = await Promise.all([
        promotionsApi.fetchPromotions(),
        menuApi.fetchCategories().catch(() => []),
      ])
      const flatItems: MenuItemOption[] = (menuData || []).flatMap((cat: { name?: unknown; items?: unknown }) => {
        const rawItems: Array<Record<string, unknown>> = Array.isArray(cat.items) ? (cat.items as Array<Record<string, unknown>>) : []
        return rawItems.map((i) => ({
          id: String(i.id),
          name: String(i.name),
          price: Number(i.price),
          categoryName: String(cat.name ?? ''),
        }))
      })
      setPromotions(promos || [])
      setItems(flatItems)
    } catch (e) {
      showErrorToast(errMsg(e, 'Failed to load promotions'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      promotionsApi.fetchPromotions(),
      menuApi.fetchCategories().catch(() => []),
    ])
      .then(([promos, menuData]) => {
        if (cancelled) return
        const flatItems: MenuItemOption[] = (menuData || []).flatMap((cat: { name?: unknown; items?: unknown }) => {
          const rawItems: Array<Record<string, unknown>> = Array.isArray(cat.items) ? (cat.items as Array<Record<string, unknown>>) : []
          return rawItems.map((i) => ({
            id: String(i.id),
            name: String(i.name),
            price: Number(i.price),
            categoryName: String(cat.name ?? ''),
          }))
        })
        setPromotions(promos || [])
        setItems(flatItems)
      })
      .catch((e) => {
        if (!cancelled) showErrorToast(errMsg(e, 'Failed to load promotions'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
    setShowForm(true)
  }

  const openEdit = (p: Promotion) => {
    setEditingId(p.id)
    setForm({
      type: p.type,
      title: p.title,
      description: p.description || '',
      menuItemId: p.menuItemId || '',
      specialPrice: p.specialPrice != null ? String(p.specialPrice) : '',
      imageUrl: p.imageUrl || '',
      startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : '',
      endsAt: p.endsAt ? new Date(p.endsAt).toISOString().slice(0, 16) : '',
      isActive: p.isActive,
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) {
      showErrorToast('Title is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        menuItemId: form.menuItemId || undefined,
        specialPrice: form.specialPrice ? Number(form.specialPrice) : undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        isActive: form.isActive,
      }
      if (editingId) {
        await promotionsApi.updatePromotion(editingId, payload)
        showSuccessToast('Promotion updated')
      } else {
        await promotionsApi.createPromotion(payload)
        showSuccessToast('Promotion created')
      }
      setShowForm(false)
      load()
    } catch (e) {
      showErrorToast(errMsg(e, 'Failed to save promotion'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this promotion?')) return
    try {
      await promotionsApi.deletePromotion(id)
      showSuccessToast('Promotion deleted')
      setPromotions((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      showErrorToast(errMsg(e, 'Failed to delete promotion'))
    }
  }

  const toggleActive = async (p: Promotion) => {
    try {
      const updated = await promotionsApi.updatePromotion(p.id, { isActive: !p.isActive })
      setPromotions((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated, isActive: updated.isActive ?? !p.isActive } : x)))
      showSuccessToast(updated.isActive ? 'Promotion activated' : 'Promotion deactivated')
    } catch (e) {
      showErrorToast(errMsg(e, 'Failed to update promotion'))
    }
  }

  const itemName = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i]))
    return (id: string) => map.get(id)
  }, [items])

  const isLive = (p: Promotion) =>
    p.isActive &&
    (!p.startsAt || new Date(p.startsAt).getTime() <= nowTs) &&
    (!p.endsAt || new Date(p.endsAt).getTime() >= nowTs)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Promotions</h1>
          <p className="text-sm text-text-secondary mt-1">
            Specials, offers, events and giveaways shown on your customer menu
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New Promotion</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-secondary animate-spin" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-gray-300 dark:border-white/15">
          <Megaphone className="w-12 h-12 mx-auto text-text-secondary/30 mb-3" />
          <h3 className="font-heading font-bold text-text-primary dark:text-white mb-1">No promotions yet</h3>
          <p className="text-sm text-text-secondary mb-4">
            Create a special dish, discount offer, event night or giveaway to attract customers
          </p>
          <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" /> Create your first promotion</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {promotions.map((p) => {
            const meta = TYPE_META[p.type] || TYPE_META.SPECIAL
            const Icon = meta.icon
            const linked = p.menuItemId ? itemName(p.menuItemId) : null
            const live = isLive(p)
            const linkedPrice = p.menuItem?.price ?? linked?.price
            return (
              <motion.div
                key={p.id}
                layout
                className={`rounded-2xl border overflow-hidden shadow-soft bg-white dark:bg-white/5 ${live ? 'border-gray-200 dark:border-white/10' : 'border-gray-200 dark:border-white/10 opacity-70'}`}
              >
                <div className={`h-1.5 bg-gradient-to-r ${meta.accent}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.badge}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      {live && <Badge variant="success" size="sm">Live</Badge>}
                      {!p.isActive && <Badge variant="default" size="sm">Paused</Badge>}
                      {p.isActive && !live && <Badge variant="warning" size="sm">Scheduled</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10" title={p.isActive ? 'Deactivate' : 'Activate'}>
                        {p.isActive ? <ToggleRight className="w-5 h-5 text-secondary" /> : <ToggleLeft className="w-5 h-5 text-text-secondary/50" />}
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10" title="Edit">
                        <Edit3 className="w-4 h-4 text-text-secondary" />
                      </button>
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10" title="Delete">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-text-primary dark:text-white text-lg mt-2">{p.title}</h3>
                  {p.description && <p className="text-sm text-text-secondary mt-1 line-clamp-3">{p.description}</p>}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
                    <div className="min-w-0">
                      {linked ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Link2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate font-medium text-text-primary dark:text-white">{linked.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-secondary/70">No linked item</span>
                      )}
                      {p.specialPrice != null && linked && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-text-secondary line-through">KES {Number(linkedPrice).toLocaleString()}</span>
                          <span className="text-sm font-bold text-secondary">KES {Number(p.specialPrice).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right text-[10px] text-text-secondary">
                      {p.startsAt || p.endsAt ? (
                        <div className="flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {p.startsAt ? new Date(p.startsAt).toLocaleDateString() : 'now'}
                            {p.endsAt ? ` → ${new Date(p.endsAt).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span>Ongoing</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-heading font-bold text-text-primary dark:text-white">
                  {editingId ? 'Edit Promotion' : 'New Promotion'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TYPE_META).map(([key, meta]) => {
                      const Icon = meta.icon
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm({ ...form, type: key })}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            form.type === key
                              ? 'border-secondary bg-secondary/10 text-secondary'
                              : 'border-gray-200 dark:border-white/10 text-text-secondary hover:border-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" /> {meta.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Friday Nyama Choma Night" />
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What should customers know?"
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm text-text-primary focus:border-secondary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Linked Menu Item</label>
                    <select
                      value={form.menuItemId}
                      onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2.5 text-sm text-text-primary focus:border-secondary focus:outline-none"
                    >
                      <option value="">None (no item link)</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} — KES {Number(i.price).toLocaleString()}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Special Price (KES)"
                    type="number"
                    value={form.specialPrice}
                    onChange={(e) => setForm({ ...form, specialPrice: e.target.value })}
                    placeholder="e.g., 850"
                    disabled={!form.menuItemId}
                  />
                </div>

                <Input label="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Starts (optional)" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                  <Input label="Ends (optional)" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                </div>

                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-secondary focus:ring-secondary"
                  />
                  Active now
                </label>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" fullWidth onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button variant="primary" fullWidth loading={saving} disabled={saving} onClick={save}>
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Promotion'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
