import { useState } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, Minus, Plus, ArrowLeft, CreditCard, Smartphone, Loader2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { showSuccessToast } from '@/components/ui/Toast'

export default function MenuCart() {
  const { restaurantSlug } = useParams()
  const navigate = useNavigate()
  const [placing, setPlacing] = useState(false)
  const { cart, removeFromCart, updateCartQuantity, clearCart, placeOrder } = useStore()

  const total = cart.reduce((s, i) => s + i.item.price * i.quantity, 0)

  const handlePlaceOrder = async (method: 'mpesa' | 'cash') => {
    if (cart.length === 0 || placing) return
    setPlacing(true)
    try {
      const order = await placeOrder({
        restaurantSlug,
        tableNumber: 0,
        items: cart.map(c => ({
          menuItemId: c.item.id,
          name: c.item.name,
          quantity: c.quantity,
          price: c.item.price,
          specialInstructions: c.specialInstructions || '',
        })),
        total,
        paymentMethod: method,
        specialInstructions: '',
      })
      clearCart()
      showSuccessToast('Order placed successfully!')
      navigate(`/menu/${restaurantSlug}/order/${order.id}`)
    } catch {
      // error toast handled in store
    } finally {
      setPlacing(false)
    }
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

            <div className="space-y-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={placing}
                loading={placing}
                icon={<Smartphone className="w-5 h-5" />}
                onClick={() => handlePlaceOrder('mpesa')}
              >
                {placing ? 'Placing Order...' : 'Pay with M-Pesa'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                disabled={placing}
                onClick={() => handlePlaceOrder('cash')}
                icon={<CreditCard className="w-5 h-5" />}
              >
                Pay with Cash
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
