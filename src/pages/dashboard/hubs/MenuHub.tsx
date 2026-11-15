import { Megaphone, UtensilsCrossed } from 'lucide-react'
import DashboardHub from './DashboardHub'
import MenuManager from '../MenuManager'
import PromotionsPage from '../PromotionsPage'

export default function MenuHub() {
  return (
    <DashboardHub
      defaultTab="menu"
      tabs={[
        { id: 'menu', label: 'Items', icon: UtensilsCrossed, render: () => <MenuManager /> },
        { id: 'promotions', label: 'Promotions', icon: Megaphone, render: () => <PromotionsPage /> },
      ]}
    />
  )
}
