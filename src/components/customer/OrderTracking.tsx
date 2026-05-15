'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, ChefHat, UtensilsCrossed, Smile, ArrowLeft, MessageCircle, Timer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Order } from '@/types'

interface OrderTrackingProps {
  order: Order
  onBack?: () => void
  onNeedHelp?: () => void
}

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

const statusSteps = [
  { key: 'new', label: 'Order Received', icon: Check },
  { key: 'preparing', label: 'Being Prepared', icon: ChefHat },
  { key: 'ready', label: 'Ready for You', icon: UtensilsCrossed },
  { key: 'served', label: 'Enjoy Your Meal!', icon: Smile },
] as const

export function OrderTracking({ order, onBack, onNeedHelp }: OrderTrackingProps) {
  const language = useStore((s) => s.language)
  const updateOrderStatus = useStore((s) => s.updateOrderStatus)
  const [elapsed, setElapsed] = useState(0)
  const [dots, setDots] = useState('')

  const currentIndex = statusSteps.findIndex((s) => s.key === order.status)
  const progress = ((currentIndex + 1) / statusSteps.length) * 100

  const estimatedMinutes = 25
  const remaining = Math.max(0, estimatedMinutes - elapsed)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => Math.min(e + 1, estimatedMinutes))
    }, 60000)
    return () => clearInterval(interval)
  }, [estimatedMinutes])

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const t = (key: string): string => {
    if (language === 'sw') {
      if (key === 'received') return 'Agizo Limepokelewa!'
      if (key === 'estimated') return 'Inakadiriwa kukamilika'
      if (key === 'help') return 'Unahitaji msaada?'
      if (key === 'items') return 'Vitu Vilivyoagizwa'
      if (key === 'total') return 'Jumla'
      if (key === 'payment') return 'Malipo'
      if (key === 'mpesa') return 'M-Pesa'
      if (key === 'cash') return 'Pesa Taslimu'
      if (key === 'preparing') return 'Inatayarishwa'
      if (key === 'ready') return 'Iko Tayari'
      if (key === 'served') return 'Kula Vizuri!'
      return key
    }
    if (language === 'ar') {
      if (key === 'received') return 'تم استلام الطلب!'
      if (key === 'estimated') return 'الوقت المقدر'
      if (key === 'help') return 'هل تحتاج مساعدة؟'
      if (key === 'items') return 'العناصر المطلوبة'
      if (key === 'total') return 'المجموع'
      if (key === 'payment') return 'الدفع'
      if (key === 'mpesa') return 'إم-Pesa'
      if (key === 'cash') return 'نقدًا'
      if (key === 'preparing') return 'قيد التحضير'
      if (key === 'ready') return 'جاهز لك'
      if (key === 'served') return 'استمتع بوجبتك!'
      return key
    }
    if (key === 'received') return 'Order Received!'
    if (key === 'estimated') return 'Estimated time'
    if (key === 'help') return 'Need help?'
    if (key === 'items') return 'Ordered Items'
    if (key === 'total') return 'Total'
    if (key === 'payment') return 'Payment'
    if (key === 'mpesa') return 'M-Pesa'
    if (key === 'cash') return 'Cash'
    if (key === 'preparing') return 'Being Prepared'
    if (key === 'ready') return 'Ready for You'
    if (key === 'served') return 'Enjoy Your Meal!'
    return key
  }

  return (
    <div className="min-h-screen bg-background-light">
      <div className="bg-gradient-to-b from-secondary to-secondary/90 px-5 pb-12 pt-12 text-white">
        {onBack && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="mb-4">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-heading text-2xl font-bold">{t('received')} 🎉</h1>
          <p className="mt-1 text-white/70 text-sm">Order #{order.id}</p>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm"
          >
            <Timer className="h-5 w-5 text-accent" />
            <div>
              <p className="text-xs text-white/60">{t('estimated')}</p>
              <p className="font-heading text-lg font-bold">
                {remaining > 0 ? `${remaining} min` : 'Any moment!'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="-mt-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-white p-5 shadow-soft"
        >
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-secondary to-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          <div className="relative">
            {statusSteps.map((step, i) => {
              const StepIcon = step.icon
              const isComplete = i <= currentIndex
              const isCurrent = i === currentIndex
              const isLast = i === statusSteps.length - 1

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.15 : 1,
                        backgroundColor: isComplete ? (isCurrent ? '#FF6B35' : '#2ECC71') : '#e5e7eb',
                      }}
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
                        isComplete ? 'text-white' : 'text-gray-400'
                      }`}
                    >
                      {isCurrent && step.key === 'preparing' ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                          <Clock className="h-4 w-4 text-white" />
                        </motion.div>
                      ) : isComplete ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </motion.div>
                    {!isLast && (
                      <div
                        className={`h-8 w-0.5 ${
                          isComplete && i + 1 <= currentIndex
                            ? 'bg-success'
                            : isCurrent
                              ? 'bg-gradient-to-b from-secondary to-gray-300'
                              : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex-1 pb-6">
                    <p
                      className={`font-accent text-sm font-medium ${
                        isComplete
                          ? isCurrent
                            ? 'text-secondary'
                            : 'text-success'
                          : 'text-text-secondary/50'
                      }`}
                    >
                      {step.label}
                      {isCurrent && step.key === 'preparing' && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="ml-1 text-text-secondary/40"
                        >
                          {dots}
                        </motion.span>
                      )}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      <div className="mt-4 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl bg-white p-5 shadow-soft"
        >
          <h3 className="mb-3 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {t('items')}
          </h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/10 text-xs font-bold text-secondary">
                    {item.quantity}
                  </span>
                  <span className="font-body text-sm text-text-primary">{item.name}</span>
                </div>
                <span className="font-accent text-sm font-medium text-text-primary">
                  {formatKES(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="font-accent text-sm font-bold text-text-primary">{t('total')}</span>
              <span className="font-heading text-lg font-bold text-secondary">
                {formatKES(order.total)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-accent text-xs text-text-secondary">{t('payment')}</span>
              <span className="font-accent text-xs font-medium">
                {order.paymentMethod === 'mpesa' ? t('mpesa') : t('cash')}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {onNeedHelp && (
        <div className="px-4 pb-8 pt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onNeedHelp}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-secondary/30 bg-white py-3 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
          >
            <MessageCircle className="h-4 w-4" />
            {t('help')}
          </motion.button>
        </div>
      )}

      <div className="h-8" />
    </div>
  )
}
