import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Save, Copy, Eye, EyeOff, Key, Shield, RefreshCw,
  Globe, Mail, DollarSign, Wrench,
} from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { showSuccessToast } from '@/components/ui/Toast'

export default function AdminSettings() {
  const [platformName, setPlatformName] = useState('MenuMoja')
  const [starterPrice, setStarterPrice] = useState('15,000')
  const [businessPrice, setBusinessPrice] = useState('35,000')
  const [premiumPrice, setPremiumPrice] = useState('55,000')
  const [currency, setCurrency] = useState('KES')
  const [supportEmail, setSupportEmail] = useState('support@menumoja.com')
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [showAPIKey, setShowAPIKey] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<'general' | 'pricing' | 'api' | null>(null)
  const [regeneration, setRegeneration] = useState<string | null>(null)

  const apiKeys = [
    { id: 'pk_live', label: 'Publishable Key', key: 'pk_live_8H7sK2mN9qR4tW6xZ1cV3bG5', type: 'publishable' },
    { id: 'sk_live', label: 'Secret Key', key: 'sk_live_J4pL8yD2uF7aR0wQ5nM1kX9v', type: 'secret' },
    { id: 'webhook', label: 'Webhook Secret', key: 'whsec_eT3mB6zK8pL1xR5wN0qY4vC7', type: 'secret' },
  ]

  const handleSave = (section: 'general' | 'pricing' | 'api') => {
    setSaving(section)
    setTimeout(() => {
      setSaving(null)
      showSuccessToast(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved`)
    }, 800)
  }

  const handleRegenerateKey = (id: string) => {
    setRegeneration(id)
    setTimeout(() => {
      setRegeneration(null)
      showSuccessToast('API key regenerated')
    }, 1200)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    showSuccessToast('Copied to clipboard')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Platform Settings</h1>
        <p className="text-sm text-white/50">Manage global platform configuration</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-primary-light border border-white/5 rounded-2xl p-5 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
            <Globe className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white">General Settings</h3>
        </div>

        <Input
          label="Platform Name"
          value={platformName}
          onChange={e => setPlatformName(e.target.value)}
          containerClassName="max-w-sm"
        />

        <Input
          label="Support Email"
          type="email"
          value={supportEmail}
          onChange={e => setSupportEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          containerClassName="max-w-sm"
        />

        <div className="flex items-center gap-4 pt-2">
          <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} label="Maintenance Mode" />
          <span className="text-xs text-white/40">When enabled, only admins can access the platform</span>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Save className="w-4 h-4" />}
          loading={saving === 'general'}
          onClick={() => handleSave('general')}
        >
          Save General Settings
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-primary-light border border-white/5 rounded-2xl p-5 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-success to-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white">Default Plan Pricing</h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Input
            label="Starter Plan"
            value={starterPrice}
            onChange={e => setStarterPrice(e.target.value)}
            currency
            currencySymbol={currency}
          />
          <Input
            label="Business Plan"
            value={businessPrice}
            onChange={e => setBusinessPrice(e.target.value)}
            currency
            currencySymbol={currency}
          />
          <Input
            label="Premium Plan"
            value={premiumPrice}
            onChange={e => setPremiumPrice(e.target.value)}
            currency
            currencySymbol={currency}
          />
        </div>

        <Input
          label="Currency"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          icon={<DollarSign className="w-4 h-4" />}
          containerClassName="max-w-[120px]"
        />

        <Button
          variant="primary"
          size="sm"
          icon={<Save className="w-4 h-4" />}
          loading={saving === 'pricing'}
          onClick={() => handleSave('pricing')}
        >
          Save Pricing
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-primary-light border border-white/5 rounded-2xl p-5 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl grad-brand flex items-center justify-center">
            <Key className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white">API Keys</h3>
        </div>

        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="bg-primary rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className={`w-4 h-4 ${apiKey.type === 'secret' ? 'text-accent' : 'text-secondary'}`} />
                  <span className="text-sm font-medium text-white">{apiKey.label}</span>
                  <Badge variant={apiKey.type === 'secret' ? 'warning' : 'info'} size="sm">
                    {apiKey.type}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(apiKey.key)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowAPIKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                    title={showAPIKey[apiKey.id] ? 'Hide' : 'Show'}
                  >
                    {showAPIKey[apiKey.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleRegenerateKey(apiKey.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                    title="Regenerate"
                  >
                    {regeneration === apiKey.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-accent bg-white/5 rounded-lg px-3 py-2 text-white/60 font-mono truncate">
                  {showAPIKey[apiKey.id] ? apiKey.key : apiKey.key.slice(0, 12) + '••••••••••••' + apiKey.key.slice(-4)}
                </code>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Save className="w-4 h-4" />}
          loading={saving === 'api'}
          onClick={() => handleSave('api')}
        >
          Save API Settings
        </Button>
      </motion.div>
    </div>
  )
}

function Badge({ variant = 'default', size = 'sm', children, className = '' }: { variant?: string; size?: string; children: React.ReactNode; className?: string }) {
  const variants: Record<string, string> = {
    default: 'bg-gray-500/20 text-gray-400',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-amber-500/20 text-amber-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-accent ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  )
}
