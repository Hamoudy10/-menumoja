import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { CartPage as CartComponent } from '@/components/customer/CartPage'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'

export function CartPage() {
  const navigate = useNavigate()
  const { placeOrder, cart, clearCart, restaurant, customer } = useStore()

  const handlePlaceOrder = async (orderData: {
    items: any[]
    total: number
    tip: number
    notes: string
    paymentMethod: 'mpesa' | 'cash' | 'card'
  }) => {
    try {
      await placeOrder({
        restaurantSlug: restaurant?.slug,
        tableNumber: 0,
        items: orderData.items.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price,
          specialInstructions: item.specialInstructions || '',
        })),
        total: orderData.total,
        paymentMethod: orderData.paymentMethod,
        specialInstructions: orderData.notes,
      })
      clearCart()
      showSuccessToast(
        `Order placed successfully! ${orderData.paymentMethod === 'mpesa' ? 'Check your phone for M-Pesa prompt.' : 'Pay when ready.'}`
      )
      setTimeout(() => {
        navigate(`order/${Date.now().toString(36)}`)
      }, 1000)
    } catch {
      showErrorToast('Failed to place order')
    }
  }

  return (
    <CartComponent
      onBack={() => navigate(-1)}
      onPlaceOrder={handlePlaceOrder}
    />
  )
}
