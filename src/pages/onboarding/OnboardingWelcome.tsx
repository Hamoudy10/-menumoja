import { motion } from 'framer-motion'
import { ChefHat, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

export default function OnboardingWelcome() {
  const { nextStep } = useStore()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-6"
        >
          <ChefHat className="w-10 h-10 text-white" />
        </motion.div>

        <h1 className="text-3xl font-heading font-bold text-primary dark:text-white mb-4">
          Welcome to MenuMoja!
        </h1>
        <p className="text-text-secondary dark:text-white/60 mb-8 text-lg">
          Let's get your restaurant set up in just a few steps. You'll have your digital menu ready in no time.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { emoji: '📝', text: 'Set up profile' },
            { emoji: '🍕', text: 'Add menu items' },
            { emoji: '🎨', text: 'Customize look' },
            { emoji: '🤖', text: 'AI features' },
            { emoji: '📱', text: 'QR codes' },
            { emoji: '📢', text: 'Marketing' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.3 }}
              className="flex items-center gap-2 bg-white dark:bg-primary-light rounded-xl px-3 py-2.5 border border-gray-100 dark:border-white/5"
            >
              <span className="text-lg">{item.emoji}</span>
              <span className="text-sm text-primary dark:text-white">{item.text}</span>
            </motion.div>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          icon={<ArrowRight className="w-5 h-5" />}
          iconPosition="right"
          onClick={() => { nextStep(); navigate('/onboarding/profile') }}
        >
          Let's Get Started
        </Button>
      </motion.div>
    </div>
  )
}
