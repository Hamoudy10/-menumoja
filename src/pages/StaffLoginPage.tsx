import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChefHat, Lock, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as authApi from '@/api/auth'

export default function StaffLoginPage() {
  const [pin, setPin] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!pin || !slug) { toast.error('PIN and restaurant slug are required'); return }
    setLoading(true)
    try {
      const data = await authApi.staffLogin(pin, slug)
      const accessToken = data.tokens?.accessToken || data.accessToken
      const refreshToken = data.tokens?.refreshToken || data.refreshToken
      localStorage.setItem('staffAccessToken', accessToken)
      localStorage.setItem('staffRefreshToken', refreshToken)
      localStorage.setItem('staffRole', data.staff?.role || 'waiter')
      localStorage.setItem('staffName', data.staff?.fullName || 'Staff')
      localStorage.setItem('staffRestaurantSlug', slug)
      toast.success(`Welcome, ${data.staff?.fullName || 'Staff'}!`)
      const role = data.staff?.role || 'waiter'
      if (role === 'cashier') navigate('/staff/cashier')
      else if (role === 'kitchen') navigate('/staff/kitchen')
      else navigate('/staff/kitchen')
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Invalid PIN or slug')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background-light">
      <div className="hidden lg:flex w-1/2 bg-primary relative items-center justify-center overflow-hidden">
        <div className="text-center relative z-10">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 5, repeat: Infinity }} className="text-8xl mb-6">👨‍🍳</motion.div>
          <h1 className="text-3xl font-heading font-bold text-white mb-2">Staff Portal</h1>
          <p className="text-gray-300 text-base">Clock in and manage your tasks</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <a href="/" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-secondary mb-8">
            <ArrowLeft className="w-3 h-3" /> Back to Home
          </a>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-3">
                <ChefHat className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-xl font-heading font-bold text-primary">Staff Sign In</h1>
              <p className="text-text-secondary text-xs mt-1">Enter your PIN and restaurant slug</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                  type="password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your 4-6 digit PIN"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Restaurant slug (e.g. my-restaurant)"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleLogin}
                icon={<ArrowRight className="w-5 h-5" />} iconPosition="right">
                Sign In
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
