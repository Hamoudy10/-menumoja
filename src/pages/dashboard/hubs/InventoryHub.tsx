import { ChefHat, Package } from 'lucide-react'
import DashboardHub from './DashboardHub'
import InventoryPage from '../InventoryPage'
import RecipesPage from '../RecipesPage'

export default function InventoryHub() {
  return (
    <DashboardHub
      defaultTab="stock"
      tabs={[
        { id: 'stock', label: 'Stock', icon: Package, render: () => <InventoryPage /> },
        { id: 'recipes', label: 'Recipes & Costing', icon: ChefHat, render: () => <RecipesPage /> },
      ]}
    />
  )
}
