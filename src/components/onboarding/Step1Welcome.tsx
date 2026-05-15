import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChefHat, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'

const fullText = "Habari! I am Chef AI 🧑‍🍳 I will help you set up your restaurant in minutes. Let us start — what is your restaurant's name?"

interface Props {
  onNext: () => void
  onPrev: () => void
}

export default function Step1Welcome({ onNext }: Props) {
  const { onboarding, updateOnboarding } = useStore()
  const [displayedText, setDisplayedText] = useState('')
  const [isTypingDone, setIsTypingDone] = useState(false)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    let i = 0
    setDisplayedText('')
    setIsTypingDone(false)
    setShowInput(false)
    const interval = setInterval(() => {
      setDisplayedText(fullText.slice(0, i + 1))
      i++
      if (i >= fullText.length) {
        clearInterval(interval)
        setIsTypingDone(true)
        setTimeout(() => setShowInput(true), 500)
      }
    }, 35)
    return () => clearInterval(interval)
  }, [])

  const handleContinue = () => {
    if (onboarding.restaurantName.trim()) {
      onNext()
    }
  }

  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative mb-8"
      >
        <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center shadow-warm">
          <ChefHat className="w-14 h-14 text-white" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="absolute -top-2 -right-2 text-3xl"
        >
          🧑‍🍳
        </motion.div>
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="absolute -bottom-1 -left-1"
        >
          <Sparkles className="w-5 h-5 text-accent" />
        </motion.div>
      </motion.div>

      <Card padding="lg" className="max-w-xl w-full text-center mb-8">
        <div className="relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -left-2 top-0 text-4xl text-secondary/20"
          >
            "
          </motion.div>
          <p className="text-lg leading-relaxed font-medium min-h-[80px]">
            {displayedText}
            {!isTypingDone && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-0.5 h-5 bg-secondary ml-1 align-middle"
              />
            )}
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -right-2 bottom-0 text-4xl text-secondary/20"
          >
            "
          </motion.div>
        </div>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={showInput ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl space-y-6"
      >
        <div className="relative">
          <input
            type="text"
            value={onboarding.restaurantName}
            onChange={(e) => updateOnboarding({ restaurantName: e.target.value })}
            placeholder="e.g., Bahari Restaurant"
            className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-200 bg-white focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            autoFocus
          />
          {onboarding.restaurantName && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <Sparkles className="w-5 h-5 text-secondary" />
            </motion.div>
          )}
        </div>

        <motion.div
          initial={false}
          animate={{
            height: onboarding.restaurantName.trim() ? 'auto' : 0,
            opacity: onboarding.restaurantName.trim() ? 1 : 0,
          }}
          className="overflow-hidden"
        >
          <Button
            onClick={handleContinue}
            size="lg"
            fullWidth
            icon={<ArrowRight className="w-5 h-5" />}
            iconPosition="right"
          >
            Let's Go! 🚀
          </Button>
        </motion.div>

        {onboarding.restaurantName.trim() && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-text-secondary"
          >
            Great choice! "{onboarding.restaurantName}" — I love it! ✨
          </motion.p>
        )}
      </motion.div>
    </div>
  )
}
