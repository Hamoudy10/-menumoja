import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

export interface HubTab {
  id: string
  label: string
  icon: LucideIcon
  render: () => ReactNode
  hidden?: boolean
}

/**
 * Shared sub-tab shell for the consolidated dashboard sections.
 * The URL stays deep-linkable via ?tab=..., while the sidebar only shows the
 * hub. Existing page components are reused unchanged.
 */
export default function DashboardHub({ tabs, defaultTab }: { tabs: HubTab[]; defaultTab?: string }) {
  const [params, setParams] = useSearchParams()
  const visible = tabs.filter((tab) => !tab.hidden)
  const requested = params.get('tab')
  const active =
    visible.find((tab) => tab.id === requested) ||
    visible.find((tab) => tab.id === defaultTab) ||
    visible[0]

  if (!active) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 dark:border-white/10 dark:bg-primary-light">
        {visible.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === active.id
          return (
            <button
              key={tab.id}
              onClick={() => setParams({ tab: tab.id })}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 font-accent text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-secondary text-white'
                  : 'text-text-secondary hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div>{active.render()}</div>
    </div>
  )
}
