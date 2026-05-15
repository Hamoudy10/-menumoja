import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Check, Image, MessageSquare, MessageCircle, Globe } from 'lucide-react'
const Instagram = Image
const Facebook = MessageSquare
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

const platforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'from-pink-500 to-purple-500' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'from-blue-500 to-blue-700' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'from-green-500 to-emerald-500' },
  { id: 'tiktok', label: 'TikTok', icon: Globe, color: 'from-gray-800 to-gray-600' },
]

export default function OnboardingMarketing() {
  const { nextStep, prevStep, resetOnboarding } = useStore()
  const navigate = useNavigate()
  const [connected, setConnected] = useState<string[]>([])

  const togglePlatform = (id: string) => {
    setConnected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleFinish = () => {
    resetOnboarding()
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">Connect Platforms</h1>
          <p className="text-text-secondary dark:text-white/50 mt-1">Link your social media accounts</p>
        </div>

        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 border border-gray-100 dark:border-white/5 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={`flex-1 h-1.5 rounded-full ${step <= 6 ? 'bg-secondary' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </div>

          <p className="text-sm text-text-secondary dark:text-white/60">
            Connect your social media to enable AI-powered posting and analytics.
          </p>

          <div className="space-y-3">
            {platforms.map((platform) => {
              const Icon = platform.icon
              const isConnected = connected.includes(platform.id)
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isConnected
                      ? 'border-secondary bg-secondary/5'
                      : 'border-gray-200 dark:border-white/20 hover:border-secondary/50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center`}>
                    <Icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-left text-primary dark:text-white">{platform.label}</span>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isConnected ? 'bg-secondary border-secondary' : 'border-gray-300 dark:border-white/30'
                  }`}>
                    {isConnected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="bg-gradient-to-br from-success/10 to-emerald-400/5 rounded-xl p-4 text-center">
            <Check className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="text-sm font-medium text-primary dark:text-white">You're all set!</p>
            <p className="text-xs text-text-secondary dark:text-white/60 mt-1">
              Your MenuMoja dashboard is ready. Start managing your restaurant digitally.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => { prevStep(); navigate('/onboarding/qr') }}>
            Back
          </Button>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right" onClick={handleFinish}>
            Go to Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
