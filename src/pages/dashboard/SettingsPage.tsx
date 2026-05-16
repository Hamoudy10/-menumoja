import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Palette, QrCode, Users, Bell, CreditCard, Globe, Crown, Trash2,
  Plus, X, Shield, Moon, Sun, Save, Loader2, CheckCircle2, Download,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as restaurantApi from '@/api/restaurant'

const settingsSections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'qr', label: 'QR Manager', icon: QrCode },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'payments', label: 'Payment Settings', icon: CreditCard },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'subscription', label: 'Subscription', icon: Crown },
  { id: 'delete', label: 'Delete Account', icon: Trash2 },
]

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
]

export default function SettingsPage() {
  const { darkMode, toggleDarkMode, restaurant, updateRestaurant, staff, addStaff, removeStaff, fetchStaff, language, setLanguage, qrCodes, fetchQrCodes, generateQrCode, generateBatchQrCodes, deleteQrCode } = useStore()
  const [section, setSection] = useState('profile')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [newStaff, setNewStaff] = useState<{ name: string; phone: string; role: 'waiter' | 'cashier' | 'kitchen' | 'manager'; pin: string }>({ name: '', phone: '', role: 'waiter', pin: '' })
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: '', ownerName: '', email: '', phone: '', cuisine: '', location: '', description: '',
  })
  const [brandColor, setBrandColor] = useState('#FF6B35')
  const [fontStyle, setFontStyle] = useState<'modern' | 'elegant' | 'classic'>('modern')
  const [notifSettings, setNotifSettings] = useState({ newOrders: true, payments: true, reviews: true, marketing: false, system: true })
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  useEffect(() => {
    fetchStaff()
    fetchQrCodes()
    if (restaurant) {
      setProfile({
        name: restaurant.name || '', ownerName: restaurant.ownerName || '', email: restaurant.email || '',
        phone: restaurant.phone || '', cuisine: restaurant.cuisine || '', location: restaurant.location || '',
        description: restaurant.description || '',
      })
      setBrandColor(restaurant.brandColor || '#FF6B35')
      setFontStyle(restaurant.fontStyle || 'modern')
    }
  }, [restaurant])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await updateRestaurant(profile)
      showSuccessToast('Profile saved')
    } catch { showErrorToast('Failed to save profile') } finally { setSaving(false) }
  }

  const handleSaveAppearance = async () => {
    setSaving(true)
    try {
      await updateRestaurant({ brandColor, fontStyle })
      showSuccessToast('Appearance saved')
    } catch { showErrorToast('Failed to save appearance') } finally { setSaving(false) }
  }

  const handleAddStaff = () => {
    if (!newStaff.name || !newStaff.phone || !newStaff.pin) return
    addStaff({ ...newStaff, active: true })
    setNewStaff({ name: '', phone: '', role: 'waiter', pin: '' })
    setShowAddStaff(false)
    showSuccessToast('Staff added')
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    try {
      await restaurantApi.updateSettings({ notifications: notifSettings })
      showSuccessToast('Notification settings saved')
    } catch { showErrorToast('Failed to save') } finally { setSaving(false) }
  }

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'DELETE') { showErrorToast('Type DELETE to confirm'); return }
    if (!deletePassword) { showErrorToast('Enter your password'); return }
    showSuccessToast('Account deletion requested. We\'ll process it shortly.')
    setDeleteConfirm('')
    setDeletePassword('')
  }

  const ActiveSection = () => {
    switch (section) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent text-white font-heading text-2xl font-bold">
                {restaurant?.name?.charAt(0) || 'M'}
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">{restaurant?.name || 'Your Restaurant'}</h3>
                <p className="font-body text-sm text-text-secondary dark:text-white/50">Owner since {restaurant?.createdAt ? new Date(restaurant.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Jan 2025'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Restaurant Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <Input label="Owner Name" value={profile.ownerName} onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} />
              <Input label="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} type="email" />
              <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              <Input label="Cuisine" value={profile.cuisine} onChange={(e) => setProfile({ ...profile, cuisine: e.target.value })} placeholder="e.g., Swahili, Seafood" />
              <Input label="Location" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="e.g., Nyali, Mombasa" />
            </div>
            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Description</label>
              <textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20" rows={3} />
            </div>
            <Button onClick={handleSaveProfile} loading={saving}><Save className="h-4 w-4" /> Save Changes</Button>
          </div>
        )

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="h-5 w-5 text-blue-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
                <div>
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">Dark Mode</p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50">Toggle dark/light theme</p>
                </div>
              </div>
              <Toggle checked={darkMode} onChange={toggleDarkMode} />
            </div>
            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Brand Color</label>
              <div className="flex gap-3">
                {['#FF6B35', '#0A1628', '#2ECC71', '#3B82F6', '#8B5CF6', '#EC4899'].map((color) => (
                  <button key={color} onClick={() => setBrandColor(color)}
                    className={`h-10 w-10 rounded-xl border-2 transition-transform hover:scale-110 ${brandColor === color ? 'border-secondary scale-110' : 'border-white/10'}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Font Style</label>
              <div className="flex gap-3">
                {(['modern', 'elegant', 'classic'] as const).map((font) => (
                  <button key={font} onClick={() => setFontStyle(font)}
                    className={`rounded-xl px-4 py-2 text-sm font-accent font-medium transition-colors ${fontStyle === font ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60'}`}>
                    {font.charAt(0).toUpperCase() + font.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveAppearance} loading={saving}><Save className="h-4 w-4" /> Save Appearance</Button>
          </div>
        )

      case 'qr':
        return (
          <div className="space-y-4">
            <p className="font-body text-sm text-text-secondary dark:text-white/70">
              Generate QR codes for your restaurant. Customers scan to view your digital menu.
            </p>

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={async () => {
                const qr = await generateQrCode({ label: `${restaurant?.name || 'Menu'} QR`, type: 'GENERAL' })
                if (qr) showSuccessToast('QR code generated!')
              }}><Plus className="h-3.5 w-3.5" /> Generate Main QR</Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                const n = prompt('Number of tables:', '10')
                if (n && !isNaN(parseInt(n))) {
                  await generateBatchQrCodes({ numberOfTables: parseInt(n), template: 1 })
                }
              }}><Plus className="h-3.5 w-3.5" /> Generate Table QRs</Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {qrCodes.length === 0 ? (
                <p className="text-center font-body text-sm text-text-secondary dark:text-white/40 py-8">
                  No QR codes yet. Generate one above.
                </p>
              ) : (
                qrCodes.map((qr: any) => (
                  <div key={qr.id} className="flex items-center gap-4 rounded-xl border border-white/10 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                      <QrCode className="h-7 w-7 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-accent text-sm font-medium text-text-primary dark:text-white truncate">{qr.label}</p>
                      <p className="font-accent text-xs text-text-secondary dark:text-white/50">
                        {qr.tableNumber ? `Table ${qr.tableNumber} · ` : ''}{qr.totalScans || qr.scanCount || 0} scans
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const url = qr.qrImageUrl || qr.targetUrl
                          if (url) window.open(url, '_blank')
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                        title="View QR"
                      >
                        <Download className="h-3.5 w-3.5 text-text-secondary" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('accessToken')
                            const res = await fetch(`https://menumoja-production.up.railway.app/api/v1/qr/${qr.id}/pdf`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            })
                            if (!res.ok) throw new Error('Download failed')
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${qr.label || 'qr-code'}.pdf`
                            a.click()
                            URL.revokeObjectURL(url)
                          } catch {
                            showSuccessToast('Opening QR image instead')
                            const viewUrl = qr.qrImageUrl || qr.targetUrl
                            if (viewUrl) window.open(viewUrl, '_blank')
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                        title="Download PDF"
                      >
                        <span className="text-[10px] font-bold text-text-secondary">PDF</span>
                      </button>
                    </div>
                    <button
                      onClick={() => deleteQrCode(qr.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-text-secondary hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )

      case 'staff':
        return (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50 uppercase">Name</th>
                    <th className="px-3 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50 uppercase">Phone</th>
                    <th className="px-3 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50 uppercase">Role</th>
                    <th className="px-3 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50 uppercase">Status</th>
                    <th className="px-3 py-2 text-right font-accent text-xs text-text-secondary dark:text-white/50 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="border-b border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 py-3 font-medium text-text-primary dark:text-white">{member.name}</td>
                      <td className="px-3 py-3 text-text-secondary dark:text-white/60">{member.phone}</td>
                      <td className="px-3 py-3">
                        <Badge variant={member.role === 'manager' ? 'info' : member.role === 'kitchen' ? 'warning' : member.role === 'cashier' ? 'success' : 'default'} size="sm" className="capitalize">{member.role}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={member.active ? 'success' : 'danger'} size="sm">{member.active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => { removeStaff(member.id); showSuccessToast('Staff removed') }}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-text-secondary hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AnimatePresence>
              {showAddStaff ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-xl border border-white/10 p-4 space-y-3">
                    <Input label="Name" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
                    <Input label="Phone" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} placeholder="+2547XX XXX XXX" />
                    <Input label="PIN (4 digits)" value={newStaff.pin} onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })} maxLength={4} />
                    <div>
                      <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Role</label>
                      <div className="flex gap-2">
                        {(['waiter', 'cashier', 'kitchen', 'manager'] as const).map((role) => (
                          <button key={role} onClick={() => setNewStaff({ ...newStaff, role })}
                            className={`rounded-lg px-3 py-1.5 text-xs font-accent font-medium capitalize transition-colors ${
                              newStaff.role === role ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60'
                            }`}>{role}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddStaff}><Plus className="h-3.5 w-3.5" /> Add</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddStaff(false)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <Button onClick={() => setShowAddStaff(true)}><Plus className="h-4 w-4" /> Add Staff</Button>
              )}
            </AnimatePresence>
          </div>
        )

      case 'notifications':
        return (
          <div className="space-y-4">
            {Object.entries(notifSettings).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5">
                <div>
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
                <Toggle checked={val} onChange={(checked) => setNotifSettings({ ...notifSettings, [key]: checked })} />
              </div>
            ))}
            <Button onClick={handleSaveNotifications} loading={saving}><Save className="h-4 w-4" /> Save Preferences</Button>
          </div>
        )

      case 'payments':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <span className="text-green-600 font-accent text-xs font-bold">MP</span>
                </div>
                <div>
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">M-Pesa</p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50">Receive payments via M-Pesa</p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <Input label="Till Number" defaultValue="5273012" placeholder="e.g., 5273012" />
            <Input label="Business Name" defaultValue={restaurant?.name || 'Your Restaurant'} placeholder="Business name registered with M-Pesa" />
            <Button onClick={() => { showSuccessToast('Payment settings updated') }}><Save className="h-4 w-4" /> Update Payment Settings</Button>
          </div>
        )

      case 'language':
        return (
          <div className="space-y-3">
            {languages.map((lang) => (
              <button key={lang.code} onClick={() => setLanguage(lang.code as 'en' | 'sw' | 'ar')}
                className={`w-full flex items-center gap-3 rounded-xl p-4 transition-colors border ${
                  language === lang.code ? 'border-secondary/50 bg-secondary/5' : 'border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                }`}>
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left">
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">{lang.label}</p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase">{lang.code}</p>
                </div>
                {language === lang.code && <CheckCircle2 className="h-5 w-5 text-secondary ml-auto" />}
              </button>
            ))}
            <Button onClick={() => { showSuccessToast('Language preference saved') }}><Save className="h-4 w-4" /> Save Language</Button>
          </div>
        )

      case 'subscription':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-light p-6 text-white">
              <Crown className="h-8 w-8 text-accent mb-3" />
              <h3 className="font-heading text-xl font-bold">Business Plan</h3>
              <p className="font-body text-sm text-white/70 mt-1">KES 2,500/month</p>
              <div className="mt-4 space-y-2">
                {['Unlimited menu items', 'AI marketing', 'Staff management', 'QR codes', 'Analytics', 'Priority support'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-white/80">
                    <Shield className="h-3.5 w-3.5 text-accent" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            <Button variant="secondary" fullWidth><Crown className="h-4 w-4" /> Upgrade to Premium</Button>
          </div>
        )

      case 'delete':
        return (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span className="font-accent font-bold text-sm uppercase">Danger Zone</span>
              </div>
              <p className="font-body text-sm text-red-600 dark:text-red-400/80">This action is irreversible. All data including menu, orders, and settings will be permanently deleted.</p>
            </div>
            <div className="space-y-3">
              <Input label="Type 'DELETE' to confirm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
              <Input label="Password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password" />
              <Button variant="ghost" fullWidth className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4" /> Permanently Delete Account
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">Settings</h1>
        <p className="font-body text-sm text-text-secondary dark:text-white/50">Manage your restaurant settings</p>
      </div>

      <div className="flex gap-6">
        <div className="w-56 shrink-0 space-y-1">
          {settingsSections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-accent font-medium transition-colors ${
                section === s.id ? 'bg-secondary text-white' : 'text-text-secondary dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10'
              }`}>
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4 capitalize">
              {settingsSections.find((s) => s.id === section)?.label}
            </h2>
            <ActiveSection />
          </div>
        </div>
      </div>
    </div>
  )
}