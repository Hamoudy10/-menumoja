import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Palette, QrCode, Users, Bell, CreditCard, Globe, Crown, Trash2, Edit3,
  Plus, X, Shield, Moon, Sun, Save, Loader2, CheckCircle2, Download,
  Image, Palette as PaletteIcon, Type, Smartphone, Banknote,
  Phone, ArrowLeftRight, Dices, Sparkles,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { RefreshButton } from '@/components/ui/RefreshButton'
import { useTheme, googleFonts } from '@/components/theme/ThemeProvider'
import { compressImage } from '@/utils/image'
import * as restaurantApi from '@/api/restaurant'
import * as qrcodesApi from '@/api/qrcodes'

const settingsSections = [
  { id: 'profile', labelKey: 'settings.profile', icon: User },
  { id: 'appearance', labelKey: 'settings.appearance', icon: Palette },
  { id: 'qr', labelKey: 'settings.qrManager', icon: QrCode },
  { id: 'staff', labelKey: 'settings.staff', icon: Users },
  { id: 'notifications', labelKey: 'settings.notifications', icon: Bell },
  { id: 'payments', labelKey: 'settings.paymentSettings', icon: CreditCard },
  { id: 'language', labelKey: 'settings.language', icon: Globe },
  { id: 'aiUsage', labelKey: 'AI Usage', icon: Sparkles },
  { id: 'subscription', labelKey: 'settings.subscription', icon: Crown },
  { id: 'delete', labelKey: 'settings.deleteAccount', icon: Trash2 },
]

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪', nativeName: 'Kiswahili' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
]

