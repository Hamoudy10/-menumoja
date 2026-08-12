import { useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { useRef } from 'react'
import { UserPlus, Edit3, Printer, Smartphone } from 'lucide-react'

interface Step {
  number: number
  title: string
  description: string
  icon: typeof UserPlus
  screen: React.ReactNode
}

const phoneScreens: React.ReactNode[] = [
  <div key="step1" className="bg-white rounded-[1.2rem] overflow-hidden">
    <div className="bg-gradient-to-r from-secondary to-accent p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-white rounded-full" />
        <span className="text-white/80 text-[8px] sm:text-[10px] font-accent font-semibold">MENUMOJA</span>
      </div>
      <h3 className="text-white font-bold text-xs sm:text-sm font-heading">Create Account</h3>
    </div>
    <div className="p-3 sm:p-4 space-y-2">
      <div className="h-6 sm:h-7 bg-gray-100 rounded-lg flex items-center px-2 sm:px-3">
        <span className="text-[8px] sm:text-[10px] text-gray-400">Restaurant name</span>
      </div>
      <div className="h-6 sm:h-7 bg-gray-100 rounded-lg flex items-center px-2 sm:px-3">
        <span className="text-[8px] sm:text-[10px] text-gray-400">Email address</span>
      </div>
      <div className="h-6 sm:h-7 bg-secondary/20 rounded-lg flex items-center px-2 sm:px-3 border border-secondary/30">
        <span className="text-[8px] sm:text-[10px] text-secondary font-medium">Start free →</span>
      </div>
    </div>
  </div>,
  <div key="step2" className="bg-white rounded-[1.2rem] overflow-hidden">
    <div className="bg-gradient-to-r from-accent to-secondary p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-white rounded-full" />
        <span className="text-white/80 text-[8px] sm:text-[10px] font-accent font-semibold">AI MENU BUILDER</span>
      </div>
      <h3 className="text-white font-bold text-xs sm:text-sm font-heading">Build Your Menu</h3>
    </div>
    <div className="p-3 sm:p-4 space-y-1.5">
      {['Biriani', 'Tandoori', 'Mango Juice'].map((item) => (
        <div key={item} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
          <span className="text-[9px] sm:text-[11px] text-gray-700">{item}</span>
          <span className="text-[8px] sm:text-[10px] text-secondary font-semibold">KES ---</span>
        </div>
      ))}
      <div className="mt-1">
        <span className="text-[8px] sm:text-[10px] text-accent">✨ AI-generated descriptions</span>
      </div>
    </div>
  </div>,
  <div key="step3" className="bg-white rounded-[1.2rem] overflow-hidden">
    <div className="bg-gradient-to-r from-secondary to-accent p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-white rounded-full" />
        <span className="text-white/80 text-[8px] sm:text-[10px] font-accent font-semibold">QR CODE</span>
      </div>
      <h3 className="text-white font-bold text-xs sm:text-sm font-heading">Print & Place</h3>
    </div>
    <div className="p-3 sm:p-4 flex flex-col items-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-xl flex items-center justify-center mb-2">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white border-2 border-gray-800 rounded flex flex-wrap items-center justify-center p-1 gap-0.5">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${[0, 2, 6, 8].includes(i) ? 'bg-gray-900' : [4].includes(i) ? 'bg-secondary' : i % 2 === 0 ? 'bg-gray-800' : 'bg-transparent'}`}
            />
          ))}
        </div>
      </div>
      <span className="text-[8px] sm:text-[10px] text-gray-400">Place on every table</span>
    </div>
  </div>,
  <div key="step4" className="bg-white rounded-[1.2rem] overflow-hidden">
    <div className="bg-gradient-to-r from-accent to-secondary p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 bg-white rounded-full" />
        <span className="text-white/80 text-[8px] sm:text-[10px] font-accent font-semibold">ORDER RECEIVED</span>
      </div>
      <h3 className="text-white font-bold text-xs sm:text-sm font-heading">Order & Earn</h3>
    </div>
    <div className="p-3 sm:p-4 space-y-2">
      <div className="bg-success/10 rounded-lg p-2 border border-success/20">
        <div className="flex items-center justify-between">
          <span className="text-[9px] sm:text-[11px] text-gray-700 font-medium">Order #1042</span>
          <span className="text-[8px] sm:text-[10px] text-success font-semibold">✓ Confirmed</span>
        </div>
        <span className="text-[8px] sm:text-[10px] text-text-secondary">KES 1,200 via M-Pesa</span>
      </div>
      <div className="flex items-center gap-1 text-accent">
        <span className="text-[8px] sm:text-[10px]">+50 loyalty points earned</span>
      </div>
    </div>
  </div>,
]

