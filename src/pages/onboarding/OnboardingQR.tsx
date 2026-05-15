import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

const qrStyles = [
  { id: 0, name: 'Classic', emoji: '⬛' },
  { id: 1, name: 'Rounded', emoji: '🔵' },
  { id: 2, name: 'Gradient', emoji: '🌈' },
  { id: 3, name: 'Minimal', emoji: '◻️' },
]

export default function OnboardingQR() {
  const { onboarding, updateOnboarding, nextStep, prevStep } = useStore()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">QR Codes</h1>
          <p className="text-text-secondary dark:text-white/50 mt-1">Generate QR codes for your tables</p>
        </div>

        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 border border-gray-100 dark:border-white/5 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={`flex-1 h-1.5 rounded-full ${step <= 5 ? 'bg-secondary' : step < 5 ? 'bg-success' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </div>

          <div className="bg-background-light dark:bg-primary rounded-2xl p-8 flex items-center justify-center">
            <div className="w-40 h-40 bg-white dark:bg-primary-light rounded-2xl flex items-center justify-center shadow-soft">
              <QrCode className="w-24 h-24 text-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary dark:text-white mb-3">QR Code Style</label>
            <div className="grid grid-cols-4 gap-2">
              {qrStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => updateOnboarding({ qrStyle: style.id })}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    onboarding.qrStyle === style.id
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-200 dark:border-white/20 hover:border-secondary'
                  }`}
                >
                  <div className="text-2xl mb-1">{style.emoji}</div>
                  <div className={`text-xs ${onboarding.qrStyle === style.id ? 'text-secondary font-semibold' : 'text-text-secondary'}`}>
                    {style.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-background-light dark:bg-primary rounded-xl p-4">
            <label className="block text-sm font-medium text-primary dark:text-white mb-2">Number of Tables</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateOnboarding({ tables: Math.max(1, onboarding.tables - 1) })}
                className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/20 flex items-center justify-center text-lg text-primary dark:text-white"
              >-</button>
              <span className="text-2xl font-heading font-bold text-primary dark:text-white w-12 text-center">{onboarding.tables}</span>
              <button
                onClick={() => updateOnboarding({ tables: Math.min(50, onboarding.tables + 1) })}
                className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/20 flex items-center justify-center text-lg text-primary dark:text-white"
              >+</button>
            </div>
            <p className="text-xs text-text-secondary dark:text-white/50 mt-1">Each table gets a unique QR code</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => { prevStep(); navigate('/onboarding/ai-setup') }}>
            Back
          </Button>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right"
            onClick={() => { nextStep(); navigate('/onboarding/marketing') }}>
            Next Step
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
