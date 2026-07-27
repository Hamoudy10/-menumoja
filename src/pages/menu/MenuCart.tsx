import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ShoppingCart, Trash2, Minus, Plus, ArrowLeft, Smartphone, Banknote, Loader2, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { showSuccessToast } from '@/components/ui/Toast'

export default function MenuCart() {
  const { restaurantSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tableFromUrl = searchParams.get('table')
  const [placing, setPlacing] = useState(false)
  const [showPaymentChoice, setShowPaymentChoice] = useState(false)
  const [showMpesaInput, setShowMpesaInput] = useState(false)
  const [mpesaPhone, setMpesaPhone] = useState('')
  const { cart, removeFromCart, updateCartQuantity, clearCart, placeOrder } = useStore()

  const total = cart.reduce((s, i) => s + i.item.price * i.quantity, 0)

  const submitOrder = async (method: 'mpesa' | 'cash') => {
    if (cart.length === 0 || placing) return
    setPlacing(true)
    try {
      const order = await placeOrder({
        restaurantSlug,
        tableNumber: tableFromUrl ? parseInt(tableFromUrl) : 0,
        items: cart.map(c => ({
          menuItemId: c.item.id,
          name: c.item.name,
          quantity: c.quantity,
          price: c.item.price,
          specialInstructions: c.specialInstructions || '',
        })),
        total,
        paymentMethod: method,
        customerPhone: method === 'mpesa' ? mpesaPhone : undefined,
        specialInstructions: '',
      })
      clearCart()
      sessionStorage.setItem(`activeOrder_${restaurantSlug}`, JSON.stringify({ id: order.id, orderNumber: order.orderNumber, tableNumber: tableFromUrl ? parseInt(tableFromUrl) : 0, time: Date.now() }))
      showSuccessToast('Order placed!')
      navigate(`/menu/${restaurantSlug}/order/${order.id}`)
    } catch {
      // error toast handled in store
    } finally {
      setPlacing(false)
      setShowPaymentChoice(false)
      setShowMpesaInput(false)
    }
  }

  const handlePlaceOrderClick = () => {
    if (cart.length === 0) return
    setShowPaymentChoice(true)
  }

  return (
    <div className="min-h-screen bg-background-light">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-soft">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/menu/${restaurantSlug}`)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="font-heading font-bold text-primary text-lg">Your Cart</h1>
          <span className="text-xs text-text-secondary ml-auto">{cart.length} items</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {cart.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-16 h-16 text-text-secondary/30 mx-auto mb-4" />
            <h2 className="text-lg font-heading font-bold text-primary mb-2">Cart is empty</h2>
            <p className="text-sm text-text-secondary mb-6">Add some items from the menu to get started</p>
            <Button variant="primary" onClick={() => navigate(`/menu/${restaurantSlug}`)}>
              Browse Menu
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {cart.map((cartItem) => (
                <motion.div
                  key={cartItem.item.id}
                  layout
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-primary text-sm">{cartItem.item.name}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">KES {cartItem.item.price} each</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(cartItem.item.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQuantity(cartItem.item.id, cartItem.quantity - 1)}
                        className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-primary hover:bg-gray-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold text-primary">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(cartItem.item.id, cartItem.quantity + 1)}
                        className="w-8 h-8 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="font-semibold text-secondary">KES {cartItem.item.price * cartItem.quantity}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Subtotal</span>
                <span className="font-medium text-primary">KES {total.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Service Fee</span>
                <span className="font-medium text-primary">KES 0</span>
              </div>
              <div className="flex items-center justify-between text-base pt-3 border-t border-gray-100">
                <span className="font-semibold text-primary">Total</span>
                <span className="font-bold text-secondary text-lg">KES {total.toLocaleString()}</span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={placing}
              loading={placing}
              onClick={handlePlaceOrderClick}
            >
              {placing ? 'Placing Order...' : 'Place Order'}
            </Button>
          </>
        )}
      </main>

      <AnimatePresence>
        {showPaymentChoice && !showMpesaInput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowPaymentChoice(false)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-heading font-bold text-primary">How to pay?</h2>
                <button onClick={() => setShowPaymentChoice(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-text-secondary" /></button>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setShowMpesaInput(true) }} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-secondary hover:bg-secondary/5 transition-colors text-left">
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0"><Smartphone className="w-6 h-6 text-secondary" /></div>
                  <div><p className="font-semibold text-primary">Pay now with M-Pesa</p><p className="text-xs text-text-secondary mt-0.5">Instant payment via M-Pesa STK push</p></div>
                </button>
                <button onClick={() => submitOrder('cash')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-secondary hover:bg-secondary/5 transition-colors text-left">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Banknote className="w-6 h-6 text-amber-600" /></div>
                  <div><p className="font-semibold text-primary">Pay later with Cash</p><p className="text-xs text-text-secondary mt-0.5">Pay at the restaurant after receiving your order</p></div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showMpesaInput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-heading font-bold text-primary">M-Pesa Payment</h2>
                <button onClick={() => { setShowMpesaInput(false); setShowPaymentChoice(true) }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-text-secondary" /></button>
              </div>
              <p className="text-sm text-text-secondary mb-4">Enter your M-Pesa phone number to receive the payment request.</p>
              <Input label="Phone Number" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="+2547XX XXX XXX" type="tel" />
              <div className="flex gap-3 mt-4">
                <Button variant="outline" fullWidth onClick={() => { setShowMpesaInput(false); setShowPaymentChoice(true) }}>Back</Button>
                <Button variant="primary" fullWidth disabled={!mpesaPhone || placing} loading={placing} onClick={() => submitOrder('mpesa')}>
                  Pay KES {total.toLocaleString()}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
