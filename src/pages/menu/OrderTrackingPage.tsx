'use client'

import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { OrderTracking } from '@/components/customer/OrderTracking'
import { EmptyState } from '@/components/ui/EmptyState'
import { PackageSearch } from 'lucide-react'

export function OrderTrackingPage() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const orders = useStore((s) => s.orders)
  const order = orders.find((o) => o.id === orderId)

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light">
        <EmptyState
          icon={<PackageSearch className="h-16 w-16" />}
          title="Order not found"
          description="We couldn't find this order. Please check the order ID."
          actionLabel="Back to Menu"
          onAction={() => navigate('/menu')}
        />
      </div>
    )
  }

  return (
    <OrderTracking
      order={order}
      onBack={() => navigate(-1)}
      onNeedHelp={() => {
        // Could open AI chat or show contact info
        alert('Contact us: +254712345678 or ask our staff for assistance.')
      }}
    />
  )
}
