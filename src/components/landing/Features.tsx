import { type ElementType } from 'react'
import { motion } from 'framer-motion'
import { QrCode, MessageCircle, Wallet, Megaphone, Camera, BarChart3 } from 'lucide-react'

interface Feature {
  icon: ElementType
  title: string
  description: string
  gradient: string
  colSpan?: string
  rowSpan?: string
}

const features: Feature[] = [
  {
    icon: QrCode,
    title: 'QR Digital Menu',
    description:
      'Contactless menus accessible via QR code scan. Update items, prices, and offers in real-time. Eliminate printing costs forever.',
    gradient: 'from-secondary to-accent',
    colSpan: 'lg:col-span-2',
    rowSpan: 'lg:row-span-2',
  },
  {
    icon: MessageCircle,
    title: 'AI Menu Assistant',
    description:
      'Your AI sommelier recommends dishes, answers customer questions, and upsells intelligently in English, Swahili, or Arabic.',
    gradient: 'from-accent to-secondary',
  },
  {
    icon: Wallet,
    title: 'M-Pesa Ordering',
    description:
      'Seamless M-Pesa integration lets customers order and pay directly from their phones. Instant confirmations, zero hassle.',
    gradient: 'from-success to-secondary',
  },
  {
    icon: Megaphone,
    title: 'AI Marketing Bot',
    description:
      'Automate social media posts, promotions, and customer engagement across Facebook, Instagram, and WhatsApp.',
    gradient: 'from-secondary to-accent',
    colSpan: 'lg:col-span-2',
    rowSpan: 'lg:row-span-2',
  },
  {
    icon: Camera,
    title: 'Camera Surveillance',
    description:
      'AI-powered CCTV with motion detection, theft alerts, and real-time monitoring from your dashboard.',
    gradient: 'from-accent to-secondary',
  },
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    description:
      'Understand your business with real-time sales data, popular items, peak hours, and customer demographics. Make data-driven decisions.',
    gradient: 'from-success to-secondary',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

export function Features() {
  return (
    <section id="features" className="relative py-16 sm:py-20 lg:py-28 bg-background-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 lg:mb-20"
        >
          <span className="text-secondary font-accent text-sm tracking-widest uppercase mb-4 block">
            Everything you need
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-primary mb-4">
            Powerful features for{' '}
            <span className="text-gradient">modern restaurants</span>
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto font-body">
            From digital menus to AI-powered marketing — everything you need to run a successful restaurant
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6"
        >
          {features.map((feature) => {
            const Icon = feature.icon
            const isLarge = feature.colSpan === 'lg:col-span-2'

            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                className={`group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-soft transition-all duration-500 cursor-default
                  ${feature.colSpan || ''} ${feature.rowSpan || ''}
                  ${isLarge ? 'min-h-[320px] sm:min-h-[360px]' : 'min-h-[240px] sm:min-h-[260px]'}
                  hover:shadow-xl hover:border-transparent`}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                  style={{
                    padding: '1px',
                    background: `linear-gradient(135deg, var(--color-secondary), var(--color-accent), var(--color-secondary))`,
                    WebkitMask:
                      'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />

                <div className="p-5 sm:p-6 lg:p-7 h-full flex flex-col relative z-10">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold font-heading text-primary mb-2 group-hover:text-secondary transition-colors duration-300">
                    {feature.title}
                  </h3>

                  <p className="text-text-secondary text-xs sm:text-sm font-body leading-relaxed flex-1">
                    {feature.description}
                  </p>

                  {isLarge && (
                    <div className="mt-3 sm:mt-4 flex items-center gap-1 text-secondary text-xs sm:text-sm font-accent font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span>Learn more</span>
                      <span className="text-base leading-none">→</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
