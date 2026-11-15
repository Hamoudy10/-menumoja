import { BarChart3, PieChart } from 'lucide-react'
import DashboardHub from './DashboardHub'
import AnalyticsPage from '../AnalyticsPage'
import ProfitabilityPage from '../ProfitabilityPage'

export default function InsightsHub() {
  return (
    <DashboardHub
      defaultTab="analytics"
      tabs={[
        { id: 'analytics', label: 'Analytics', icon: BarChart3, render: () => <AnalyticsPage /> },
        { id: 'profitability', label: 'Profitability', icon: PieChart, render: () => <ProfitabilityPage /> },
      ]}
    />
  )
}
