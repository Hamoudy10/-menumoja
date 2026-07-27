import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GoogleLogin } from '@react-oauth/google'
import { ChefHat, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, UserCog, Smartphone, Store } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as authApi from '@/api/auth'

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
})

const roles = [
  { id: 'owner', label: 'Restaurant Owner', icon: Store, description: 'Email & password or Google' },
  { id: 'staff', label: 'Staff / Employee', icon: UserCog, description: 'PIN & restaurant slug' },
]

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<'owner' | 'staff'>('owner')
  const [staffPin, setStaffPin] = useState('')
  const [staffSlug, setStaffSlug] = useState('')
  const { login, loginWithGoogle } = useStore()
  const navigate = useNavigate()

  const {
    register, handleSubmit, setValue, formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const handleOwnerLogin = async (data: { email: string; password: string }) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch { } finally { setLoading(false) }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true)
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate('/dashboard')
    } catch { } finally { setLoading(false) }
  }

  const handleStaffLogin = async () => {
    if (!staffPin || !staffSlug) { toast.error('PIN and restaurant slug are required'); return }
    setLoading(true)
    try {
      const data = await authApi.staffLogin(staffPin, staffSlug)
      localStorage.setItem('staffAccessToken', data.tokens?.accessToken || data.accessToken)
      localStorage.setItem('staffRefreshToken', data.tokens?.refreshToken || data.refreshToken)
      localStorage.setItem('staffRole', data.staff?.role || 'waiter')
      localStorage.setItem('staffName', data.staff?.fullName || 'Staff')
      const r = data.staff?.role || 'waiter'
      if (r === 'cashier') navigate('/staff/cashier')
      else if (r === 'waiter') navigate('/staff/waiter')
      else navigate('/staff/kitchen')
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Invalid PIN or slug')
    } finally { setLoading(false) }
  }

  const handleDemoLogin = () => {
    setValue('email', 'demo@menumoja.com')
    setValue('password', 'Demo1234')
  }

  return (
    <div className="min-h-screen flex bg-background-light">
      <div className="hidden lg:flex w-1/2 bg-primary relative items-center justify-center overflow-hidden">
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="text-center relative z-10"
        >
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 5, repeat: Infinity }} className="text-9xl mb-8">👨‍🍳</motion.div>
          <h1 className="text-4xl font-heading font-bold text-white mb-4">Welcome Back!</h1>
          <p className="text-gray-300 text-lg max-w-sm mx-auto">Your restaurant is waiting for you</p>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <a href="/" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-secondary transition-colors mb-6">
              <ArrowLeft className="w-3 h-3" /> Back to Home
            </a>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-3">
                <ChefHat className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-xl font-heading font-bold text-primary">Sign In</h1>
              <p className="text-text-secondary text-xs mt-1">Choose your role to continue</p>
            </div>

            <div className="flex gap-2 mb-6">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id as 'owner' | 'staff')}
                  className={`flex-1 flex flex-col items-center gap-2 rounded-2xl p-4 border-2 transition-all ${
                    role === r.id ? 'border-secondary bg-secondary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <r.icon className={`w-6 h-6 ${role === r.id ? 'text-secondary' : 'text-text-secondary'}`} />
                  <span className={`text-sm font-medium ${role === r.id ? 'text-secondary' : 'text-text-secondary'}`}>
                    {r.label}
                  </span>
                  <span className="text-[10px] text-text-secondary/50">{r.description}</span>
                </button>
              ))}
            </div>

            {role === 'owner' ? (
              <>
                <form onSubmit={handleSubmit(handleOwnerLogin)} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input {...register('email')} type="email" placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all" />
                  </div>
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Enter your password"
                      className="w-full pl-10 pr-12 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff className="w-4 h-4 text-text-secondary" /> : <Eye className="w-4 h-4 text-text-secondary" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}

                  <div className="flex justify-end">
                    <a href="/forgot-password" className="text-xs text-secondary font-semibold hover:underline">Forgot password?</a>
                  </div>

                  <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}
                    icon={<ArrowRight className="w-5 h-5" />} iconPosition="right">
                    Sign In as Owner
                  </Button>
                </form>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center"><span className="bg-background-light px-4 text-xs text-text-secondary">or</span></div>
                </div>

                <div className="flex justify-center mb-3">
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google sign in failed')} />
                </div>

                <Button variant="ghost" size="md" fullWidth onClick={handleDemoLogin}>Try Demo Account</Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input type="password" maxLength={6} value={staffPin} onChange={(e) => setStaffPin(e.target.value)}
                    placeholder="Enter your 4-6 digit PIN"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()} />
                </div>
                <Input value={staffSlug} onChange={(e) => setStaffSlug(e.target.value)}
                  placeholder="Restaurant slug (e.g., my-restaurant)"
                  onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()} />
                <Button variant="primary" size="lg" fullWidth loading={loading} onClick={handleStaffLogin}
                  icon={<ArrowRight className="w-5 h-5" />} iconPosition="right">
                  Sign In as Staff
                </Button>
              </div>
            )}

            <p className="text-center text-sm text-text-secondary mt-6">
              Don't have an account?{' '}
              <a href="/signup" className="text-secondary font-semibold hover:underline">Sign up</a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
