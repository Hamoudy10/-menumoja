import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, UtensilsCrossed, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

export default function OnboardingMenu() {
  const { categories, nextStep, prevStep } = useStore()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">Your Menu</h1>
          <p className="text-text-secondary dark:text-white/50 mt-1">We've added some sample items to get you started</p>
        </div>

        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 border border-gray-100 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={`flex-1 h-1.5 rounded-full ${step <= 2 ? 'bg-secondary' : step < 2 ? 'bg-success' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </div>

          {categories.map((cat) => (
            <div key={cat.id} className="bg-background-light dark:bg-primary rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-primary dark:text-white">{cat.name}</span>
                <span className="text-xs text-text-secondary dark:text-white/50">{cat.items.length} items</span>
              </div>
              <div className="space-y-1.5">
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary dark:text-white/70">{item.name}</span>
                    <span className="text-secondary font-medium">KES {item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button className="flex items-center gap-2 text-sm text-secondary hover:text-secondary-dark transition-colors w-full justify-center py-2">
            <Plus className="w-4 h-4" /> Add More Items
          </button>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => { prevStep(); navigate('/onboarding/profile') }}>
            Back
          </Button>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right"
            onClick={() => { nextStep(); navigate('/onboarding/appearance') }}>
            Next Step
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