const steps: Step[] = [
  {
    number: 1,
    title: 'Sign Up in 30s',
    description: 'Create your restaurant profile in under 30 seconds. No paperwork, no delays, no credit card required.',
    icon: UserPlus,
    screen: phoneScreens[0],
  },
  {
    number: 2,
    title: 'Build Menu with AI',
    description: 'Describe your dishes and our AI generates beautiful menu cards with prices, descriptions, and dietary tags.',
    icon: Edit3,
    screen: phoneScreens[1],
  },
  {
    number: 3,
    title: 'Print QR Codes',
    description: 'Generate and print unique QR codes for each table. Customers scan to view your full digital menu instantly.',
    icon: Printer,
    screen: phoneScreens[2],
  },
  {
    number: 4,
    title: 'Customers Order & Earn',
    description: 'Customers scan, order, and pay via M-Pesa. They earn loyalty points with every order, driving repeat visits.',
    icon: Smartphone,
    screen: phoneScreens[3],
  },
]

function StepItem({ step, index, isActive, onActivate }: { step: Step; index: number; isActive: boolean; onActivate: () => void }) {
  const Icon = step.icon
  const stepRef = useInView({
    threshold: 0.5,
    onChange: (inView) => {
      if (inView) onActivate()
    },
  })

  return (
    <motion.div
      ref={stepRef.ref}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.15, duration: 0.5 }}
      className="relative lg:text-center group"
    >
      <div className="flex items-start lg:items-center gap-4 lg:flex-col">
        <div
          className={`relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
            isActive
              ? 'bg-gradient-to-br from-secondary to-accent shadow-lg shadow-secondary/30'
              : 'bg-white/10 border border-white/20'
          }`}
        >
          <Icon
            className={`w-4 h-4 sm:w-5 sm:h-5 ${
              isActive ? 'text-white' : 'text-white/40'
            }`}
          />
          <span
            className={`absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold ${
              isActive ? 'bg-accent text-primary' : 'bg-white/20 text-white/60'
            }`}
          >
            {step.number}
          </span>
        </div>

        <div className="lg:mt-3">
          <h3
            className={`font-heading font-bold text-base sm:text-lg mb-1 transition-colors duration-300 ${
              isActive ? 'text-white' : 'text-white/50'
            }`}
          >
            {step.title}
          </h3>
          <p
            className={`text-xs sm:text-sm font-body leading-relaxed transition-colors duration-300 max-w-xs ${
              isActive ? 'text-white/60' : 'text-white/30'
            }`}
          >
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const lineProgress = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 1])

  return (
    <section
      id="demo"
      ref={sectionRef}
      className="relative py-16 sm:py-20 lg:py-28 bg-background-dark overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-primary/50 to-background-dark" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 lg:mb-20"
        >
          <span className="text-secondary font-accent text-sm tracking-widest uppercase mb-4 block">
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-white mb-4">
            Get started in{' '}
            <span className="text-gradient">4 simple steps</span>
          </h2>
          <p className="text-white/50 text-sm sm:text-base max-w-2xl mx-auto font-body">
            From signup to your first digital order — it takes less than 5 minutes
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="relative">
              <div className="absolute left-1.5 sm:left-2 top-0 bottom-0 w-0.5 bg-white/10 lg:hidden" />
              <motion.div
                className="absolute left-1.5 sm:left-2 top-0 w-0.5 bg-gradient-to-b from-secondary to-accent lg:hidden"
                style={{ scaleY: lineProgress, transformOrigin: 'top' }}
              />

              <div className="hidden lg:block absolute left-0 right-0 top-[26px] h-0.5 bg-white/10" />
              <motion.div
                className="hidden lg:block absolute left-0 top-[26px] h-0.5 bg-gradient-to-r from-secondary to-accent"
                style={{ scaleX: lineProgress, transformOrigin: 'left' }}
              />

              <div className="relative space-y-8 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-4">
                {steps.map((step, index) => (
                  <StepItem key={step.number} step={step} index={index} isActive={index <= activeStep} onActivate={() => setActiveStep(index)} />
                ))}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="order-1 lg:order-2 flex justify-center"
          >
            <div className="relative animate-float">
              <div className="relative rounded-[2rem] sm:rounded-[2.5rem] border-[3px] border-gray-700/60 bg-gray-900 p-2.5 sm:p-3 shadow-2xl shadow-secondary/10 w-[240px] sm:w-[280px] lg:w-[300px]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 sm:h-5 bg-gray-800 rounded-b-xl z-10" />
                <div className="overflow-hidden rounded-[1.2rem]">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {phoneScreens[activeStep]}
                  </motion.div>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 w-full h-full rounded-[2rem] sm:rounded-[2.5rem] border border-secondary/20 -z-10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
