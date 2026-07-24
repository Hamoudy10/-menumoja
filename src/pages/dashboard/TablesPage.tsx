import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, Save, Square, Circle, Table2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as tablesApi from '@/api/tables'

const shapes = [
  { value: 'ROUND', icon: Circle },
  { value: 'SQUARE', icon: Square },
  { value: 'RECTANGLE', icon: Table2 },
]

export default function TablesPage() {
  const { tables, fetchTables } = useStore()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTable, setEditTable] = useState<any>(null)
  const [form, setForm] = useState({ tableNumber: '', label: '', capacity: '4', area: '', shape: 'ROUND' })

  useEffect(() => { fetchTables().finally(() => setLoading(false)) }, [])

  const handleSave = async () => {
    if (!form.tableNumber || !form.label) return
    try {
      if (editTable) {
        await tablesApi.updateTable(editTable.id, {
          tableNumber: parseInt(form.tableNumber),
          label: form.label,
          capacity: parseInt(form.capacity) || 4,
          area: form.area || undefined,
        })
      } else {
        await tablesApi.createTable({
          tableNumber: parseInt(form.tableNumber),
          label: form.label,
          capacity: parseInt(form.capacity) || 4,
          area: form.area || undefined,
        })
      }
      showSuccessToast(editTable ? 'Table updated' : 'Table created')
      setShowForm(false)
      setEditTable(null)
      setForm({ tableNumber: '', label: '', capacity: '4', area: '', shape: 'ROUND' })
      fetchTables()
    } catch { showErrorToast('Failed to save table') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this table?')) return
    try {
      await tablesApi.deleteTable(id)
      showSuccessToast('Table deleted')
      fetchTables()
    } catch { showErrorToast('Failed to delete table') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Tables</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Manage your restaurant tables and seating areas</p>
        </div>
        <Button onClick={() => { setEditTable(null); setForm({ tableNumber: '', label: '', capacity: '4', shape: 'ROUND' }); setShowForm(true) }}>
          <Plus className="h-4 w-4" /> Add Table
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : null}

      {tables.length === 0 && !loading ? (
        <div className="text-center py-16">
          <Table2 className="w-12 h-12 text-text-secondary/30 mx-auto mb-4" />
          <h2 className="text-lg font-heading font-bold text-text-primary mb-2">No tables yet</h2>
          <p className="text-sm text-text-secondary mb-6">Add your first table to start managing seating</p>
          <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Table</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables.map((table: any) => {
              const statusColors: Record<string, string> = {
                FREE: 'border-success/30 bg-success/5',
                OCCUPIED: 'border-secondary/30 bg-secondary/5',
                RESERVED: 'border-blue-400/30 bg-blue-50',
                UNAVAILABLE: 'border-gray-300/30 bg-gray-100',
              }
              const statusLabels: Record<string, string> = {
                FREE: 'Free', OCCUPIED: 'Occupied', RESERVED: 'Reserved', UNAVAILABLE: 'Unavailable',
              }
              const ShapeIcon = shapes.find(s => s.value === (table.shape || 'ROUND'))?.icon || Circle

              return (
                <motion.div
                  key={table.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-2xl border-2 p-4 text-center transition-all hover:shadow-soft cursor-pointer ${statusColors[table.status] || 'border-gray-200'}`}
                  onClick={() => {
                    setEditTable(table)
                    setForm({
                      tableNumber: String(table.tableNumber),
                      label: table.label,
                      capacity: String(table.capacity || 4),
                      shape: table.shape || 'ROUND',
                    })
                    setShowForm(true)
                  }}
                >
                  <ShapeIcon className={`h-8 w-8 mx-auto mb-2 ${table.status === 'OCCUPIED' ? 'text-secondary' : 'text-text-secondary/40'}`} />
                  <p className="font-heading text-xl font-bold text-text-primary dark:text-white">T{table.tableNumber}</p>
                  <p className="text-xs text-text-secondary font-medium truncate">{table.label}</p>
                  <p className="text-[10px] mt-1 px-2 py-0.5 rounded-full inline-block bg-white/80 font-medium"
                    style={{ color: table.status === 'FREE' ? '#2ECC71' : table.status === 'OCCUPIED' ? '#FF6B35' : '#6B7280' }}>
                    {statusLabels[table.status] || table.status}
                  </p>

                </motion.div>
              )
            })}
        </div>
      )}

      {showForm && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-primary-light border-l border-white/10 shadow-soft overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-white dark:bg-primary-light p-4">
              <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">{editTable ? 'Edit Table' : 'Add Table'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><X className="h-5 w-5 text-text-secondary" /></button>
            </div>
            <div className="p-4 space-y-4">
              <Input label="Table Number" type="number" value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} />
              <Input label="Label / Name" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Window Table 1" />
              <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />

              <div>
                <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Table Shape</label>
                <div className="flex gap-2">
                  {shapes.map((s) => (
                    <button key={s.value} onClick={() => setForm({ ...form, shape: s.value })}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium transition-all ${form.shape === s.value ? 'bg-secondary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}>
                      <s.icon className="h-5 w-5" /> {s.value.charAt(0) + s.value.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <Button fullWidth onClick={handleSave}><Save className="h-4 w-4" /> {editTable ? 'Update' : 'Create'}</Button>
                {editTable && (
                  <Button variant="ghost" fullWidth className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={() => handleDelete(editTable.id)}>
                    <X className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
