import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GoogleLogin } from '@react-oauth/google'
import { ChefHat, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login, loginWithGoogle } = useStore()
  const navigate = useNavigate()

  const {
    register, handleSubmit, setValue, formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const handleLogin = async (data: { email: string; password: string }) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch {
      // error toast handled in store
    } finally {
      setLoading(false)
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
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="text-9xl mb-8"
          >
            👨‍🍳
          </motion.div>
          <h1 className="text-4xl font-heading font-bold text-white mb-4">Welcome Back!</h1>
          <p className="text-gray-300 text-lg max-w-sm mx-auto">
            Your restaurant is waiting for you
          </p>
          <div className="mt-12 space-y-4 max-w-xs mx-auto">
            {[
              { emoji: '📊', text: 'View real-time sales' },
              { emoji: '🍕', text: 'Update your menu' },
              { emoji: '📱', text: 'Manage orders' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.2 }}
                className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-white/80 text-sm">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-tr from-secondary/10 to-transparent" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-4"
              >
                <ChefHat className="w-8 h-8 text-white" />
              </motion.div>
              <h1 className="text-2xl font-heading font-bold text-primary">Welcome Back</h1>
              <p className="text-text-secondary text-sm mt-1">Sign in to manage your restaurant</p>
            </div>

            <form onSubmit={handleSubmit(handleLogin)} className="space-y-4">
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
                    placeholder="Enter your password"
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
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <a href="/forgot-password" className="text-xs text-secondary font-semibold hover:underline">
                  Forgot password?
                </a>
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
                Sign In
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background-light px-4 text-xs text-text-secondary">or</span>
              </div>
            </div>

            <div className="flex justify-center mb-4">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google sign in failed')}
              />
            </div>

            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={handleDemoLogin}
              className="mb-6"
            >
              Try Demo Account
            </Button>

            <p className="text-center text-sm text-text-secondary">
              Don't have an account?{' '}
              <a href="/signup" className="text-secondary font-semibold hover:underline">
                Sign up
              </a>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
