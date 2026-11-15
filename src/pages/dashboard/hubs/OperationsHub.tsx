import { CalendarDays, Camera, ShoppingCart, Table2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import DashboardHub from './DashboardHub'
import OrdersPage from '../OrdersPage'
import TablesPage from '../TablesPage'
import ReservationsPage from '../ReservationsPage'
import SurveillancePage from '../SurveillancePage'

export default function OperationsHub() {
  const { restaurant } = useStore()
  const plan = restaurant?.plan as any
  const hasSurveillance = Boolean(plan && typeof plan === 'object' && plan.hasSurveillance === true)

  return (
    <DashboardHub
      defaultTab="orders"
      tabs={[
        { id: 'orders', label: 'Orders', icon: ShoppingCart, render: () => <OrdersPage /> },
        { id: 'tables', label: 'Tables', icon: Table2, render: () => <TablesPage /> },
        { id: 'reservations', label: 'Reservations', icon: CalendarDays, render: () => <ReservationsPage /> },
        {
          id: 'cameras',
          label: 'Cameras',
          icon: Camera,
          render: () => <SurveillancePage />,
          hidden: !hasSurveillance,
        },
      ]}
    />
  )
}
