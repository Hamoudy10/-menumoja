import { motion } from 'framer-motion'
import { Check, Wrench, Percent, ShieldCheck, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

const steps = [
  {
    icon: Wrench,
    title: 'One-time setup',
    amount: 'KES 5,000',
    per: 'once',
    description: 'QR codes printed for every table, your digital menu built, staff trained, and M-Pesa connected to YOUR till or paybill.',
    features: ['Digital menu built for you', 'Table + takeaway QR codes', 'Staff training (30–60 min)', 'M-Pesa payment setup'],
  },
  {
    icon: Percent,
    title: 'Pay only when you sell',
    amount: '5%',
    per: 'of sales',
    description: 'No monthly fee. You only pay 5% of orders processed through the system — if you don\'t sell, you don\'t pay.',
    features: ['No monthly subscription', 'No hidden fees', 'Money goes straight to YOUR till', 'Cancel anytime, keep your menu'],
  },
  {
    icon: ShieldCheck,
    title: 'Your cost is capped',
    amount: 'KES 10,000',
    per: 'max / month',
    description: 'Whatever your sales, you never pay more than KES 10,000 in any month. Great for busy restaurants.',
    features: ['Fair for small and big sales', 'No surprises on busy days', 'All features included', 'Priority WhatsApp support'],
  },
]

const example = [
  { label: 'Monthly sales via system', value: 'KES 200,000', commission: 'KES 10,000 (capped)', note: 'You pay the cap — same as a small monthly fee' },
  { label: 'Monthly sales via system', value: 'KES 100,000', commission: 'KES 5,000', note: 'Only 5% of what you sold' },
  { label: 'Monthly sales via system', value: 'KES 40,000', commission: 'KES 2,000', note: 'Small month = small payment' },
  { label: 'Slow month — no sales', value: 'KES 0', commission: 'KES 0', note: 'You pay nothing at all' },
]

export function Pricing() {
  const navigate = useNavigate()

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
            You only pay{' '}
            <span className="text-gradient">when you sell</span>
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto font-body">
            No monthly subscriptions. No lock-in. A small one-time setup, then 5% of the sales
            your restaurant makes through the system — capped so it never grows too big.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className={`relative rounded-2xl bg-white border transition-all duration-300 ${
                  index === 1
                    ? 'border-secondary/30 shadow-warm scale-105 lg:scale-110 z-10'
                    : 'border-gray-100 shadow-soft hover:shadow-lg hover:border-gray-200'
                }`}
              >
                {index === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-secondary to-accent text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1 rounded-full font-accent whitespace-nowrap">
                    Most Popular
                  </div>
                )}

                <div className="p-5 sm:p-6 lg:p-8">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-secondary/10 to-accent/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-secondary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-heading text-primary mb-1">
                    {step.title}
                  </h3>
                  <p className="text-text-secondary text-xs sm:text-sm font-body mb-4 sm:mb-6">
                    {step.description}
                  </p>

                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold font-heading text-primary">
                        {step.amount}
                      </span>
                      <span className="text-text-secondary text-sm font-body">{step.per}</span>
                    </div>
                  </div>

                  <Button
                    variant={index === 1 ? 'primary' : 'outline'}
                    className={`w-full mb-4 sm:mb-6 ${index === 1 ? '' : 'border-primary/20 text-primary hover:bg-primary hover:text-white'}`}
                    onClick={() => navigate('/signup')}
                  >
                    {index === 1 ? 'Start Free Trial' : 'Get Started'}
                  </Button>

                  <ul className="space-y-2.5 sm:space-y-3">
                    {step.features.map((feature) => (
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto mt-12 sm:mt-16 bg-white rounded-2xl border border-gray-100 shadow-soft p-6 sm:p-8"
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-secondary" />
            <h3 className="font-heading font-bold text-primary">What you'd pay — real examples</h3>
          </div>
          <div className="space-y-3">
            {example.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0">
                  <p className="text-text-secondary">{row.label}</p>
                  <p className="font-bold text-primary">{row.value}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-secondary">{row.commission}</p>
                  <p className="text-text-secondary/70 text-[10px] sm:text-xs">{row.note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-secondary/70 mt-5">
            Sales = orders placed through your QR menu. The money from M-Pesa goes directly to
            your till or paybill — you stay in full control of your money.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
