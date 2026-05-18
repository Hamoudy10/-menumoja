import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Phone, CheckCircle2, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as authApi from '@/api/auth'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone) return
    setSending(true)
    try {
      await authApi.forgotPassword(phone)
      setSent(true)
      showSuccessToast('OTP sent to your phone')
    } catch {
      showErrorToast('Failed to send OTP')
    } finally {
      setSending(false)
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
          {sent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">Check your phone</h2>
              <p className="font-body text-sm text-text-secondary">
                We've sent an OTP to <strong>{phone}</strong>. Use it to reset your password.
              </p>
              <Button variant="outline" fullWidth onClick={() => navigate('/login')}>
                Return to login
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="font-heading text-xl font-bold text-text-primary dark:text-white">Forgot password?</h2>
                <p className="font-body text-sm text-text-secondary mt-1">Enter your phone number to receive a reset OTP</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Phone number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2547XX XXX XXX"
                  required
                />
                <Button type="submit" fullWidth loading={sending} disabled={!phone}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                  Send OTP
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
