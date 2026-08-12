import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ArrowDownUp, Truck, ClipboardList, Plus, Trash2, Edit3, AlertTriangle, CheckCircle2, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as inventoryApi from '@/api/inventory'

const UNITS = ['KG', 'G', 'L', 'ML', 'PIECE', 'PACK', 'BOX', 'DOZEN', 'BAG', 'JAR']
const MOVEMENT_TYPES = ['OPENING', 'PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT']

const emptyItemForm = { name: '', nameSw: '', category: '', unit: 'PIECE', minStock: '', maxStock: '', reorderLevel: '' }
const emptyMovementForm = { itemId: '', type: 'OPENING', quantity: '', unitCost: '', notes: '' }
const emptySupplierForm = { name: '', phone: '', email: '', address: '', notes: '' }

export default function InventoryPage() {
  const [tab, setTab] = useState<'items' | 'movements' | 'suppliers' | 'purchaseOrders'>('items')
  const [loading, setLoading] = useState(true)

  const [items, setItems] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
  const [lowStockCount, setLowStockCount] = useState(0)

  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [itemForm, setItemForm] = useState({ ...emptyItemForm })
  const [savingItem, setSavingItem] = useState(false)

  const [showMovementModal, setShowMovementModal] = useState(false)
  const [movementForm, setMovementForm] = useState({ ...emptyMovementForm })
  const [savingMovement, setSavingMovement] = useState(false)

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null)
  const [supplierForm, setSupplierForm] = useState({ ...emptySupplierForm })

  const [showPoModal, setShowPoModal] = useState(false)
  const [poSupplier, setPoSupplier] = useState('')
  const [poItems, setPoItems] = useState<{ itemId: string; quantity: string; unitCost: string }[]>([])
  const [savingPo, setSavingPo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [itemRes, movementRes, supplierRes, poRes, lowRes] = await Promise.all([
        inventoryApi.fetchInventoryItems(),
        inventoryApi.fetchMovements({ perPage: 50 }),
        inventoryApi.fetchSuppliers(),
        inventoryApi.fetchPurchaseOrders(),
        inventoryApi.fetchLowStock(),
      ])
      setItems(Array.isArray(itemRes) ? itemRes : [])
      setMovements(Array.isArray(movementRes) ? movementRes : [])
      setSuppliers(Array.isArray(supplierRes) ? supplierRes : [])
      setPurchaseOrders(Array.isArray(poRes) ? poRes : [])
      setLowStockCount(Array.isArray(lowRes) ? lowRes.length : 0)
    } catch { showErrorToast('Failed to load inventory') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) { showErrorToast('Name is required'); return }
    setSavingItem(true)
    try {
      const payload = {
        name: itemForm.name.trim(),
        nameSw: itemForm.nameSw.trim() || undefined,
        category: itemForm.category.trim() || undefined,
        unit: itemForm.unit,
        minStock: itemForm.minStock ? Number(itemForm.minStock) : undefined,
        maxStock: itemForm.maxStock ? Number(itemForm.maxStock) : undefined,
        reorderLevel: itemForm.reorderLevel ? Number(itemForm.reorderLevel) : undefined,
      }
      if (editingItem) {
        await inventoryApi.updateInventoryItem(editingItem.id, payload)
        showSuccessToast('Item updated')
      } else {
        await inventoryApi.createInventoryItem(payload)
        showSuccessToast('Item created')
      }
      setShowItemModal(false)
      load()
    } catch { showErrorToast('Failed to save item') }
    finally { setSavingItem(false) }
  }

  const openItemModal = (item: any | null) => {
    setEditingItem(item)
    setItemForm(item ? {
      name: item.name, nameSw: item.nameSw || '', category: item.category || '', unit: item.unit || 'PIECE',
      minStock: item.minStock != null ? String(item.minStock) : '', maxStock: item.maxStock != null ? String(item.maxStock) : '',
      reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : '',
    } : { ...emptyItemForm })
    setShowItemModal(true)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await inventoryApi.deleteInventoryItem(id)
      showSuccessToast('Item deleted')
      load()
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to delete item')
    }
  }

  const handleSaveMovement = async () => {
    if (!movementForm.itemId || !movementForm.quantity) { showErrorToast('Item and quantity are required'); return }
    setSavingMovement(true)
    try {
      await inventoryApi.recordMovement({
        itemId: movementForm.itemId,
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined,
        notes: movementForm.notes.trim() || undefined,
        referenceType: 'MANUAL',
      })
      showSuccessToast('Movement recorded')
      setShowMovementModal(false)
      setMovementForm({ ...emptyMovementForm })
      load()
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to record movement')
    }
    finally { setSavingMovement(false) }
  }

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) { showErrorToast('Name is required'); return }
    try {
      if (editingSupplier) {
        await inventoryApi.updateSupplier(editingSupplier.id, supplierForm)
        showSuccessToast('Supplier updated')
      } else {
        await inventoryApi.createSupplier(supplierForm)
        showSuccessToast('Supplier created')
      }
      setShowSupplierModal(false)
      load()
    } catch { showErrorToast('Failed to save supplier') }
  }

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Delete this supplier?')) return
    try {
      await inventoryApi.deleteSupplier(id)
      showSuccessToast('Supplier deleted')
      load()
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to delete supplier')
    }
  }

  const handleCreatePo = async () => {
    if (poItems.length === 0 || !poItems.some((i) => i.itemId && Number(i.quantity) > 0)) {
      showErrorToast('Add at least one item with a quantity'); return
    }
    setSavingPo(true)
    try {
      await inventoryApi.createPurchaseOrder({
        supplierId: poSupplier || null,
        items: poItems.filter((i) => i.itemId).map((i) => ({
          itemId: i.itemId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost) || 0,
        })),
      })
      showSuccessToast('Purchase order created')
      setShowPoModal(false)
      setPoItems([])
      setPoSupplier('')
      load()
    } catch { showErrorToast('Failed to create purchase order') }
    finally { setSavingPo(false) }
  }

  const handleReceivePo = async (po: any) => {
    if (!confirm(`Receive purchase order ${po.orderNumber}? Stock will be added.`)) return
    try {
      await inventoryApi.receivePurchaseOrder(po.id)
      showSuccessToast('Purchase order received — stock added')
      load()
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to receive purchase order')
    }
  }

  const tabs = [
    { key: 'items' as const, label: 'Items', icon: <Package className="h-4 w-4" />, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { key: 'movements' as const, label: 'Movements', icon: <ArrowDownUp className="h-4 w-4" /> },
    { key: 'suppliers' as const, label: 'Suppliers', icon: <Truck className="h-4 w-4" /> },
    { key: 'purchaseOrders' as const, label: 'Purchase Orders', icon: <ClipboardList className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Inventory</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Stock levels, movements, suppliers and purchase orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          {tab === 'items' && <Button size="sm" onClick={() => openItemModal(null)}><Plus className="h-3.5 w-3.5" /> Add Item</Button>}
          {tab === 'movements' && <Button size="sm" onClick={() => setShowMovementModal(true)}><Plus className="h-3.5 w-3.5" /> Record Movement</Button>}
          {tab === 'suppliers' && <Button size="sm" onClick={() => { setEditingSupplier(null); setSupplierForm({ ...emptySupplierForm }); setShowSupplierModal(true) }}><Plus className="h-3.5 w-3.5" /> Add Supplier</Button>}
          {tab === 'purchaseOrders' && <Button size="sm" onClick={() => setShowPoModal(true)}><Plus className="h-3.5 w-3.5" /> New Order</Button>}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-secondary text-white' : 'bg-white dark:bg-primary-light border border-white/10 text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.icon} {t.label}
            {t.badge ? <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-red-500 text-white'}`}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" className="h-28" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {tab === 'items' && (
            <motion.div key="items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.length === 0 ? (
                <div className="md:col-span-2 lg:col-span-3"><EmptyState icon={<Package className="h-10 w-10" />} title="No inventory items" description="Add your first item to start tracking stock" /></div>
              ) : items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-text-primary dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{item.category || 'Uncategorized'} · {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openItemModal(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <p className={`font-heading text-2xl font-bold ${item.lowStock ? 'text-red-500' : 'text-text-primary dark:text-white'}`}>
                        {Number(item.stock ?? 0).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-text-secondary">stock ({item.unit.toLowerCase()})</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {item.lowStock ? (
                        <Badge variant="danger" size="sm"><AlertTriangle className="h-3 w-3" /> Low stock</Badge>
                      ) : (
                        <Badge variant="success" size="sm"><CheckCircle2 className="h-3 w-3" /> OK</Badge>
                      )}
                      <span className="text-[10px] text-text-secondary">reorder at {Number(item.reorderLevel ?? 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'movements' && (
            <motion.div key="movements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
              {movements.length === 0 ? (
                <EmptyState icon={<ArrowDownUp className="h-10 w-10" />} title="No movements yet" description="Record stock in/out to build your movement history" />
              ) : (
                <div className="space-y-1.5">
                  {movements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-black/5 dark:border-white/5 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${Number(m.quantity) >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
                          <ArrowDownUp className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium text-text-primary dark:text-white truncate">
                            {m.item?.name || 'Item'} <span className="text-[10px] text-text-secondary uppercase">· {m.type}</span>
                          </p>
                          <p className="font-accent text-xs text-text-secondary">
                            {new Date(m.createdAt).toLocaleString('en-KE', { hour12: true })}
                            {m.notes ? ` · ${m.notes}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-accent text-sm font-bold ${Number(m.quantity) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {Number(m.quantity) >= 0 ? '+' : ''}{Number(m.quantity).toLocaleString()} {m.item?.unit?.toLowerCase()}
                        </p>
                        {m.unitCost != null && <p className="text-[10px] text-text-secondary">KES {Number(m.unitCost).toLocaleString()}/unit</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'suppliers' && (
            <motion.div key="suppliers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.length === 0 ? (
                <div className="md:col-span-2 lg:col-span-3"><EmptyState icon={<Truck className="h-10 w-10" />} title="No suppliers" description="Add your suppliers to create purchase orders" /></div>
              ) : suppliers.map((s) => (
                <div key={s.id} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-text-primary dark:text-white">{s.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{s.phone || s.email || 'No contact'}</p>
                      {s.address && <p className="text-xs text-text-secondary mt-0.5">{s.address}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' }); setShowSupplierModal(true) }} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary"><Edit3 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDeleteSupplier(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="default" size="sm">{s._count?.purchaseOrders ?? 0} purchase orders</Badge>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'purchaseOrders' && (
            <motion.div key="pos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-4">
              {purchaseOrders.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="No purchase orders" description="Create your first order to a supplier" />
              ) : (
                <div className="space-y-2">
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/5">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-bold text-text-primary dark:text-white">
                          {po.orderNumber} <span className="font-normal text-text-secondary">· {po.supplier?.name || 'No supplier'}</span>
                        </p>
                        <p className="font-accent text-xs text-text-secondary">
                          {po.items.length} item(s) · {new Date(po.createdAt).toLocaleDateString('en-KE')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={po.status === 'RECEIVED' ? 'success' : po.status === 'ORDERED' ? 'warning' : 'default'} size="sm">{po.status}</Badge>
                        {(po.status === 'DRAFT' || po.status === 'ORDERED' || po.status === 'PARTIAL') && (
                          <Button size="sm" variant="outline" onClick={() => handleReceivePo(po)}>Receive</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Item modal */}
      {showItemModal && (
        <ModalShell title={editingItem ? 'Edit Item' : 'Add Item'} onClose={() => setShowItemModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Chicken Breast" />
            <Input label="Swahili name" value={itemForm.nameSw} onChange={(e) => setItemForm({ ...itemForm, nameSw: e.target.value })} />
            <Input label="Category" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="e.g. Proteins" />
            <Select label="Unit" options={UNITS.map((u) => ({ value: u, label: u }))} value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Min stock" type="number" value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: e.target.value })} />
              <Input label="Max stock" type="number" value={itemForm.maxStock} onChange={(e) => setItemForm({ ...itemForm, maxStock: e.target.value })} />
              <Input label="Reorder at" type="number" value={itemForm.reorderLevel} onChange={(e) => setItemForm({ ...itemForm, reorderLevel: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button fullWidth loading={savingItem} onClick={handleSaveItem}>{editingItem ? 'Save Changes' : 'Create Item'}</Button>
              <Button variant="ghost" onClick={() => setShowItemModal(false)}>Cancel</Button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Movement modal */}
      {showMovementModal && (
        <ModalShell title="Record Movement" onClose={() => setShowMovementModal(false)}>
          <div className="space-y-3">
            <Select label="Item *" options={[{ value: '', label: 'Select item…' }, ...items.map((i) => ({ value: i.id, label: `${i.name} (${Number(i.stock ?? 0)} in stock)` }))]} value={movementForm.itemId} onChange={(e) => setMovementForm({ ...movementForm, itemId: e.target.value })} />
            <Select label="Type *" options={MOVEMENT_TYPES.map((t) => ({ value: t, label: t }))} value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Quantity *" type="number" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} placeholder="Positive = in, negative = out" />
              <Input label="Unit cost (KES)" type="number" value={movementForm.unitCost} onChange={(e) => setMovementForm({ ...movementForm, unitCost: e.target.value })} />
            </div>
            <Input label="Notes" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button fullWidth loading={savingMovement} onClick={handleSaveMovement}>Record</Button>
              <Button variant="ghost" onClick={() => setShowMovementModal(false)}>Cancel</Button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Supplier modal */}
      {showSupplierModal && (
        <ModalShell title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setShowSupplierModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            <Input label="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            <Input label="Email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
            <Input label="Address" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
            <Input label="Notes" value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
            <div className="flex gap-2 pt-1">
              <Button fullWidth onClick={handleSaveSupplier}>{editingSupplier ? 'Save Changes' : 'Add Supplier'}</Button>
              <Button variant="ghost" onClick={() => setShowSupplierModal(false)}>Cancel</Button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Purchase order modal */}
      {showPoModal && (
        <ModalShell title="New Purchase Order" onClose={() => setShowPoModal(false)}>
          <div className="space-y-3">
            <Select label="Supplier" options={[{ value: '', label: 'No supplier' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)} />
            {poItems.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_70px_80px_32px] gap-2 items-end">
                <Select options={[{ value: '', label: 'Item…' }, ...items.map((i) => ({ value: i.id, label: i.name }))]} value={row.itemId} onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, itemId: e.target.value } : r))} />
                <Input type="number" placeholder="Qty" value={row.quantity} onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))} />
                <Input type="number" placeholder="Cost" value={row.unitCost} onChange={(e) => setPoItems(poItems.map((r, i) => i === idx ? { ...r, unitCost: e.target.value } : r))} />
                <button onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))} className="h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setPoItems([...poItems, { itemId: '', quantity: '', unitCost: '' }])}>
              <Plus className="h-3.5 w-3.5" /> Add Line
            </Button>
            <div className="flex gap-2 pt-1">
              <Button fullWidth loading={savingPo} onClick={handleCreatePo}>Create Order</Button>
              <Button variant="ghost" onClick={() => setShowPoModal(false)}>Cancel</Button>
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
