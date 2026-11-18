import { motion } from 'framer-motion'
import { Play, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

const headline = "The Smartest Menu Your Restaurant Will Ever Have"

export function Hero() {
  const navigate = useNavigate()
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background-dark">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#1a0a3e] to-[#0d1b2a]" />
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,107,53,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,215,0,0.25) 0%, transparent 50%)',
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-white/80 text-xs sm:text-sm mb-6 sm:mb-8"
        >
          <Sparkles className="w-4 h-4 text-accent" />
          <span>Built for restaurants in Kenya 🇰🇪</span>
        </motion.div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
          {headline.split(' ').map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
              className="inline-block mr-[0.25em]"
            >
              <span className={i >= 4 ? 'text-gradient' : 'text-white'}>{word}</span>
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="text-lg sm:text-xl lg:text-2xl text-white/60 max-w-3xl mx-auto mb-10 font-body leading-relaxed"
        >
          QR digital menus, AI-powered ordering, M-Pesa payments, reservations, and smart analytics — all in one platform built for Kenyan restaurants.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" className="animate-pulse-glow w-full sm:w-auto" onClick={() => navigate('/signup')}>
            Start Free Today <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => navigate('/demo')}>
            <Play className="w-5 h-5" /> Watch Demo
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.6 }}
          className="flex items-center justify-center gap-6 mt-10 text-white/40 text-sm"
        >
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-success rounded-full" /> No credit card</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-secondary rounded-full" /> Free setup</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-accent rounded-full" /> Cancel anytime</span>
        </motion.div>
      </div>
    </section>
  )
}