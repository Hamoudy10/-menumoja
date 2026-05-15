import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GoogleLogin } from '@react-oauth/google'
import {
  ChefHat, Mail, Phone, Lock, Eye, EyeOff, User, Store,
  ArrowRight, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const signUpSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  phone: z.string().min(10, 'Valid phone is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[0-9]/, 'One number'),
})

const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-success', 'bg-emerald-500']

function getPasswordStrength(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

export default function SignUpPage() {
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [userId, setUserId] = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const { register: storeRegister, verifyOtp, loginWithGoogle } = useStore()
  const navigate = useNavigate()

  const {
    register, handleSubmit, watch, formState: { errors },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      restaurantName: '',
      ownerName: '',
      phone: '+254',
      email: '',
      password: '',
    },
  })

  const password = watch('password')
  const strength = getPasswordStrength(password || '')

  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus()
    }
  }, [step])

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.split('').slice(0, 6)
      const newOtp = [...otp]
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d
      })
      setOtp(newOtp)
      const nextIndex = Math.min(index + digits.length, 5)
      otpRefs.current[nextIndex]?.focus()
      return
    }

    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const digits = text.replace(/\D/g, '').slice(0, 6).split('')
    const newOtp = [...otp]
    digits.forEach((d, i) => { newOtp[i] = d })
    setOtp(newOtp)
    const focusIndex = Math.min(digits.length, 5)
    otpRefs.current[focusIndex]?.focus()
  }

  const handleSignUp = async (formData: {
    restaurantName: string
    ownerName: string
    phone: string
    email: string
    password: string
  }) => {
    setLoading(true)
    try {
      const res = await storeRegister({
        name: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        restaurantName: formData.restaurantName,
      })
      setUserId(res.user?.id || res.userId)
      setStep('otp')
    } catch {
      // error toast handled in store
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6 || !userId) return
    setLoading(true)
    try {
      await verifyOtp(userId, code)
      navigate('/onboarding/welcome')
    } catch {
      // error toast handled in store
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (!userId) return
    try {
      const { resendOtp } = await import('@/api/auth')
      await resendOtp(userId)
      toast.success('OTP resent')
    } catch {
      toast.error('Failed to resend OTP')
    }
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true)
    try {
      await loginWithGoogle(credentialResponse.credential)
      navigate('/dashboard')
    } catch {
      // error toast handled in store
    } finally {
      setLoading(false)
    }
  }

  const isOtpComplete = otp.every((d) => d !== '')

  return (
    <div className="min-h-screen flex bg-background-light">
      <div className="hidden lg:flex w-1/2 bg-primary relative items-center justify-center overflow-hidden">
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="text-center relative z-10"
        >
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
            className="text-9xl mb-8"
          >
            🍽️
          </motion.div>
          <h1 className="text-4xl font-heading font-bold text-white mb-4">MenuMoja</h1>
          <p className="text-gray-300 text-lg max-w-sm mx-auto">
            Your restaurant's digital presence, one scan away
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4 max-w-md mx-auto">
            {['📱', '🍕', '⚡', '🌍', '💳', '🎉'].map((emoji, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-4 text-center"
              >
                <div className="text-3xl mb-2">{emoji}</div>
                <p className="text-white/60 text-xs">
                  {['Mobile Menu', 'Easy Order', 'Fast Setup', 'Global', 'M-Pesa', 'Go Live'][i]}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-accent/5" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === 'form' ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-4"
                  >
                    <ChefHat className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-2xl font-heading font-bold text-primary">Create Your Account</h1>
                  <p className="text-text-secondary text-sm mt-1">Join MenuMoja and digitize your restaurant</p>
                </div>

                <form onSubmit={handleSubmit(handleSignUp)} className="space-y-4">
                  <div>
                    <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">
                      Restaurant Name
                    </label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        {...register('restaurantName')}
                        placeholder="e.g., Bahari Restaurant"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                      />
                    </div>
                    {errors.restaurantName && (
                      <p className="text-xs text-red-400 mt-1">{errors.restaurantName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">
                      Owner Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        {...register('ownerName')}
                        placeholder="Your full name"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                      />
                    </div>
                    {errors.ownerName && (
                      <p className="text-xs text-red-400 mt-1">{errors.ownerName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        {...register('phone')}
                        placeholder="+254 712 345 678"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-xs text-red-400 mt-1">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min. 8 characters"
                        className="w-full pl-10 pr-12 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-text-secondary" />
                        ) : (
                          <Eye className="w-4 h-4 text-text-secondary" />
                        )}
                      </button>
                    </div>
                    {password && (
                      <div className="mt-2 space-y-1.5">
                        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${((strength + 1) / 5) * 100}%` }}
                            className={`h-full rounded-full ${strengthColors[strength]}`}
                          />
                        </div>
                        <p className="text-xs text-text-secondary">
                          {strength < strengthLabels.length ? strengthLabels[strength] : 'Very Strong'}
                        </p>
                      </div>
                    )}
                    {errors.password && (
                      <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={loading}
                    icon={<ArrowRight className="w-5 h-5" />}
                    iconPosition="right"
                  >
                    Create Account
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background-light px-4 text-xs text-text-secondary">or continue with</span>
                  </div>
                </div>

                <div className="flex justify-center mb-6">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error('Google sign up failed')}
                  />
                </div>

                <p className="text-center text-sm text-text-secondary">
                  Already have an account?{' '}
                  <a href="/login" className="text-secondary font-semibold hover:underline">
                    Login
                  </a>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-success to-emerald-400 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-2xl font-heading font-bold text-primary">Verify Your Account</h1>
                  <p className="text-text-secondary text-sm mt-1">
                    Enter the 6-digit code sent to your phone
                  </p>
                </div>

                <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                        digit
                          ? 'border-secondary bg-secondary/5'
                          : 'border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleVerifyOtp}
                  loading={loading}
                  disabled={!isOtpComplete}
                >
                  Verify Account
                </Button>

                <p className="text-center text-sm text-text-secondary mt-6">
                  Didn't receive code?{' '}
                  <button onClick={handleResendOtp} className="text-secondary font-semibold hover:underline">
                    Resend
                  </button>
                </p>

                <button
                  onClick={() => setStep('form')}
                  className="mt-4 text-sm text-text-secondary hover:text-primary transition-colors text-center w-full"
                >
                  ← Back to form
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
