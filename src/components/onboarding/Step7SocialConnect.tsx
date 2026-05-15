import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Smartphone, MessageCircle, Globe, Camera,
  Check, ChevronRight, ArrowLeft, ArrowRight,
  Loader2, Share2, Bot, Zap, SkipForward
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'

const FacebookIcon = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const InstagramIcon = ({ className = 'w-7 h-7' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)

const platforms = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: FacebookIcon,
    color: '#1877F2',
    bgColor: '#1877F210',
    description: 'Connect your Facebook page for automatic menu posts',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: InstagramIcon,
    color: '#E4405F',
    bgColor: '#E4405F10',
    description: 'Share menu updates and stories directly to Instagram',
  },
]

interface Props {
  onNext: () => void
  onPrev: () => void
}

export default function Step7SocialConnect({ onNext, onPrev }: Props) {
  const { onboarding, updateOnboarding } = useStore()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [aiEnabled, setAiEnabled] = useState(onboarding.aiMarketing)

  const social = onboarding.socialMedia || []
  const facebookConnected = social.find((s) => s.platform === 'facebook')?.connected || false
  const instagramConnected = social.find((s) => s.platform === 'instagram')?.connected || false
  const whatsappConnected = social.find((s) => s.platform === 'whatsapp')?.connected || false
  const tiktokConnected = social.find((s) => s.platform === 'tiktok')?.connected || false

  const getConnected = (id: string) => {
    switch (id) {
      case 'facebook': return facebookConnected
      case 'instagram': return instagramConnected
      case 'whatsapp': return whatsappConnected
      case 'tiktok': return tiktokConnected
      default: return false
    }
  }

  const handleConnect = (platformId: string) => {
    setConnecting(platformId)
    setTimeout(() => {
      const existing = social.filter((s) => s.platform !== platformId)
      updateOnboarding({
        socialMedia: [...existing, { platform: platformId, connected: true }],
      })
      setConnecting(null)
    }, 1500)
  }

  const handleDisconnect = (platformId: string) => {
    const updated = social.filter((s) => s.platform !== platformId)
    updateOnboarding({ socialMedia: updated })
  }

  const handleAiToggle = () => {
    const newVal = !aiEnabled
    setAiEnabled(newVal)
    updateOnboarding({ aiMarketing: newVal })
  }

  const connectedCount = social.filter((s) => s.connected).length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 rounded-full text-secondary text-sm font-accent font-semibold mb-3">
          <Share2 className="w-4 h-4" />
          Social & Marketing
        </div>
        <h2 className="text-2xl font-heading font-bold text-primary">Connect Your Channels</h2>
        <p className="text-text-secondary text-sm mt-1">
          Link your social media to auto-share menu updates and promotions
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {platforms.map((platform, i) => {
          const Icon = platform.icon
          const connected = getConnected(platform.id)
          const isConnecting = connecting === platform.id

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                padding="lg"
                className={`h-full transition-all ${
                  connected ? 'ring-2 ring-success/30' : ''
                }`}
                hover
                onClick={() => !connected && !isConnecting && handleConnect(platform.id)}
              >
                <div className="flex flex-col items-center text-center h-full">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: platform.bgColor, color: platform.color }}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-heading font-bold text-primary mb-1">{platform.name}</h3>
                  <p className="text-xs text-text-secondary mb-4 flex-1">{platform.description}</p>

                  {isConnecting ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium text-text-secondary">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full"
                      />
                      Connecting...
                    </div>
                  ) : connected ? (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <div className="flex items-center gap-1.5 text-success text-sm font-medium">
                        <Check className="w-4 h-4" />
                        Connected
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDisconnect(platform.id) }}
                        className="text-xs text-text-secondary hover:text-red-400 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-full px-4 py-2 rounded-xl font-accent font-semibold text-sm text-white transition-all"
                      style={{ backgroundColor: platform.color }}
                      onClick={(e) => { e.stopPropagation(); handleConnect(platform.id) }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Card padding="lg" className="mb-6 relative bg-card rounded-2xl">
        <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-secondary via-accent to-secondary pointer-events-none [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] [mask-composite:exclude]" />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center shrink-0">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-primary">AI Marketing Assistant</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Let AI create and schedule social media posts automatically based on your menu updates
            </p>
          </div>
          <button
            onClick={handleAiToggle}
            className={`relative w-14 h-7 rounded-full transition-all ${
              aiEnabled ? 'bg-secondary' : 'bg-gray-200'
            }`}
          >
            <motion.div
              animate={{ x: aiEnabled ? 28 : 2 }}
              className="w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-soft"
            />
          </button>
        </div>
        {aiEnabled && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 text-xs text-success flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            AI Marketing is active — posts will be created when you update your menu
          </motion.p>
        )}
      </Card>

      {connectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 rounded-full text-success text-sm font-medium">
            <Check className="w-4 h-4" />
            {connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected
          </span>
        </motion.div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onPrev} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
        >
          Complete Setup
        </Button>
        <Button
          variant="ghost"
          onClick={onNext}
          icon={<SkipForward className="w-4 h-4" />}
          iconPosition="right"
        >
          Skip
        </Button>
      </div>
    </div>
  )
}
