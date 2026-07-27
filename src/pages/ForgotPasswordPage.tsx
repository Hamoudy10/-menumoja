import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Phone, CheckCircle2, Loader2, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as authApi from '@/api/auth'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [sending, setSending] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier) return
    setSending(true)
    try {
      await authApi.forgotPassword(identifier)
      showSuccessToast('OTP sent — check backend terminal logs')
      setStep('reset')
    } catch {
      showErrorToast('Failed to send OTP')
    } finally {
      setSending(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || !newPassword) return
    if (newPassword.length < 8) {
      showErrorToast('Password must be at least 8 characters')
      return
    }
    setResetting(true)
    try {
      await authApi.resetPassword(identifier, otp, newPassword)
      setDone(true)
      showSuccessToast('Password reset successfully')
    } catch {
      showErrorToast('Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background-light flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-accent text-sm">Back to login</span>
        </button>

        <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-6 space-y-6">
          {done ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">Password reset</h2>
              <p className="font-body text-sm text-text-secondary">Your password has been updated. Login with your new password.</p>
              <Button variant="outline" fullWidth onClick={() => navigate('/login')}>
                Go to login
              </Button>
            </div>
          ) : step === 'request' ? (
            <>
              <div className="text-center">
                <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">Forgot password?</h2>
                <p className="font-body text-sm text-text-secondary mt-1">Enter your email or phone to receive a reset OTP</p>
              </div>
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <Input
                  label="Email or phone number"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +2547XX XXX XXX"
                  required
                />
                <Button type="submit" fullWidth loading={sending} disabled={!identifier}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send OTP
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center">
                <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">Reset password</h2>
                <p className="font-body text-sm text-text-secondary mt-1">Enter the OTP from the backend terminal and your new password</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <Input label="OTP" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" required />
                <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" required />
                <Button type="submit" fullWidth loading={resetting} disabled={!otp || !newPassword}>
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Reset password
                </Button>
                <Button variant="ghost" fullWidth onClick={() => setStep('request')}>
                  Back
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}