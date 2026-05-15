import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Smartphone, Radio, Users, Camera, MessageCircle } from 'lucide-react'

interface CounterProps {
  end: number
  suffix?: string
  prefix?: string
  duration?: number
  label: string
}

function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000, label }: CounterProps) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 })
  const startedRef = useRef(false)

  useEffect(() => {
    if (!inView || startedRef.current) return
    startedRef.current = true
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * end))
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [inView, end, duration])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-white mb-1">
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-white/50 text-sm sm:text-base font-body">{label}</div>
    </motion.div>
  )
}

const integrations = [
  { name: 'M-Pesa', icon: Smartphone, color: 'text-green-400', bg: 'bg-green-500/10' },
  { name: 'Safaricom', icon: Radio, color: 'text-green-300', bg: 'bg-green-500/10' },
  { name: 'Facebook', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { name: 'Instagram', icon: Camera, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { name: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

const counters = [
  { end: 247, suffix: '+', label: 'Restaurants', duration: 2000 },
  { end: 50000, suffix: '+', label: 'Orders Processed', duration: 2500 },
  { end: 49, prefix: '', suffix: '★', label: 'Average Rating', duration: 1800 },
  { end: 2300000, prefix: 'KES ', suffix: '+', label: 'Payments Processed', duration: 3000 },
]

export function SocialProof() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24 bg-background-dark overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-primary/80 to-background-dark" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-heading text-white mb-3">
            Trusted by <span className="text-gradient">Mombasa</span>&apos;s Best Restaurants
          </h2>
          <p className="text-white/50 text-sm sm:text-base max-w-2xl mx-auto font-body">
            Join hundreds of restaurants already growing with MenuMoja
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12 mb-16 sm:mb-20">
          {counters.map((counter) => (
            <AnimatedCounter key={counter.label} {...counter} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-white/40 text-xs sm:text-sm mb-4 sm:mb-6 font-body uppercase tracking-widest">
            Integrated with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {integrations.map((integration) => {
              const Icon = integration.icon
              return (
                <motion.div
                  key={integration.name}
                  whileHover={{ scale: 1.1, y: -2 }}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl ${integration.bg} backdrop-blur-sm border border-white/5`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${integration.color}`} />
                  <span className={`text-xs sm:text-sm font-medium ${integration.color}`}>
                    {integration.name}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
