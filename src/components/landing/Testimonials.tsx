import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

interface Testimonial {
  name: string
  restaurant: string
  location: string
  quote: string
  quoteEn: string
  rating: number
  color: string
  initial: string
}

const testimonials: Testimonial[] = [
  {
    name: 'Fatima Hassan',
    restaurant: 'Bahari Seafood',
    location: 'Nyali, Mombasa',
    quote: 'MenuMoja imebadilisha kabisa biashara yetu. Wateja wanapenda kuchambua menyu kwa simu zao na kulipa kwa M-Pesa. Mapato yameongezeka kwa 40%!',
    quoteEn: 'MenuMoja completely transformed our business. Customers love browsing the menu on their phones and paying with M-Pesa. Revenue increased by 40%!',
    rating: 5,
    color: 'from-secondary to-accent',
    initial: 'FH',
  },
  {
    name: 'James Ochieng',
    restaurant: 'Pwani Grill House',
    location: 'Diani Beach',
    quote: 'The AI menu assistant is incredible. Our customers can ask questions in Swahili and get instant answers. It feels like having extra staff!',
    quoteEn: 'The AI menu assistant is incredible. Our customers ask questions in Swahili and get instant answers. Like having extra staff!',
    rating: 5,
    color: 'from-accent to-secondary',
    initial: 'JO',
  },
  {
    name: 'Amina Khamis',
    restaurant: 'Nyota Star Cafe',
    location: 'Old Town, Mombasa',
    quote: 'Hatukuwahi kufikiria kuwa ni rahisi hivi kusimamia menyu yetu. Mabadiliko ya bei na ofa mpya ni sekunde tu. Wateja wetu wanapenda!',
    quoteEn: 'We never thought managing our menu could be this easy. Price changes and new offers take seconds. Our customers love it!',
    rating: 5,
    color: 'from-success to-secondary',
    initial: 'AK',
  },
  {
    name: 'David Mwangi',
    restaurant: 'Jambo Junction',
    location: 'Mtwapa',
    quote: 'M-Pesa integration alone saved us hours of manual payment processing. Now everything is automatic. I recommend MenuMoja to every restaurant owner.',
    quoteEn: 'M-Pesa integration alone saved us hours of manual payment processing. Everything is automatic now. I recommend MenuMoja to every restaurant owner.',
    rating: 5,
    color: 'from-secondary to-accent',
    initial: 'DM',
  },
  {
    name: 'Zahara Ali',
    restaurant: 'Sultan\'s Table',
    location: 'Bamburi',
    quote: 'Kamera surveillance imetusaidia kupunguza wizi jikoni kwa 60%. Uwekezaji bora kabisa tuliofanya kwa biashara yetu.',
    quoteEn: 'Camera surveillance helped us reduce kitchen theft by 60%. The best investment we\'ve made for our business.',
    rating: 4,
    color: 'from-accent to-secondary',
    initial: 'ZA',
  },
  {
    name: 'Kevin Barasa',
    restaurant: 'Safari Bistro',
    location: 'Ukunda',
    quote: 'The analytics dashboard shows me exactly which dishes sell best, peak hours, and customer preferences. I\'ve reduced food waste by 25%.',
    quoteEn: 'The analytics dashboard shows me exactly which dishes sell best, peak hours, and customer preferences. Food waste reduced by 25%.',
    rating: 5,
    color: 'from-success to-secondary',
    initial: 'KB',
  },
]

export function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const totalWidth = el.scrollWidth / 2
    let animationId: number

    const scroll = () => {
      if (!el) return
      el.scrollLeft += 0.5
      if (el.scrollLeft >= totalWidth) {
        el.scrollLeft = 0
      }
      animationId = requestAnimationFrame(scroll)
    }

    animationId = requestAnimationFrame(scroll)

    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <section className="relative py-16 sm:py-20 lg:py-28 bg-background-light overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-12 lg:mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <span className="text-secondary font-accent text-sm tracking-widest uppercase mb-4 block">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-primary mb-4">
            Loved by{' '}
            <span className="text-gradient">restaurant owners</span>
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto font-body">
            Hear from the restaurants that transformed their business with MenuMoja
          </p>
        </motion.div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-hidden cursor-grab active:cursor-grabbing"
      >
        <div className="flex gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 w-max">
          {[...testimonials, ...testimonials].map((t, index) => (
            <motion.div
              key={`${t.name}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (index % testimonials.length) * 0.05 }}
              className="w-[300px] sm:w-[360px] lg:w-[400px] shrink-0"
            >
              <div className="bg-white rounded-2xl p-5 sm:p-6 lg:p-7 shadow-soft border border-gray-100 hover:shadow-lg transition-shadow duration-300 h-full">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm sm:text-base font-accent`}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold font-heading text-primary">
                      {t.name}
                    </h4>
                    <p className="text-text-secondary text-xs sm:text-sm font-body">
                      {t.restaurant} · {t.location}
                    </p>
                  </div>
                </div>

                <div className="flex gap-0.5 mb-3 sm:mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                        i < t.rating ? 'text-accent fill-accent' : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-text-secondary text-xs sm:text-sm font-body leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="text-gray-400 text-[10px] sm:text-xs font-body border-t border-gray-100 pt-2">
                    &ldquo;{t.quoteEn}&rdquo;
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
