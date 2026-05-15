'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, X, ShoppingBag, ArrowLeft, Smartphone, Banknote, Check, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'

const tips = [0, 5, 10]

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

const categoryEmojis: Record<string, string> = {
  '1': '🍖',
  '2': '🥟',
  '3': '🥤',
}

interface CartPageProps {
  onBack?: () => void
  onPlaceOrder?: (order: {
    items: any[]
    total: number
    tip: number
    notes: string
    paymentMethod: 'mpesa' | 'cash'
  }) => void
}

export function CartPage({ onBack, onPlaceOrder }: CartPageProps) {
  const { cart, removeFromCart, updateCartQuantity, clearCart, language } = useStore()
  const [tipPercent, setTipPercent] = useState<number | 'custom'>(0)
  const [customTip, setCustomTip] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash' | null>(null)
  const [placing, setPlacing] = useState(false)
  const [placed, setPlaced] = useState(false)

  const subtotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0)

  const tipAmount = tipPercent === 'custom'
    ? (parseInt(customTip) || 0)
    : Math.round(subtotal * (tipPercent / 100))

  const serviceFee = Math.round(subtotal * 0.05)
  const total = subtotal + tipAmount + serviceFee

  const handlePlaceOrder = () => {
    if (!paymentMethod) return
    setPlacing(true)
    setTimeout(() => {
      setPlaced(true)
      if (onPlaceOrder) {
        onPlaceOrder({
          items: cart.map((c) => ({
            ...c.item,
            quantity: c.quantity,
            specialInstructions: c.specialInstructions,
          })),
          total,
          tip: tipAmount,
          notes,
          paymentMethod,
        })
      }
      setTimeout(() => {
        clearCart()
      }, 500)
    }, 1500)
  }

  const t = (key: string): string => {
    if (language === 'sw') {
      if (key === 'title') return 'Agizo Lako'
      if (key === 'empty') return 'Tafadhali ongeza vyakula kwenye agizo lako'
      if (key === 'subtotal') return 'Jumla Ndogo'
      if (key === 'service') return 'Huduma (5%)'
      if (key === 'tip') return 'Bakshishi'
      if (key === 'custom') return 'Binafsi'
      if (key === 'total') return 'Jumla'
      if (key === 'notes') return 'Maelezo ya jumla'
      if (key === 'notes-placeholder') return 'Maelezo yoyote ya ziada?'
      if (key === 'mpesa') return 'Lipa Sasa'
      if (key === 'cash') return 'Lipia Baadaye'
      if (key === 'place') return 'Weka Agizo'
      if (key === 'placing') return 'Inaweka agizo...'
      if (key === 'success') return 'Agizo Limepokelewa!'
      if (key === 'special') return 'Maagizo maalum:'
      return key
    }
    if (language === 'ar') {
      if (key === 'title') return 'طلبك'
      if (key === 'empty') return 'الرجاء إضافة أطباق إلى طلبك'
      if (key === 'subtotal') return 'المجموع الفرعي'
      if (key === 'service') return 'الخدمة (5%)'
      if (key === 'tip') return 'الإكرامية'
      if (key === 'custom') return 'مخصص'
      if (key === 'total') return 'المجموع'
      if (key === 'notes') return 'ملاحظات عامة'
      if (key === 'notes-placeholder') return 'أي ملاحظات إضافية؟'
      if (key === 'mpesa') return 'ادفع الآن'
      if (key === 'cash') return 'ادفع لاحقًا'
      if (key === 'place') return 'تقديم الطلب'
      if (key === 'placing') return 'جاري تقديم الطلب...'
      if (key === 'success') return 'تم استلام الطلب!'
      if (key === 'special') return 'تعليمات خاصة:'
      return key
    }
    if (key === 'title') return 'Your Order'
    if (key === 'empty') return 'Please add some dishes to your order'
    if (key === 'subtotal') return 'Subtotal'
    if (key === 'service') return 'Service (5%)'
    if (key === 'tip') return 'Tip'
    if (key === 'custom') return 'Custom'
    if (key === 'total') return 'Total'
    if (key === 'notes') return 'Order notes'
    if (key === 'notes-placeholder') return 'Any additional notes?'
    if (key === 'mpesa') return 'Pay Now'
    if (key === 'cash') return 'Pay Later'
    if (key === 'place') return 'Place Order'
    if (key === 'placing') return 'Placing order...'
    if (key === 'success') return 'Order Received!'
    if (key === 'special') return 'Special instructions:'
    return key
  }

  if (placed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center px-6 py-20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success"
        >
          <Check className="h-10 w-10 text-white" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-heading text-2xl font-bold text-text-primary"
        >
          {t('success')} 🎉
        </motion.h2>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <Sparkles className="h-8 w-8 text-accent animate-float" />
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-light">
      <div className="sticky top-0 z-10 bg-white shadow-soft">
        <div className="flex items-center gap-3 px-4 py-3">
          {onBack && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}>
              <ArrowLeft className="h-5 w-5 text-text-primary" />
            </motion.button>
          )}
          <h1 className="font-heading text-lg font-bold text-text-primary">{t('title')}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20">
            <ShoppingBag className="mb-4 h-16 w-16 text-text-secondary/30" />
            <p className="font-body text-sm text-text-secondary/60">{t('empty')}</p>
          </div>
        ) : (
          <div className="px-4 pt-4 pb-32">
            <div className="space-y-3">
              {cart.map((entry, index) => (
                <motion.div
                  key={entry.item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative flex gap-3 rounded-2xl bg-white p-3 shadow-soft"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 text-2xl">
                    {categoryEmojis[entry.item.categoryId] || '🍽️'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-body text-sm font-semibold text-text-primary">{entry.item.name}</h3>
                    <p className="font-accent text-sm font-bold text-secondary">{formatKES(entry.item.price)}</p>
                    {entry.specialInstructions && (
                      <p className="mt-0.5 text-[11px] text-text-secondary/70">
                        {t('special')} {entry.specialInstructions}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => updateCartQuantity(entry.item.id, entry.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-text-secondary transition-colors hover:text-secondary"
                        >
                          <Minus className="h-3 w-3" />
                        </motion.button>
                        <motion.span
                          key={entry.quantity}
                          initial={{ scale: 1.2 }}
                          animate={{ scale: 1 }}
                          className="min-w-[18px] text-center font-accent text-sm font-bold"
                        >
                          {entry.quantity}
                        </motion.span>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => updateCartQuantity(entry.item.id, entry.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-text-secondary transition-colors hover:text-secondary"
                        >
                          <Plus className="h-3 w-3" />
                        </motion.button>
                      </div>
                      <span className="font-accent text-sm font-bold text-text-primary">
                        {formatKES(entry.item.price * entry.quantity)}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => removeFromCart(entry.item.id)}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-text-secondary/60 transition-colors hover:bg-red-100 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </motion.button>
                </motion.div>
              ))}
            </div>

            <div className="mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notes-placeholder')}
                rows={2}
                className="w-full resize-none rounded-xl border-2 border-gray-200 bg-white p-3 font-body text-sm text-text-primary placeholder:text-text-secondary/50 transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>

            <div className="mt-4">
              <h3 className="mb-2 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">{t('tip')}</h3>
              <div className="flex gap-2">
                {tips.map((pct) => (
                  <motion.button
                    key={pct}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTipPercent(pct)}
                    className={`flex-1 rounded-xl py-2.5 text-center text-sm font-medium transition-all ${
                      tipPercent === pct
                        ? 'bg-secondary text-white'
                        : 'bg-white text-text-secondary shadow-soft'
                    }`}
                  >
                    {pct}%
                  </motion.button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTipPercent('custom')}
                  className={`flex-1 rounded-xl py-2.5 text-center text-sm font-medium transition-all ${
                    tipPercent === 'custom'
                      ? 'bg-secondary text-white'
                      : 'bg-white text-text-secondary shadow-soft'
                  }`}
                >
                  {t('custom')}
                </motion.button>
              </div>
              {tipPercent === 'custom' && (
                <input
                  type="number"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="KES"
                  className="mt-2 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 font-body text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                />
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 shadow-soft">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{t('subtotal')}</span>
                  <span className="font-accent font-medium">{formatKES(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{t('service')}</span>
                  <span className="font-accent font-medium">{formatKES(serviceFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{t('tip')}</span>
                  <span className="font-accent font-medium">{formatKES(tipAmount)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between">
                    <span className="font-accent font-bold text-text-primary">{t('total')}</span>
                    <span className="font-heading text-lg font-bold text-secondary">{formatKES(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 font-accent text-xs font-semibold uppercase tracking-wider text-text-secondary">Payment</h3>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPaymentMethod('mpesa')}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all ${
                    paymentMethod === 'mpesa'
                      ? 'bg-secondary text-white shadow-warm'
                      : 'bg-white text-text-secondary shadow-soft'
                  }`}
                >
                  <Smartphone className={`h-8 w-8 ${paymentMethod === 'mpesa' ? 'text-white' : 'text-secondary'}`} />
                  <span className="font-accent text-sm font-bold">M-Pesa</span>
                  <span className="text-[11px] opacity-70">{t('mpesa')}</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-secondary text-white shadow-warm'
                      : 'bg-white text-text-secondary shadow-soft'
                  }`}
                >
                  <Banknote className={`h-8 w-8 ${paymentMethod === 'cash' ? 'text-white' : 'text-green-500'}`} />
                  <span className="font-accent text-sm font-bold">{t('cash')}</span>
                  <span className="text-[11px] opacity-70">Cash</span>
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-3 shadow-soft">
          <Button
            fullWidth
            size="lg"
            variant="primary"
            loading={placing}
            disabled={!paymentMethod || placing}
            onClick={handlePlaceOrder}
          >
            {placing ? t('placing') : `${t('place')} • ${formatKES(total)}`}
          </Button>
        </div>
      )}
    </div>
  )
}
