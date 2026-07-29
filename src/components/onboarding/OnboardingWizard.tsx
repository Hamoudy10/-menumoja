import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Store, Menu, Palette, Bot, QrCode, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Step1Welcome from './Step1Welcome'
import Step2Profile from './Step2Profile'
import Step3Menu from './Step3Menu'
import Step4Appearance from './Step4Appearance'
import Step5AISetup from './Step5AISetup'
import Step6QRGeneration from './Step6QRGeneration'

const steps = [
  { icon: ChefHat, label: 'Welcome' },
  { icon: Store, label: 'Profile' },
  { icon: Menu, label: 'Menu' },
  { icon: Palette, label: 'Appearance' },
  { icon: Bot, label: 'AI Setup' },
  { icon: QrCode, label: 'QR Code' },
]

const illustrations = [
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 600'%3E%3Crect width='400' height='600' fill='%230A1628'/%3E%3Ccircle cx='200' cy='220' r='80' fill='%23FF6B35' opacity='0.15'/%3E%3Ctext x='200' y='200' text-anchor='middle' fill='%23FFD700' font-size='60'%3E🍽️%3C/text%3E%3Ctext x='200' y='280' text-anchor='middle' fill='white' font-size='20' font-family='Arial'%3EMenuMoja%3C/text%3E%3Ctext x='200' y='320' text-anchor='middle' fill='%23FF6B35' font-size='14' font-family='Arial'%3EDigital Restaurant Platform%3C/text%3E%3Ctext x='200' y='360' text-anchor='middle' fill='%236B7280' font-size='12' font-family='Arial'%3EYour menu, one scan away%3C/text%3E%3C/svg%3E")`,
]

const stepComponents = [
  Step1Welcome,
  Step2Profile,
  Step3Menu,
  Step4Appearance,
  Step5AISetup,
  Step6QRGeneration,
]

export default function OnboardingWizard() {
  const { onboarding, nextStep, prevStep, resetOnboarding } = useStore()
  const [direction, setDirection] = useState(0)

  const handleNext = () => {
    setDirection(1)
    nextStep()
  }

  const handlePrev = () => {
    setDirection(-1)
    prevStep()
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onboarding.step])

  const CurrentStep = stepComponents[onboarding.step]

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  }

  return (
    <div className="min-h-screen bg-background-light">
      <div className="flex">
        <div className="flex-1 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <ChefHat className="w-5 h-5 text-white" />
                </div>
                <span className="font-heading text-xl font-bold text-primary">MenuMoja</span>
              </div>
              <button
                onClick={resetOnboarding}
                className="text-sm text-text-secondary hover:text-secondary transition-colors"
              >
                Start Over
              </button>
            </div>

            <div className="relative mb-12">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2" />
              <div
                className="absolute top-1/2 left-0 h-0.5 bg-secondary -translate-y-1/2 transition-all duration-500 ease-out"
                style={{ width: `${(onboarding.step / (steps.length - 1)) * 100}%` }}
              />
              <div className="relative flex justify-between">
                {steps.map((s, i) => {
                  const Icon = s.icon
                  const isActive = i <= onboarding.step
                  const isCurrent = i === onboarding.step
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <motion.div
                        animate={{
                          scale: isCurrent ? 1.15 : 1,
                          backgroundColor: isActive ? '#FF6B35' : '#E5E7EB',
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center relative z-10 transition-shadow ${
                          isCurrent ? 'shadow-warm' : ''
                        }`}
                      >
                        {isActive && i < onboarding.step ? (
                          <Check className="w-5 h-5 text-white" />
                        ) : (
                          <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        )}
                      </motion.div>
                      <span
                        className={`text-xs mt-2 font-accent font-medium ${
                          isActive ? 'text-secondary' : 'text-gray-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={onboarding.step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <CurrentStep onNext={handleNext} onPrev={handlePrev} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-[400px] min-h-screen sticky top-0">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{ backgroundImage: illustrations[0] }}
          >
            <div className="w-full h-full bg-primary/80 backdrop-blur-sm p-10 flex flex-col justify-between">
              <div>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-center"
                >
                  <div className="text-8xl mb-6">🍽️</div>
                  <h2 className="text-3xl font-heading text-white mb-3">
                    {steps[onboarding.step].label}
                  </h2>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Step {onboarding.step + 1} of {steps.length}
                  </p>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary/20 mx-auto mb-4 flex items-center justify-center">
                  <ChefHat className="w-8 h-8 text-secondary" />
                </div>
                <p className="text-gray-400 text-xs leading-relaxed">
                  MenuMoja helps you create a stunning digital presence for your restaurant
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
