import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import api from '@/api/client'

export default function StaffProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    pin: '',
  })

  useEffect(() => {
    const staffId = localStorage.getItem('staffId')
    if (!staffId) return
    api.get(`/staff/${staffId}`).then((res) => {
      const data = res.data?.data || res.data
      if (data) {
        setProfile({ name: data.name || '', email: data.email || '', phone: data.phone || '', pin: '' })
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!profile.name) return
    setSaving(true)
    try {
      const staffId = localStorage.getItem('staffId')
      const payload: any = { name: profile.name, email: profile.email, phone: profile.phone }
      if (profile.pin) payload.pin = profile.pin
      await api.put(`/staff/${staffId}`, payload)
      localStorage.setItem('staffName', profile.name)
      showSuccessToast('Profile updated')
    } catch {
      showErrorToast('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const staffName = localStorage.getItem('staffName')
  const staffRole = localStorage.getItem('staffRole')

  return (
    <div className="min-h-screen bg-background-light">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-soft">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="font-heading font-bold text-primary text-lg">My Profile</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-secondary" /></div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft text-center">
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
                <User className="w-10 h-10 text-secondary" />
              </div>
              <h2 className="font-bold text-primary text-lg">{staffName || profile.name}</h2>
              <p className="text-sm text-text-secondary capitalize">{staffRole || 'Staff'}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft space-y-4">
              <Input label="Full Name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder="Your name" />
              <Input label="Email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" type="email" />
              <Input label="Phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+2547XX XXX XXX" type="tel" />
              <Input label="New PIN (leave blank to keep current)" value={profile.pin} onChange={(e) => setProfile((p) => ({ ...p, pin: e.target.value }))} placeholder="4-6 digit PIN" type="password" maxLength={6} />
            </div>

            <Button variant="primary" size="lg" fullWidth loading={saving} disabled={saving || !profile.name} onClick={handleSave}>
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </>
        )}
      </main>
    </div>
  )
}
