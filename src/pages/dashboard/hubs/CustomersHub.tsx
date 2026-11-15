import { Gift, MessageCircle, Users } from 'lucide-react'
import DashboardHub from './DashboardHub'
import CustomersPage from '../CustomersPage'
import LoyaltyPage from '../LoyaltyPage'
import WhatsAppPage from '../WhatsAppPage'

export default function CustomersHub() {
  return (
    <DashboardHub
      defaultTab="customers"
      tabs={[
        { id: 'customers', label: 'Customers', icon: Users, render: () => <CustomersPage /> },
        { id: 'loyalty', label: 'Loyalty', icon: Gift, render: () => <LoyaltyPage /> },
        { id: 'campaigns', label: 'Campaigns', icon: MessageCircle, render: () => <WhatsAppPage /> },
      ]}
    />
  )
}
