import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Particles } from './Particles'
import { useNavigate } from 'react-router-dom'

const headline = "The Smartest Menu Your Restaurant Will Ever Have".split(' ')

const phoneMenuItems = [
  { name: 'Biriani Special', price: '850' },
  { name: 'Tandoori Mix', price: '1,200' },
  { name: 'Fresh Mango Juice', price: '350' },
  { name: 'Samaki wa Kukaanga', price: '1,500' },
]

export function Hero() {
  const navigate = useNavigate()
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background-dark">
      <motion.div
        animate={{
          background: [
            'linear-gradient(135deg, #0A1628 0%, #1a0a3e 25%, #0d1b2a 50%, #1a0a3e 75%, #0A1628 100%)',
            'linear-gradient(135deg, #0A1628 0%, #2d1b4e 25%, #0d1b2a 50%, #2d1b4e 75%, #0A1628 100%)',
            'linear-gradient(135deg, #0A1628 0%, #1a0a3e 25%, #0d1b2a 50%, #1a0a3e 75%, #0A1628 100%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0"
      />

      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(255,107,53,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,215,0,0.2) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(26,10,62,0.4) 0%, transparent 50%)',
        }}
      />

      <Particles />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-white/80 text-xs sm:text-sm mb-6 sm:mb-8"
            >
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span>Trusted by 247+ restaurants in Mombasa 🇰🇪</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-[1.1] max-w-4xl">
              {headline.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.07, duration: 0.5, ease: 'easeOut' }}
                  className="inline-block mr-[0.3em]"
                >
                  <span className={i >= 4 ? 'text-gradient' : 'text-white'}>{word}</span>
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="text-base sm:text-lg lg:text-xl text-white/50 max-w-2xl mb-8 sm:mb-10 font-body leading-relaxed"
            >
              From the shores of Mombasa to the world — transform your restaurant with QR digital menus, AI-powered ordering, M-Pesa payments, and smart business analytics. All in one powerful platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Button size="lg" className="animate-pulse-glow w-full sm:w-auto text-center" onClick={() => navigate('/signup')}>
                Start Free Today
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => navigate('/demo')}>
                <Play className="w-5 h-5" />
                Watch Demo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.6 }}
              className="flex items-center gap-4 sm:gap-6 mt-8 text-white/40 text-xs sm:text-sm"
            >
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-success rounded-full" />
                No credit card
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-secondary rounded-full" />
                Free setup
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                Cancel anytime
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.8, ease: 'easeOut' }}
            className="flex-1 flex justify-center lg:justify-end"
          >
            <div className="relative animate-float">
              <div className="relative rounded-[2.5rem] border-[3px] border-gray-700/60 bg-gray-900 p-3 shadow-2xl shadow-secondary/10 w-[280px] sm:w-[320px]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-800 rounded-b-xl z-10" />
                <div className="bg-white rounded-[1.5rem] overflow-hidden">
                  <div className="bg-gradient-to-br from-secondary/90 to-accent/90 p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-white rounded-full" />
                      <span className="text-white/90 text-[10px] sm:text-xs font-accent font-semibold tracking-wide">MENUMOJA</span>
                    </div>
                    <h3 className="text-white font-bold text-base sm:text-lg font-heading leading-tight">Ocean View Restaurant</h3>
                    <p className="text-white/70 text-[10px] sm:text-xs mb-3 font-body">Swahili & Seafood · Nyali, Mombasa</p>
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-accent text-[10px]">★</span>
                      ))}
                    </div>
                    <div className="border-t border-white/20 pt-2 space-y-1.5">
                      {phoneMenuItems.map((item) => (
                        <div key={item.name} className="flex items-center justify-between py-1">
                          <span className="text-white text-[11px] sm:text-sm font-body">{item.name}</span>
                          <span className="text-accent font-bold text-[11px] sm:text-sm">KES {item.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between">
                      <span className="text-white/60 text-[10px]">Scan to order</span>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-white/20 rounded" />
                        <span className="text-white/60 text-[10px]">M-Pesa</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 w-full h-full rounded-[2.5rem] border border-secondary/20 -z-10" />
              <div className="absolute -bottom-4 -right-4 w-full h-full rounded-[2.5rem] border border-accent/10 -z-20" />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full leading-none z-10">
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="w-full h-[60px] sm:h-[80px] lg:h-[100px]">
          <path
            d="M0,50 C240,100 480,0 720,50 C960,100 1200,0 1440,50 L1440,100 L0,100 Z"
            fill="#FAFAF7"
            opacity="0.03"
          />
          <path
            d="M0,30 C180,70 360,10 540,30 C720,50 900,10 1080,30 C1260,50 1440,10 1440,30 L1440,100 L0,100 Z"
            fill="#FAFAF7"
            opacity="0.06"
          />
          <path
            d="M0,60 C240,90 480,30 720,60 C960,90 1200,30 1440,60 L1440,100 L0,100 Z"
            fill="#FAFAF7"
            opacity="0.08"
          />
          <path d="M0,80 L1440,80 L1440,100 L0,100 Z" fill="#FAFAF7" />
        </svg>
      </div>
    </section>
  )
}
