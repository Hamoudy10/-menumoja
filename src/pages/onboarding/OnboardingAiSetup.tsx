import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Sparkles, Bot } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

export default function OnboardingAiSetup() {
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
          <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">AI Features</h1>
          <p className="text-text-secondary dark:text-white/50 mt-1">Let AI help you market your restaurant</p>
        </div>

        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 border border-gray-100 dark:border-white/5 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={`flex-1 h-1.5 rounded-full ${step <= 4 ? 'bg-secondary' : step < 4 ? 'bg-success' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </div>

          <div className="bg-gradient-to-br from-secondary/10 to-accent/5 rounded-2xl p-5 text-center">
            <Sparkles className="w-10 h-10 text-secondary mx-auto mb-3" />
            <h3 className="text-lg font-heading font-bold text-primary dark:text-white mb-2">AI-Powered Marketing</h3>
            <p className="text-sm text-text-secondary dark:text-white/60 mb-4">
              Automatically generate social media posts, promotions, and insights based on your menu and sales data.
            </p>
            <Toggle
              checked={onboarding.aiMarketing}
              onChange={(val) => updateOnboarding({ aiMarketing: val })}
              label="Enable AI Marketing"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-primary dark:text-white">AI can help you with:</h4>
            {[
              'Auto-generated social media posts',
              'Smart menu item recommendations',
              'Customer sentiment analysis',
              'Automated promotions & discounts',
              'Peak hour predictions',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-text-secondary dark:text-white/70">
                <Bot className="w-4 h-4 text-secondary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => { prevStep(); navigate('/onboarding/appearance') }}>
            Back
          </Button>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right"
            onClick={() => { nextStep(); navigate('/onboarding/qr') }}>
            Next Step
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
