'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, Check, X, RefreshCw, ArrowDown, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface MPesaPaymentProps {
  amount: number
  onSuccess: (receipt: string) => void
  onFailure: () => void
  onRetry: () => void
}

type MpesaStep = 'sending' | 'prompt' | 'pin' | 'waiting' | 'success' | 'failure'

export function MPesaPayment({ amount, onSuccess, onFailure, onRetry }: MPesaPaymentProps) {
  const [step, setStep] = useState<MpesaStep>('sending')
  const [receipt, setReceipt] = useState('')
  const [confetti, setConfetti] = useState(false)

  const formatKES = (n: number) => `KES ${n.toLocaleString('en-KE')}`

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep('prompt'), 2000),
      setTimeout(() => setStep('pin'), 4000),
      setTimeout(() => setStep('waiting'), 6000),
      setTimeout(() => {
        setStep('success')
        const ref = 'MPE' + Math.random().toString(36).substring(2, 8).toUpperCase()
        setReceipt(ref)
        setConfetti(true)
        setTimeout(() => onSuccess(ref), 2000)
      }, 9000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onSuccess])

  useEffect(() => {
    if (!confetti) return
    const interval = setInterval(() => {
      const el = document.getElementById('confetti-container')
      if (el) {
        const colors = ['#FF6B35', '#FFD700', '#2ECC71', '#FF0000', '#00BFFF']
        for (let i = 0; i < 5; i++) {
          const dot = document.createElement('div')
          dot.className = 'absolute w-2 h-2 rounded-full'
          dot.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
          dot.style.left = Math.random() * 100 + '%'
          dot.style.top = '-5%'
          dot.style.animation = `confettiFall ${1.5 + Math.random() * 2}s linear forwards`
          dot.style.transform = `rotate(${Math.random() * 360}deg)`
          el.appendChild(dot)
          setTimeout(() => dot.remove(), 3000)
        }
      }
    }, 200)
    return () => clearInterval(interval)
  }, [confetti])

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div id="confetti-container" className="pointer-events-none fixed inset-0 z-50 overflow-hidden" />

      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <Smartphone className="h-10 w-10 text-green-600" />
      </div>

      <AnimatePresence mode="wait">
        {step === 'sending' && (
          <motion.div
            key="sending"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mb-4"
            >
              <Smartphone className="h-16 w-16 text-secondary" />
            </motion.div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Sending payment request...
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              {formatKES(amount)} via M-Pesa
            </p>
            <div className="mt-4 flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                  className="h-2 w-2 rounded-full bg-secondary"
                />
              ))}
            </div>
          </motion.div>
        )}

        {step === 'prompt' && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -5, 5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="mb-4"
            >
              <Smartphone className="h-16 w-16 text-green-500" />
            </motion.div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Check your phone
            </h3>
            <p className="mt-1 text-center text-sm text-text-secondary">
              We've sent a payment request to your M-Pesa.<br />
              Check for the M-Pesa prompt on your phone.
            </p>
          </motion.div>
        )}

        {step === 'pin' && (
          <motion.div
            key="pin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="mb-4"
            >
              <Smartphone className="h-16 w-16 text-blue-500" />
            </motion.div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Enter your M-Pesa PIN
            </h3>
            <p className="mt-1 text-center text-sm text-text-secondary">
              Open the M-Pesa menu on your phone<br />
              and enter your PIN to confirm payment.
            </p>
          </motion.div>
        )}

        {step === 'waiting' && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center"
          >
            <Smartphone className="mb-4 h-16 w-16 text-text-secondary" />
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Waiting for confirmation
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Please wait while we confirm your payment
            </p>
            <div className="mt-4 flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                  className="h-3 w-3 rounded-full bg-accent"
                />
              ))}
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success"
            >
              <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <motion.path
                  d="M5 13l4 4L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                />
              </svg>
            </motion.div>
            <h3 className="font-heading text-xl font-bold text-green-600">
              Payment Successful! 🎉
            </h3>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-4 w-full rounded-2xl bg-green-50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">Amount</span>
                <span className="font-bold text-green-700">{formatKES(amount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm text-green-700">Receipt</span>
                <span className="font-mono text-sm font-bold text-green-700">{receipt}</span>
              </div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-2 h-0.5 bg-green-300"
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-2 text-center text-xs text-green-600"
              >
                Thank you for your payment!
              </motion.p>
            </motion.div>
          </motion.div>
        )}

        {step === 'failure' && (
          <motion.div
            key="failure"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100"
            >
              <X className="h-10 w-10 text-red-500" />
            </motion.div>
            <h3 className="font-heading text-xl font-bold text-red-600">
              Payment Failed
            </h3>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Oops! Something went wrong with your payment.<br />
              Please try again or use a different payment method.
            </p>
            <div className="mt-6 flex flex-col gap-2 w-full">
              <Button
                fullWidth
                variant="primary"
                size="lg"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={onRetry}
              >
                Try Again
              </Button>
              <Button
                fullWidth
                variant="ghost"
                size="lg"
                onClick={onFailure}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