const mpesaProducts = [
  { id: 'stk_push', label: 'STK Push', icon: Smartphone, desc: 'Customer initiates payment on their phone' },
  { id: 'till_number', label: 'Till Number', icon: Banknote, desc: 'Paybill/Till number payments' },
  { id: 'paybill', label: 'PayBill', icon: Banknote, desc: 'Business PayBill number' },
  { id: 'c2b', label: 'C2B', icon: ArrowLeftRight, desc: 'Customer to Business payments' },
  { id: 'b2c', label: 'B2C', icon: Phone, desc: 'Business to Customer payments (withdrawals)' },
  { id: 'buy_goods', label: 'Buy Goods', icon: Dices, desc: 'Buy Goods till number payments' },
]

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const {
    darkMode, toggleDarkMode, restaurant, updateRestaurant,
    staff, addStaff, removeStaff, updateStaff, fetchStaff,
    language, setLanguage,
    qrCodes, fetchQrCodes, generateQrCode, generateBatchQrCodes, deleteQrCode,
    fetchNotifications,
    tables, fetchTables,
  } = useStore()
  const { theme, updateTheme } = useTheme()

  const [section, setSection] = useState('profile')
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [newStaff, setNewStaff] = useState({
    name: '', phone: '', role: 'waiter' as 'waiter' | 'cashier' | 'kitchen' | 'manager', pin: '', email: '',
    employeeNumber: '', nationalId: '', kraPin: '', nhifNumber: '', nssfNumber: '',
    dateOfBirth: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    nextOfKin: '', nextOfKinPhone: '', nextOfKinRelation: '', bankName: '', bankBranch: '',
    bankAccount: '', monthlySalary: '', hourlyRate: '', leaveDays: '', startDate: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: '', ownerName: '', email: '', phone: '', cuisine: '', location: '', description: '',
    kraPin: '', businessRegNo: '', vatRegNo: '', businessType: '', county: 'Mombasa',
    logoUrl: '', coverPhotoUrl: '',
  })
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'cover' | null>(null)
  const [brandColor, setBrandColor] = useState('#FF6B35')
  const [colorPickerInput, setColorPickerInput] = useState('#FF6B35')
  const [gradientStart, setGradientStart] = useState('#FF6B35')
  const [gradientEnd, setGradientEnd] = useState('#FFD700')
  const [useGradient, setUseGradient] = useState(false)
  const [fontStyle, setFontStyle] = useState<'modern' | 'elegant' | 'classic'>('modern')
  const [selectedHeadingFont, setSelectedHeadingFont] = useState('Playfair Display')
  const [selectedBodyFont, setSelectedBodyFont] = useState('Inter')
  const [selectedAccentFont, setSelectedAccentFont] = useState('Space Grotesk')
  const [notifSettings, setNotifSettings] = useState({ newOrders: true, payments: true, reviews: true, system: true })
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [isGoogleUser, setIsGoogleUser] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)
  const [staffSaving, setStaffSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [subscription, setSubscription] = useState<any>(null)

  useEffect(() => {
    restaurantApi.fetchSubscription()
      .then(setSubscription)
      .catch(() => { /* non-fatal */ })
  }, [])

  const [paymentSettings, setPaymentSettings] = useState({
    mpesaEnabled: true,
    cashEnabled: true,
    selectedProducts: ['stk_push', 'till_number'],
    mpesaShortcode: '',
    mpesaPasskey: '',
    businessName: '',
    stkPushEnabled: true,
  })

  const [qrDesign, setQrDesign] = useState({
    qrColor: '#FF6B35',
    qrBgColor: '#FFFFFF',
    shape: 'rounded' as 'rounded' | 'square' | 'dots',
    template: 1,
  })

  const [showTableQRInput, setShowTableQRInput] = useState(false)
  const [tableQRNumber, setTableQRNumber] = useState('')
  const [tableQRLabel, setTableQRLabel] = useState('')
  const [showBatchInput, setShowBatchInput] = useState(false)
  const [batchCount, setBatchCount] = useState('10')

  const loadAll = useCallback(async () => {
    try {
      await Promise.all([fetchStaff(), fetchQrCodes(), fetchTables()])
    } finally {
      setRefreshing(false)
      setLoaded(true)
    }
  }, [fetchStaff, fetchQrCodes, fetchTables])

  useEffect(() => {
    loadAll()
    const googleEmail = localStorage.getItem('google_email')
    if (googleEmail) setIsGoogleUser(true)

    if (restaurant) {
      setProfile({
        name: restaurant.name || '',
        ownerName: restaurant.ownerName || '',
        email: restaurant.email || (googleEmail || ''),
        phone: restaurant.phone || '',
        cuisine: restaurant.cuisine || '',
        location: restaurant.location || '',
        description: restaurant.description || '',
        kraPin: restaurant.kraPin || '',
        businessRegNo: restaurant.businessRegNo || '',
        vatRegNo: restaurant.vatRegNo || '',
        businessType: restaurant.businessType || 'Restaurant',
        county: restaurant.county || restaurant.city || 'Mombasa',
        logoUrl: restaurant.logoUrl || '',
        coverPhotoUrl: restaurant.coverPhotoUrl || '',
      })
      setFontStyle(restaurant.fontStyle || 'modern')
      const s = restaurant.settings as any
      if (s?.mpesaShortcode || s?.mpesaPasskey || s?.mpesaBusinessName) {
        setPaymentSettings((prev) => ({
          ...prev,
          mpesaShortcode: s.mpesaShortcode || prev.mpesaShortcode,
          mpesaPasskey: s.mpesaPasskey || prev.mpesaPasskey,
          businessName: s.mpesaBusinessName || prev.businessName,
          mpesaEnabled: s.allowMpesaPayment ?? prev.mpesaEnabled,
          cashEnabled: s.allowCashPayment ?? prev.cashEnabled,
        }))
      }
    }
  }, [restaurant, loadAll])

  const nameToFamily = (name: string) => googleFonts.find((f) => f.name === name)?.family || name

  useEffect(() => {
    if (section !== 'appearance') return
    setBrandColor(theme.brandColor)
    setColorPickerInput(theme.brandColor)
    setGradientStart(theme.gradientStart)
    setGradientEnd(theme.gradientEnd)
    setUseGradient(theme.useGradient)
    setSelectedHeadingFont(nameToFamily(theme.fontHeading))
    setSelectedBodyFont(nameToFamily(theme.fontBody))
    setSelectedAccentFont(nameToFamily(theme.fontAccent))
  }, [section, theme])

  const handleSaveProfile = async () => {
    if (uploadingImage) { showErrorToast('Wait for the image upload to finish'); return }
    setSaving(true)
    try {
      await updateRestaurant(profile)
      showSuccessToast(t('settings.profileSaved'))
    } catch { showErrorToast('Failed to save profile') } finally { setSaving(false) }
  }

  const handleImageUpload = (kind: 'logo' | 'cover') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 3 * 1024 * 1024) { showErrorToast('Image too large (max 3MB)'); return }
      setUploadingImage(kind)
      try {
        const dataUrl = await compressImage(file)
        const res = await restaurantApi.uploadImage(dataUrl, kind === 'logo' ? 'logos' : 'covers')
        const url = res?.url || dataUrl
        setProfile((p) => ({ ...p, [kind === 'logo' ? 'logoUrl' : 'coverPhotoUrl']: url }))
        showSuccessToast(kind === 'logo' ? 'Logo uploaded — save to apply' : 'Cover uploaded — save to apply')
      } catch {
        showErrorToast('Upload failed')
      } finally {
        setUploadingImage(null)
      }
    }
    input.click()
  }

  const handleSaveAppearance = async () => {
    setSaving(true)
    try {
      const fontMap: Record<string, string> = {
        modern: 'Inter',
        elegant: 'Playfair Display',
        classic: 'Merriweather',
      }

      updateTheme({
        brandColor,
        gradientStart,
        gradientEnd,
        useGradient,
        fontHeading: selectedHeadingFont,
        fontBody: selectedBodyFont,
        fontAccent: selectedAccentFont,
      })

      await restaurantApi.updateSettings({
        primaryColor: brandColor,
        gradientStart,
        gradientEnd,
        useGradient,
        headingFont: selectedHeadingFont,
        bodyFont: selectedBodyFont,
        accentFont: selectedAccentFont,
      })

      await updateRestaurant({
        brandColor,
        fontStyle,
      })
      showSuccessToast(t('settings.saveAppearance'))
    } catch { showErrorToast('Failed to save appearance') } finally { setSaving(false) }
  }

  const handleSaveLanguage = async () => {
    setSaving(true)
    try {
      localStorage.setItem('app-language', language)
      i18n.changeLanguage(language)
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
      await restaurantApi.updateSettings({ language })
      showSuccessToast(t('language.languageSaved'))
    } catch { showErrorToast('Failed to save language') } finally { setSaving(false) }
  }

  const handleSavePayments = async () => {
    setSaving(true)
    try {
      await restaurantApi.updateSettings({ paymentSettings })
      showSuccessToast('Payment settings updated')
    } catch { showErrorToast('Failed to save payment settings') } finally { setSaving(false) }
  }

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.phone || !newStaff.pin) return
    setStaffSaving(true)
    try {
      const payload: any = {}
      for (const [k, v] of Object.entries(newStaff)) {
        if (v !== '' && v !== null && v !== undefined) payload[k] = v
      }
      payload.active = true
      if (payload.monthlySalary) payload.monthlySalary = parseFloat(payload.monthlySalary)
      if (payload.hourlyRate) payload.hourlyRate = parseFloat(payload.hourlyRate)
      if (payload.leaveDays) payload.leaveDays = parseInt(payload.leaveDays)
      if (editingStaffId) {
        await updateStaff(editingStaffId, payload)
        showSuccessToast('Staff updated')
      } else {
        await addStaff(payload)
        showSuccessToast('Staff added')
      }
      setNewStaff({ name: '', phone: '', role: 'waiter', pin: '', email: '', employeeNumber: '', nationalId: '', kraPin: '', nhifNumber: '', nssfNumber: '', dateOfBirth: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', nextOfKin: '', nextOfKinPhone: '', nextOfKinRelation: '', bankName: '', bankBranch: '', bankAccount: '', monthlySalary: '', hourlyRate: '', leaveDays: '', startDate: '', notes: '' })
      setShowAddStaff(false)
      setEditingStaffId(null)
    } catch { /* error toast handled in store */ } finally { setStaffSaving(false) }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    try {
      await restaurantApi.updateSettings({ notifications: notifSettings })
      showSuccessToast('Notification settings saved')
    } catch { showErrorToast('Failed to save') } finally { setSaving(false) }
  }

  const handleDeleteAccount = () => {
    if (deleteConfirm !== 'DELETE') { showErrorToast(t('common.typeToConfirm')); return }
    if (!deletePassword) { showErrorToast('Enter your password'); return }
    showSuccessToast('Account deletion requested')
    setDeleteConfirm('')
    setDeletePassword('')
  }

  const handleGenerateMainQR = async () => {
    setQrBusy(true)
    try {
      const qr = await generateQrCode({
        label: `${restaurant?.name || 'Menu'} QR`,
        type: 'GENERAL',
        color: qrDesign.qrColor,
        bgColor: qrDesign.qrBgColor,
        shape: qrDesign.shape,
        template: qrDesign.template,
      })
      if (qr) showSuccessToast('QR code generated!')
    } finally { setQrBusy(false) }
  }

  const handleGenerateTableQR = async () => {
    if (!tableQRNumber || isNaN(parseInt(tableQRNumber))) {
      showErrorToast('Enter a valid table number')
      return
    }
    setQrBusy(true)
    try {
      const qr = await generateQrCode({
        label: tableQRLabel || `Table ${tableQRNumber}`,
        tableNumber: parseInt(tableQRNumber),
        type: 'TABLE',
        color: qrDesign.qrColor,
        bgColor: qrDesign.qrBgColor,
        shape: qrDesign.shape,
        template: qrDesign.template,
      })
      if (qr) {
        showSuccessToast(`QR for Table ${tableQRNumber} generated!`)
        setShowTableQRInput(false)
        setTableQRNumber('')
        setTableQRLabel('')
      }
    } finally { setQrBusy(false) }
  }

  const handleGenerateBatchQRs = async () => {
    const n = parseInt(batchCount)
    if (isNaN(n) || n < 1) { showErrorToast('Enter a valid number'); return }
    setQrBusy(true)
    try {
      await generateBatchQrCodes({
        numberOfTables: n,
        template: qrDesign.template,
        color: qrDesign.qrColor,
        bgColor: qrDesign.qrBgColor,
        shape: qrDesign.shape,
      })
      setShowBatchInput(false)
      setBatchCount('10')
    } finally { setQrBusy(false) }
  }

  const renderActiveSection = () => {
    switch (section) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center text-white font-heading text-2xl font-bold">
                {profile.logoUrl ? (
                  <img src={profile.logoUrl} alt="logo" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  restaurant?.name?.charAt(0) || 'M'
                )}
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white">{restaurant?.name || 'Your Restaurant'}</h3>
                <p className="font-body text-sm text-text-secondary dark:text-white/50">{t('settings.ownerSince')} {restaurant?.createdAt ? new Date(restaurant.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Jan 2025'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Restaurant Logo</label>
                <div
                  onClick={() => handleImageUpload('logo')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file && file.type.startsWith('image/')) {
                      setUploadingImage('logo')
                      try {
                        const dataUrl = await compressImage(file)
                        const res = await restaurantApi.uploadImage(dataUrl, 'logos')
                        setProfile((p) => ({ ...p, logoUrl: res?.url || dataUrl }))
                        showSuccessToast('Logo uploaded — save to apply')
                      } catch { showErrorToast('Upload failed') } finally { setUploadingImage(null) }
                    }
                  }}
                  className="relative cursor-pointer rounded-xl border-2 border-dashed border-white/20 p-4 text-center hover:border-secondary/50 transition-colors"
                >
                  {profile.logoUrl ? (
                    <div className="flex items-center justify-center gap-3">
                      <img src={profile.logoUrl} alt="logo" className="h-14 w-14 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="text-xs text-text-secondary dark:text-white/50">{uploadingImage === 'logo' ? 'Uploading…' : 'Click or drop to change'}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-2">
                      <Image className="h-6 w-6 text-text-secondary/40" />
                      <span className="text-xs text-text-secondary dark:text-white/60">{uploadingImage === 'logo' ? 'Uploading…' : 'Upload logo'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Cover Photo</label>
                <div
                  onClick={() => handleImageUpload('cover')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file && file.type.startsWith('image/')) {
                      setUploadingImage('cover')
                      try {
                        const dataUrl = await compressImage(file)
                        const res = await restaurantApi.uploadImage(dataUrl, 'covers')
                        setProfile((p) => ({ ...p, coverPhotoUrl: res?.url || dataUrl }))
                        showSuccessToast('Cover uploaded — save to apply')
                      } catch { showErrorToast('Upload failed') } finally { setUploadingImage(null) }
                    }
                  }}
                  className="relative cursor-pointer rounded-xl border-2 border-dashed border-white/20 p-4 text-center hover:border-secondary/50 transition-colors"
                >
                  {profile.coverPhotoUrl ? (
                    <div>
                      <img src={profile.coverPhotoUrl} alt="cover" className="mx-auto h-16 w-full max-w-[200px] rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="block mt-1.5 text-xs text-text-secondary dark:text-white/50">{uploadingImage === 'cover' ? 'Uploading…' : 'Click or drop to change'}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-2">
                      <Image className="h-6 w-6 text-text-secondary/40" />
                      <span className="text-xs text-text-secondary dark:text-white/60">{uploadingImage === 'cover' ? 'Uploading…' : 'Upload cover photo'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('settings.restaurantName')} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <Input label={t('settings.ownerName')} value={profile.ownerName} onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} />
              <Input
                label={t('settings.email')}
                value={profile.email}
                onChange={(e) => {
                  if (!isGoogleUser) setProfile({ ...profile, email: e.target.value })
                }}
                type="email"
                disabled={isGoogleUser}
                className={isGoogleUser ? 'opacity-60 cursor-not-allowed' : ''}
              />
              {isGoogleUser && (
                <p className="text-xs text-text-secondary dark:text-white/50 -mt-2">
                  Email is set from your Google account and cannot be changed
                </p>
              )}
              <Input label={t('settings.phone')} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              <Input label={t('settings.cuisine')} value={profile.cuisine} onChange={(e) => setProfile({ ...profile, cuisine: e.target.value })} placeholder="e.g., Swahili, Seafood" />
              <Input label={t('settings.location')} value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="e.g., Nyali, Mombasa" />
            </div>
            <div className="border-t border-white/10 pt-3 mt-2">
              <h4 className="font-accent text-sm font-semibold text-text-primary dark:text-white/90 mb-3">Legal & Compliance (ETR)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="KRA PIN" value={profile.kraPin} onChange={(e) => setProfile({ ...profile, kraPin: e.target.value })} placeholder="e.g., P051234567X" />
                <Input label="Business Reg No." value={profile.businessRegNo} onChange={(e) => setProfile({ ...profile, businessRegNo: e.target.value })} placeholder="e.g., CPR/2024/12345" />
                <Input label="VAT Reg No." value={profile.vatRegNo} onChange={(e) => setProfile({ ...profile, vatRegNo: e.target.value })} placeholder="e.g., VAT-123456" />
                <Input label="Business Type" value={profile.businessType} onChange={(e) => setProfile({ ...profile, businessType: e.target.value })} placeholder="Restaurant, Cafe, Bar" />
                <Input label="County" value={profile.county} onChange={(e) => setProfile({ ...profile, county: e.target.value })} placeholder="e.g., Mombasa" />
              </div>
            </div>
            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('settings.description')}</label>
              <textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20" rows={3} />
            </div>
            <Button onClick={handleSaveProfile} loading={saving}><Save className="h-4 w-4" /> {t('app.save')}</Button>
          </div>
        )

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="h-5 w-5 text-blue-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
                <div>
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">{t('settings.darkMode')}</p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50">{t('settings.darkModeDesc')}</p>
                </div>
              </div>
              <Toggle checked={darkMode} onChange={() => { toggleDarkMode(); updateTheme({ darkMode: !darkMode }) }} />
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('settings.brandColor')}</label>
              <div className="flex gap-3 flex-wrap">
                {['#FF6B35', '#0A1628', '#2ECC71', '#3B82F6', '#8B5CF6', '#EC4899', '#E74C3C', '#F39C12', '#1ABC9C'].map((color) => (
                  <button key={color} onClick={() => { setBrandColor(color); setColorPickerInput(color) }}
                    className={`h-10 w-10 rounded-xl border-2 transition-transform hover:scale-110 ${brandColor === color ? 'border-secondary scale-110 ring-2 ring-secondary/30' : 'border-white/10'}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <label className="font-accent text-xs text-text-secondary">{t('settings.colorPicker')}:</label>
                <input
                  type="color"
                  value={colorPickerInput}
                  onChange={(e) => { setBrandColor(e.target.value); setColorPickerInput(e.target.value) }}
                  className="h-10 w-16 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={colorPickerInput}
                  onChange={(e) => { setBrandColor(e.target.value); setColorPickerInput(e.target.value) }}
                  className="rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-xs font-accent text-text-primary dark:text-white w-24"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Toggle checked={useGradient} onChange={setUseGradient} />
                <label className="font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('settings.gradientPicker')}</label>
              </div>
              {useGradient && (
                <div className="flex gap-3 items-center">
                  <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)}
                    className="h-10 w-16 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                  <span className="text-text-secondary">→</span>
                  <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)}
                    className="h-10 w-16 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                  <div className="h-10 w-20 rounded-xl" style={{ background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})` }} />
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('theme.headingFont')}</label>
              <select
                value={selectedHeadingFont}
                onChange={(e) => setSelectedHeadingFont(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white"
              >
                {googleFonts.map((f) => (
                  <option key={f.name} value={f.family}>{f.name} ({f.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('theme.bodyFont')}</label>
              <select
                value={selectedBodyFont}
                onChange={(e) => setSelectedBodyFont(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white"
              >
                {googleFonts.map((f) => (
                  <option key={f.name} value={f.family}>{f.name} ({f.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('theme.accentFont')}</label>
              <select
                value={selectedAccentFont}
                onChange={(e) => setSelectedAccentFont(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white"
              >
                {googleFonts.map((f) => (
                  <option key={f.name} value={f.family}>{f.name} ({f.category})</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
              <label className="block font-accent text-sm font-medium text-text-primary dark:text-white/90 mb-2">{t('theme.preview')}</label>
              <p className="font-heading text-xl text-text-primary dark:text-white mb-1">Heading - The quick brown fox</p>
              <p className="font-body text-sm text-text-secondary dark:text-white/70 mb-1">Body text - MenuMoja brings you the finest dining experience with fresh ingredients.</p>
              <p className="font-accent text-xs text-text-secondary/50">Accent text - KES 1,500 · 15 min prep</p>
            </div>

            <Button onClick={handleSaveAppearance} loading={saving}><Save className="h-4 w-4" /> {t('settings.saveAppearance')}</Button>
          </div>
        )

      case 'qr':
        return (
          <div className="space-y-4">
            <p className="font-body text-sm text-text-secondary dark:text-white/70">{t('qr.desc')}</p>

            <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4 space-y-3">
              <h4 className="font-accent text-sm font-bold text-text-primary dark:text-white">{t('qr.design')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-accent text-xs text-text-secondary mb-1">{t('qr.qrColor')}</label>
                  <input type="color" value={qrDesign.qrColor} onChange={(e) => setQrDesign({ ...qrDesign, qrColor: e.target.value })}
                    className="h-8 w-full rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                </div>
                <div>
                  <label className="block font-accent text-xs text-text-secondary mb-1">{t('qr.bgColor')}</label>
                  <input type="color" value={qrDesign.qrBgColor} onChange={(e) => setQrDesign({ ...qrDesign, qrBgColor: e.target.value })}
                    className="h-8 w-full rounded-lg border border-white/10 bg-transparent cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block font-accent text-xs text-text-secondary mb-1">{t('qr.shape')}</label>
                <div className="flex gap-2">
                  {(['rounded', 'square', 'dots'] as const).map((shape) => (
                    <button key={shape} onClick={() => setQrDesign({ ...qrDesign, shape })}
                      className={`rounded-lg px-3 py-1 text-xs font-accent font-medium transition-colors ${qrDesign.shape === shape ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary'}`}>
                      {shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleGenerateMainQR} loading={qrBusy}><Plus className="h-3.5 w-3.5" /> {t('qr.generateMainQR')}</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowTableQRInput(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('qr.generateTableQR')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowBatchInput(true)}>
                <Plus className="h-3.5 w-3.5" /> {t('qr.generateTableQRs')}
              </Button>
            </div>

            <AnimatePresence>
              {showTableQRInput && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-xl border border-white/10 p-4 space-y-3">
                    <h4 className="font-accent text-sm font-bold text-text-primary dark:text-white">{t('qr.generateForTable')}</h4>
                    {tables.length > 0 ? (
                      <div>
                        <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Select Table</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                          {tables.map((tbl: any) => (
                            <button
                              key={tbl.id}
                              onClick={() => { setTableQRNumber(String(tbl.tableNumber)); setTableQRLabel(tbl.label) }}
                              className={`rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                                tableQRNumber === String(tbl.tableNumber) ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary hover:bg-black/10'
                              }`}
                            >
                              <span className="block font-bold">T{tbl.tableNumber}</span>
                              <span className="text-[10px] opacity-70 truncate">{tbl.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-secondary/60 italic">No tables found. Create tables in the Tables page first.</p>
                    )}
                    <Input label={t('qr.tableNumber')} type="number" value={tableQRNumber} onChange={(e) => setTableQRNumber(e.target.value)} placeholder="Or enter number manually" />
                    <Input label={t('qr.tableLabel')} value={tableQRLabel} onChange={(e) => setTableQRLabel(e.target.value)} placeholder="e.g., Window Table" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleGenerateTableQR} loading={qrBusy}><Plus className="h-3.5 w-3.5" /> Generate</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowTableQRInput(false)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div>
              )}
              {showBatchInput && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-xl border border-white/10 p-4 space-y-3">
                    <h4 className="font-accent text-sm font-bold text-text-primary dark:text-white">{t('qr.generateTableQRs')}</h4>
                    <Input label={t('qr.numberOfTables')} type="number" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} placeholder="10" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleGenerateBatchQRs} loading={qrBusy}><Plus className="h-3.5 w-3.5" /> Generate Batch</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowBatchInput(false)}>Cancel</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {!loaded ? (
                <div className="space-y-2">
                  <Skeleton variant="card" className="h-16" />
                  <Skeleton variant="card" className="h-16" />
                  <Skeleton variant="card" className="h-16" />
                </div>
              ) : qrCodes.length === 0 ? (
                <p className="text-center font-body text-sm text-text-secondary dark:text-white/40 py-8">{t('qr.noQRs')}</p>
              ) : (
                qrCodes.map((qr: any) => (
                  <div key={qr.id} className="flex items-center gap-4 rounded-xl border border-white/10 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                      <QrCode className="h-7 w-7 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-accent text-sm font-medium text-text-primary dark:text-white truncate">{qr.label || qr.name}</p>
                      <p className="font-accent text-xs text-text-secondary dark:text-white/50">
                        {qr.tableNumber ? `${t('qr.table')} ${qr.tableNumber} · ` : ''}{qr.totalScans || qr.scanCount || 0} {t('qr.scans')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          const url = qr.qrImageUrl || qr.targetUrl || qr.imageUrl
                          if (url) window.open(url, '_blank', 'noopener,noreferrer')
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                        title={t('qr.viewQR')}
                      >
                        <Download className="h-3.5 w-3.5 text-text-secondary" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { downloadQrPdf } = await import('@/api/qrcodes')
                            const res = await downloadQrPdf(qr.id)
                            const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${qr.label || 'qr-code'}.pdf`
                            a.style.display = 'none'
                            document.body.appendChild(a)
                            a.click()
                            setTimeout(() => {
                              a.remove()
                              URL.revokeObjectURL(url)
                            }, 1000)
                          } catch {
                            const base = import.meta.env.VITE_API_URL || '/api/v1'
                            const token = localStorage.getItem('accessToken') || ''
                            window.open(`${base}/qr/${qr.id}/pdf?token=${encodeURIComponent(token)}`, '_blank')
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
                        title={t('qr.downloadPDF')}
                      >
                        <span className="text-[10px] font-bold text-text-secondary">PDF</span>
                      </button>
                    </div>
                    <button
                      onClick={() => deleteQrCode(qr.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-text-secondary hover:text-red-500 transition-colors"
                      title={t('app.delete')}
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
            {!loaded ? (
              <div className="space-y-3">
                <Skeleton variant="card" className="h-14" />
                <Skeleton variant="card" className="h-14" />
                <Skeleton variant="card" className="h-14" />
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-2 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50 uppercase w-[180px]">{t('staff.name')}</th>
                    <th className="px-2 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50">{t('staff.phone')}</th>
                    <th className="px-2 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50">{t('staff.role')}</th>
                    <th className="px-2 py-2 text-left font-accent text-xs text-text-secondary dark:text-white/50">{t('staff.status')}</th>
                    <th className="px-2 py-2 text-right font-accent text-xs text-text-secondary dark:text-white/50">{t('staff.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member: any) => (
                    <tr key={member.id} className="border-b border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-2 py-3 font-medium text-text-primary dark:text-white">
                        <div className="truncate max-w-[170px]" title={member.fullName || member.name}>{member.fullName || member.name}</div>
                        {member.employeeNumber && <span className="text-[10px] text-text-secondary/50 block truncate">#{member.employeeNumber}</span>}
                      </td>
                      <td className="px-2 py-3 text-text-secondary dark:text-white/60 text-xs">{member.phone}</td>
                      <td className="px-2 py-3">
                        <Badge variant={member.role === 'manager' ? 'info' : member.role === 'kitchen' ? 'warning' : member.role === 'cashier' ? 'success' : 'default'} size="sm" className="capitalize">
                          {t(`staff.${member.role}`)}
                        </Badge>
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={member.isActive !== false || member.active !== false ? 'success' : 'danger'} size="sm">
                          {(member.isActive !== false || member.active !== false) ? t('staff.active') : t('staff.inactive')}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-right space-x-1">
                        <button onClick={() => { setEditingStaffId(member.id); setNewStaff({ name: member.fullName || member.name || '', phone: member.phone || '', role: member.role || 'waiter', pin: '', email: member.email || '', employeeNumber: member.employeeNumber || '', nationalId: '', kraPin: '', nhifNumber: '', nssfNumber: '', dateOfBirth: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', nextOfKin: '', nextOfKinPhone: '', nextOfKinRelation: '', bankName: '', bankBranch: '', bankAccount: '', monthlySalary: '', hourlyRate: '', leaveDays: '', startDate: '', notes: '' }); setShowAddStaff(true) }}
                          className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-text-secondary hover:text-blue-500 transition-colors">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={async () => { if (confirm('Remove this staff member?')) { try { await removeStaff(member.id); showSuccessToast('Staff removed') } catch { /* error toast handled in store */ } } }}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-text-secondary hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            <AnimatePresence>
              {showAddStaff ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-xl border border-white/10 p-4 space-y-4">
                    <h4 className="font-heading font-bold text-sm">Personal Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Full Name *" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
                      <Input label="Phone *" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} placeholder="+2547XX XXX XXX" />
                      <Input label="Email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} type="email" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="National ID" value={newStaff.nationalId} onChange={(e) => setNewStaff({ ...newStaff, nationalId: e.target.value })} />
                      <Input label="KRA PIN" value={newStaff.kraPin} onChange={(e) => setNewStaff({ ...newStaff, kraPin: e.target.value })} />
                      <Input label="Date of Birth" value={newStaff.dateOfBirth} onChange={(e) => setNewStaff({ ...newStaff, dateOfBirth: e.target.value })} type="date" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Address" value={newStaff.address} onChange={(e) => setNewStaff({ ...newStaff, address: e.target.value })} />
                    </div>

                    <h4 className="font-heading font-bold text-sm">Employment Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Employee #" value={newStaff.employeeNumber} onChange={(e) => setNewStaff({ ...newStaff, employeeNumber: e.target.value })} />
                      <Input label="Start Date" value={newStaff.startDate} onChange={(e) => setNewStaff({ ...newStaff, startDate: e.target.value })} type="date" />
                      <Input label="Leave Days" value={newStaff.leaveDays} onChange={(e) => setNewStaff({ ...newStaff, leaveDays: e.target.value })} type="number" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Role</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['waiter', 'cashier', 'kitchen', 'manager'] as const).map((role) => (
                            <button key={role} onClick={() => setNewStaff({ ...newStaff, role })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${newStaff.role === role ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary dark:text-white/60'}`}>{t(`staff.${role}`)}</button>
                          ))}
                        </div>
                      </div>
                      <Input label="PIN *" value={newStaff.pin} onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })} maxLength={6} placeholder="4-6 digits" />
                    </div>

                    <h4 className="font-heading font-bold text-sm">NHIF / NSSF</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="NHIF Number" value={newStaff.nhifNumber} onChange={(e) => setNewStaff({ ...newStaff, nhifNumber: e.target.value })} />
                      <Input label="NSSF Number" value={newStaff.nssfNumber} onChange={(e) => setNewStaff({ ...newStaff, nssfNumber: e.target.value })} />
                    </div>

                    <h4 className="font-heading font-bold text-sm">Salary Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Monthly Salary (KES)" value={newStaff.monthlySalary} onChange={(e) => setNewStaff({ ...newStaff, monthlySalary: e.target.value })} type="number" />
                      <Input label="Hourly Rate (KES)" value={newStaff.hourlyRate} onChange={(e) => setNewStaff({ ...newStaff, hourlyRate: e.target.value })} type="number" />
                    </div>

                    <h4 className="font-heading font-bold text-sm">Banking</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Bank Name" value={newStaff.bankName} onChange={(e) => setNewStaff({ ...newStaff, bankName: e.target.value })} placeholder="e.g. Equity" />
                      <Input label="Branch" value={newStaff.bankBranch} onChange={(e) => setNewStaff({ ...newStaff, bankBranch: e.target.value })} />
                      <Input label="Account Number" value={newStaff.bankAccount} onChange={(e) => setNewStaff({ ...newStaff, bankAccount: e.target.value })} />
                    </div>

                    <h4 className="font-heading font-bold text-sm">Emergency Contact</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Name" value={newStaff.emergencyName} onChange={(e) => setNewStaff({ ...newStaff, emergencyName: e.target.value })} />
                      <Input label="Phone" value={newStaff.emergencyPhone} onChange={(e) => setNewStaff({ ...newStaff, emergencyPhone: e.target.value })} />
                      <Input label="Relationship" value={newStaff.emergencyRelation} onChange={(e) => setNewStaff({ ...newStaff, emergencyRelation: e.target.value })} />
                    </div>

                    <h4 className="font-heading font-bold text-sm">Next of Kin</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Name" value={newStaff.nextOfKin} onChange={(e) => setNewStaff({ ...newStaff, nextOfKin: e.target.value })} />
                      <Input label="Phone" value={newStaff.nextOfKinPhone} onChange={(e) => setNewStaff({ ...newStaff, nextOfKinPhone: e.target.value })} />
                      <Input label="Relationship" value={newStaff.nextOfKinRelation} onChange={(e) => setNewStaff({ ...newStaff, nextOfKinRelation: e.target.value })} />
                    </div>

                    <div>
                      <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">Additional Notes</label>
                      <textarea value={newStaff.notes} onChange={(e) => setNewStaff({ ...newStaff, notes: e.target.value })}
                        className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2 font-body text-sm text-text-primary dark:text-white placeholder:text-text-secondary/50 resize-none focus:border-secondary focus:outline-none" rows={2} />
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/10">
                      <Button size="sm" onClick={handleAddStaff} loading={staffSaving}><Save className="h-3.5 w-3.5" /> {editingStaffId ? 'Update Staff' : t('staff.addStaff')}</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setShowAddStaff(false); setEditingStaffId(null) }}>{t('app.cancel')}</Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <Button onClick={() => { setEditingStaffId(null); setNewStaff({ name: '', phone: '', role: 'waiter', pin: '', email: '', employeeNumber: '', nationalId: '', kraPin: '', nhifNumber: '', nssfNumber: '', dateOfBirth: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', nextOfKin: '', nextOfKinPhone: '', nextOfKinRelation: '', bankName: '', bankBranch: '', bankAccount: '', monthlySalary: '', hourlyRate: '', leaveDays: '', startDate: '', notes: '' }); setShowAddStaff(true) }}><Plus className="h-4 w-4" /> {t('staff.addStaff')}</Button>
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
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">
                    {t(`notifications.${key}`, key.replace(/([A-Z])/g, ' $1').trim())}
                  </p>
                </div>
                <Toggle checked={val} onChange={(checked) => setNotifSettings({ ...notifSettings, [key]: checked })} />
              </div>
            ))}
            <Button onClick={handleSaveNotifications} loading={saving}><Save className="h-4 w-4" /> {t('app.save')}</Button>
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
              <Toggle checked={paymentSettings.mpesaEnabled} onChange={(checked) => setPaymentSettings({ ...paymentSettings, mpesaEnabled: checked })} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">Cash</p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50">Accept cash payments</p>
                </div>
              </div>
              <Toggle checked={paymentSettings.cashEnabled} onChange={(checked) => setPaymentSettings({ ...paymentSettings, cashEnabled: checked })} />
            </div>

            <div className="border-t border-white/10 pt-4">
              <h4 className="font-accent text-sm font-bold text-text-primary dark:text-white mb-3">M-Pesa Products</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mpesaProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setPaymentSettings((prev) => ({
                        ...prev,
                        selectedProducts: prev.selectedProducts.includes(product.id)
                          ? prev.selectedProducts.filter((p) => p !== product.id)
                          : [...prev.selectedProducts, product.id],
                      }))
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      paymentSettings.selectedProducts.includes(product.id)
                        ? 'border-secondary/50 bg-secondary/5'
                        : 'border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      paymentSettings.selectedProducts.includes(product.id)
                        ? 'bg-secondary text-white'
                        : 'bg-black/5 dark:bg-white/10 text-text-secondary'
                    }`}>
                      <product.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-accent text-sm font-medium text-text-primary dark:text-white">{product.label}</p>
                      <p className="font-accent text-[10px] text-text-secondary dark:text-white/50">{product.desc}</p>
                    </div>
                    {paymentSettings.selectedProducts.includes(product.id) && (
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 ml-auto mt-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <h4 className="font-accent text-sm font-bold text-text-primary dark:text-white">M-Pesa STK Push (Online Checkout)</h4>
              <p className="font-accent text-xs text-text-secondary dark:text-white/50">
                Customers pay on their phone via a payment prompt (STK push). Money goes straight to <b>your</b> till or paybill — we never touch it.
              </p>
              <Input label="Active M-Pesa Number (Paybill or Till)" value={paymentSettings.mpesaShortcode}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, mpesaShortcode: e.target.value })} placeholder="e.g., 247247 (paybill) or 5273012 (till)" />
              <Input label="M-Pesa Passkey (from Daraja portal)" type="password" value={paymentSettings.mpesaPasskey}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, mpesaPasskey: e.target.value })}
                placeholder="Available in developer.safaricom.co.ke → your number → Lipa Na M-Pesa Online" />
              <Input label="Business Name (shown on payment prompt)" value={paymentSettings.businessName || restaurant?.name || ''}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, businessName: e.target.value })} placeholder="Business name registered with M-Pesa" />
            </div>
            <Button onClick={handleSavePayments} loading={saving}><Save className="h-4 w-4" /> Update Payment Settings</Button>
          </div>
        )

      case 'language':
        return (
          <div className="space-y-3">
            <p className="font-accent text-xs text-text-secondary dark:text-white/50 mb-2">{t('language.applied')}</p>
            {languages.map((lang) => (
              <button key={lang.code} onClick={() => setLanguage(lang.code as 'en' | 'sw' | 'ar')}
                className={`w-full flex items-center gap-3 rounded-xl p-4 transition-colors border ${
                  language === lang.code ? 'border-secondary/50 bg-secondary/5' : 'border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                }`}>
                <span className="text-2xl">{lang.flag}</span>
                <div className="text-left">
                  <p className="font-body text-sm font-medium text-text-primary dark:text-white">{lang.nativeName}</p>
                  <p className="font-accent text-xs text-text-secondary dark:text-white/50 uppercase">{lang.code} · {lang.label}</p>
                </div>
                {language === lang.code && <CheckCircle2 className="h-5 w-5 text-secondary ml-auto" />}
              </button>
            ))}
            <Button onClick={handleSaveLanguage} loading={saving}><Save className="h-4 w-4" /> {t('language.saveLanguage')}</Button>
          </div>
        )

      case 'aiUsage':
        return (
          <AiUsageSection />
        )

      case 'subscription': {
        const planName = (typeof restaurant?.plan === 'string' ? restaurant.plan : (restaurant?.plan as any)?.name || 'business').toLowerCase()
        const sub = subscription || (restaurant as any)?.subscription
        const planKey = sub?.plan?.name ? String(sub.plan.name).toLowerCase() : planName
        const price = Number(sub?.plan?.priceMonthly ?? (planKey === 'premium' ? 7500 : planKey === 'starter' ? 1500 : 3500))
        return (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-light p-6 text-white">
              <Crown className="h-8 w-8 text-accent mb-3" />
              <h3 className="font-heading text-xl font-bold">{planKey === 'premium' ? 'Premium Plan' : planKey === 'starter' ? 'Starter Plan' : 'Business Plan'}</h3>
              <p className="font-body text-sm text-white/70 mt-1">KES {price.toLocaleString()}/month</p>
              {sub?.planExpiresAt && (
                <p className="font-body text-xs text-white/50 mt-1">Renews {new Date(sub.planExpiresAt).toLocaleDateString('en-KE')}</p>
              )}
              <div className="mt-4 space-y-2">
                {(planKey === 'starter'
                  ? ['unlimitedItems', 'qrCodes']
                  : planKey === 'premium'
                  ? ['unlimitedItems', 'aiMarketing', 'staffManagement', 'qrCodes', 'analytics', 'prioritySupport']
                  : ['unlimitedItems', 'aiMarketing', 'staffManagement', 'qrCodes', 'analytics']
                ).map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-white/80">
                    <Shield className="h-3.5 w-3.5 text-accent" />
                    {t(`subscription.features.${feature}`)}
                  </div>
                ))}
              </div>
            </div>
            <Button variant="secondary" fullWidth onClick={() => window.open('https://menumoja.vercel.app', '_blank')}>
              <Crown className="h-4 w-4" /> {t('subscription.upgrade')}
            </Button>
          </div>
        )
      }

      case 'delete':
        return (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span className="font-accent font-bold text-sm uppercase">{t('common.dangerZone')}</span>
              </div>
              <p className="font-body text-sm text-red-600 dark:text-red-400/80">{t('common.irreversible')}</p>
            </div>
            <div className="space-y-3">
              <Input label={t('common.typeToConfirm')} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
              <Input label={t('auth.passwordPlaceholder')} type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder={t('auth.passwordPlaceholder')} />
              <Button variant="ghost" fullWidth className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4" /> {t('common.confirmDelete')}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">{t('settings.title')}</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">{t('settings.subtitle')}</p>
        </div>
        <RefreshButton refreshing={refreshing} onClick={() => { setRefreshing(true); loadAll() }} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-56 shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {settingsSections.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-accent font-medium transition-colors whitespace-nowrap ${
                  section === s.id ? 'bg-secondary text-white' : 'text-text-secondary dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10'
                }`}>
                <s.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{t(s.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4 capitalize">
              {t(settingsSections.find((s) => s.id === section)?.labelKey || '')}
            </h2>
            {renderActiveSection()}
          </div>
        </div>
      </div>
    </div>
  )
}

function AiUsageSection() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    import('@/api/ai').then((aiApi) =>
      aiApi.getAiUsage(period)
        .then((data: any) => { if (!cancelled) setUsage(data) })
        .catch(() => { if (!cancelled) setUsage(null) })
        .finally(() => { if (!cancelled) setLoading(false) })
    )
    return () => { cancelled = true }
  }, [period])

  if (loading) {
    return <Skeleton variant="card" className="h-48" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {(['today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-secondary'}`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
          <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Requests</p>
          <p className="font-heading text-2xl font-bold text-text-primary dark:text-white mt-1">{usage?.requests ?? 0}</p>
        </div>
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
          <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Tokens</p>
          <p className="font-heading text-2xl font-bold text-text-primary dark:text-white mt-1">{(usage?.totalTokens ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4">
          <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">Est. Cost (KES)</p>
          <p className="font-heading text-2xl font-bold text-text-primary dark:text-white mt-1">{Number(usage?.estimatedCostKes ?? 0).toFixed(4)}</p>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        Daily token budget: {(usage?.dailyTokenBudget ?? 0).toLocaleString()} — when exceeded, the AI chat automatically falls back to the built-in chef assistant so restaurant operations never depend on the AI.
      </p>

      {(usage?.byFeature ?? []).length > 0 && (
        <div className="space-y-1.5">
          <p className="font-accent text-xs text-text-secondary uppercase tracking-wider">By feature</p>
          {(usage?.byFeature ?? []).map((f: any) => (
            <div key={f.feature} className="flex items-center justify-between text-sm py-1 border-b border-black/5 dark:border-white/5 last:border-0">
              <span className="text-text-primary dark:text-white">{f.feature.replace(/_/g, ' ')}</span>
              <span className="font-accent text-xs text-text-secondary">{f.requests} req · {f.tokens.toLocaleString()} tokens · KES {Number(f.estimatedCostKes).toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
