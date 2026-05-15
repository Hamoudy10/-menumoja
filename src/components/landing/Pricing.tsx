import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

interface PricingPlan {
  name: string
  monthlyPrice: number
  yearlyPrice: number
  description: string
  features: string[]
  popular?: boolean
  gradient: string
}

const plans: PricingPlan[] = [
  {
    name: 'Starter',
    monthlyPrice: 1500,
    yearlyPrice: 15000,
    description: 'Perfect for small restaurants and food stalls getting started with digital menus.',
    gradient: 'from-secondary/80 to-accent/80',
    features: [
      'QR Digital Menu',
      'Up to 50 menu items',
      'M-Pesa payment integration',
      'Basic analytics dashboard',
      'Single user access',
      'Email support',
    ],
  },
  {
    name: 'Business',
    monthlyPrice: 3500,
    yearlyPrice: 35000,
    description: 'Ideal for growing restaurants that want AI-powered tools and marketing automation.',
    gradient: 'from-secondary to-accent',
    popular: true,
    features: [
      'Everything in Starter',
      'AI Menu Assistant',
      'AI Marketing Bot',
      'Unlimited menu items',
      'Multi-user access (up to 5)',
      'WhatsApp & Facebook integration',
      'Priority support',
    ],
  },
  {
    name: 'Premium',
    monthlyPrice: 7500,
    yearlyPrice: 75000,
    description: 'For established restaurants and chains needing complete control and surveillance.',
    gradient: 'from-accent to-secondary',
    features: [
      'Everything in Business',
      'Camera Surveillance AI',
      'Advanced analytics & reports',
      'Unlimited users',
      'Custom branding & themes',
      'Dedicated account manager',
      '24/7 phone & WhatsApp support',
      'API access',
    ],
  },
]

export function Pricing() {
  const navigate = useNavigate()
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="relative py-16 sm:py-20 lg:py-28 bg-background-light overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background-light via-white to-background-light pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-12 lg:mb-16"
        >
          <span className="text-secondary font-accent text-sm tracking-widest uppercase mb-4 block">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-primary mb-4">
            Simple, transparent{' '}
            <span className="text-gradient">pricing</span>
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto font-body">
            No hidden fees. No surprises. Cancel anytime.
          </p>

          <div className="inline-flex items-center gap-3 mt-6 sm:mt-8 bg-white rounded-full p-1 shadow-soft border border-gray-100">
            <button
              onClick={() => setYearly(false)}
              className={`relative px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-accent font-semibold transition-all duration-300 ${
                !yearly ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`relative px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-accent font-semibold transition-all duration-300 ${
                yearly ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-primary'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 bg-success text-white text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice
            const priceLabel = yearly ? '/yr' : '/mo'

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className={`relative rounded-2xl bg-white border transition-all duration-300 ${
                  plan.popular
                    ? 'border-secondary/30 shadow-warm scale-105 lg:scale-110 z-10'
                    : 'border-gray-100 shadow-soft hover:shadow-lg hover:border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-secondary to-accent text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1 rounded-full font-accent whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                {plan.popular && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      padding: '1px',
                      background: 'linear-gradient(135deg, var(--color-secondary), var(--color-accent), var(--color-secondary))',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />
                )}

                <div className="p-5 sm:p-6 lg:p-8">
                  <h3 className="text-lg sm:text-xl font-bold font-heading text-primary mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-text-secondary text-xs sm:text-sm font-body mb-4 sm:mb-6">
                    {plan.description}
                  </p>

                  <div className="mb-4 sm:mb-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={yearly ? 'yearly' : 'monthly'}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-baseline gap-1"
                      >
                        <span className="text-3xl sm:text-4xl font-bold font-heading text-primary">
                          KES {price.toLocaleString()}
                        </span>
                        <span className="text-text-secondary text-sm font-body">{priceLabel}</span>
                      </motion.div>
                    </AnimatePresence>
                    {yearly && (
                      <p className="text-success text-xs font-accent mt-1">
                        Save KES {(plan.monthlyPrice * 12 - plan.yearlyPrice).toLocaleString()}/yr
                      </p>
                    )}
                  </div>

                  <Button
                    variant={plan.popular ? 'primary' : 'outline'}
                    className={`w-full mb-4 sm:mb-6 ${plan.popular ? '' : 'border-primary/20 text-primary hover:bg-primary hover:text-white'}`}
                    onClick={() => navigate('/signup')}
                  >
                    {plan.popular ? 'Start Free Trial' : 'Get Started'}
                  </Button>

                  <ul className="space-y-2.5 sm:space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 sm:gap-3">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-success" />
                        </div>
                        <span className="text-text-secondary text-xs sm:text-sm font-body">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
