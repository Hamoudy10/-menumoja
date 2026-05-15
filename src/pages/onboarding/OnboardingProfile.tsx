import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Store, User, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

export default function OnboardingProfile() {
  const { onboarding, updateOnboarding, nextStep, prevStep } = useStore()
  const navigate = useNavigate()

  const handleNext = () => {
    nextStep()
    navigate('/onboarding/menu')
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">Restaurant Profile</h1>
          <p className="text-text-secondary dark:text-white/50 mt-1">Tell us about your restaurant</p>
        </div>

        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 border border-gray-100 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={`flex-1 h-1.5 rounded-full ${step === 1 ? 'bg-secondary' : step < 1 ? 'bg-success' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </div>

          <Input
            label="Restaurant Name"
            icon={<Store className="w-4 h-4" />}
            value={onboarding.restaurantName}
            onChange={e => updateOnboarding({ restaurantName: e.target.value })}
            placeholder="e.g., Bahari Restaurant"
          />
          <Input
            label="Owner Name"
            icon={<User className="w-4 h-4" />}
            value={onboarding.ownerName}
            onChange={e => updateOnboarding({ ownerName: e.target.value })}
            placeholder="Your full name"
          />
          <Input
            label="Email"
            type="email"
            icon={<Mail className="w-4 h-4" />}
            value={onboarding.email}
            onChange={e => updateOnboarding({ email: e.target.value })}
            placeholder="you@example.com"
          />
          <Input
            label="Phone"
            icon={<Phone className="w-4 h-4" />}
            value={onboarding.phone}
            onChange={e => updateOnboarding({ phone: e.target.value })}
            placeholder="+254 712 345 678"
          />
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => { prevStep(); navigate('/onboarding/welcome') }}>
            Back
          </Button>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right" onClick={handleNext}>
            Next Step
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
