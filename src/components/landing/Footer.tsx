import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { UtensilsCrossed, MessageCircle, ArrowUp } from 'lucide-react'

const quickLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Demo', href: '#demo' },
  { label: 'FAQ', href: '#faq' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Refund Policy', href: '#' },
  { label: 'Data Protection', href: '#' },
]

const socialLinks = [
  { label: 'Facebook', icon: 'facebook', href: '#' },
  { label: 'Instagram', icon: 'instagram', href: '#' },
  { label: 'Twitter', icon: 'twitter', href: '#' },
  { label: 'LinkedIn', icon: 'linkedin', href: '#' },
]

const socialIcons: Record<string, React.ReactNode> = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.5" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
}

export function Footer() {
  const [showScroll, setShowScroll] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(true)

  useEffect(() => {
    const handleScroll = () => setShowScroll(window.scrollY > 400)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    let lastY = window.scrollY
    const handleScroll = () => {
      const currentY = window.scrollY
      setShowWhatsApp(currentY < lastY || currentY < 200)
      lastY = currentY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <footer className="relative bg-background-dark border-t border-white/5">
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-primary/30 to-background-dark pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
            <div>
              <a href="#" className="flex items-center gap-2 text-white group mb-4">
                <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 text-secondary transition-transform duration-300 group-hover:rotate-12" />
                <span className="text-lg sm:text-xl font-bold font-heading tracking-tight">
                  Menu<span className="text-secondary">Moja</span>
                </span>
              </a>
              <p className="text-white/40 text-xs sm:text-sm font-body leading-relaxed mb-4">
                The smartest restaurant management platform on the Kenyan coast. 
                Empowering restaurants in Mombasa and beyond with digital menus, 
                AI-powered tools, and seamless M-Pesa payments.
              </p>
              <div className="flex items-center gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    aria-label={link.label}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 hover:bg-secondary/20 flex items-center justify-center text-white/40 hover:text-secondary transition-all duration-300 border border-white/5 hover:border-secondary/30"
                  >
                    {socialIcons[link.icon]}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold font-heading text-sm sm:text-base mb-4 sm:mb-5">
                Quick Links
              </h4>
              <ul className="space-y-2.5 sm:space-y-3">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-white/40 hover:text-white transition-colors text-xs sm:text-sm font-body"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold font-heading text-sm sm:text-base mb-4 sm:mb-5">
                Legal
              </h4>
              <ul className="space-y-2.5 sm:space-y-3">
                {legalLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-white/40 hover:text-white transition-colors text-xs sm:text-sm font-body"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold font-heading text-sm sm:text-base mb-4 sm:mb-5">
                Contact
              </h4>
              <ul className="space-y-2.5 sm:space-y-3">
                <li className="text-white/40 text-xs sm:text-sm font-body">
                  Mombasa, Kenya
                </li>
                <li className="text-white/40 text-xs sm:text-sm font-body">
                  info@menumoja.co.ke
                </li>
                <li className="text-white/40 text-xs sm:text-sm font-body">
                  +254 700 123 456
                </li>
                <li>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-secondary hover:text-accent transition-colors text-xs sm:text-sm font-body font-medium"
                  >
                    <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    WhatsApp Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 sm:mt-14 lg:mt-16 pt-6 sm:pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs sm:text-sm font-body text-center sm:text-left">
              &copy; {new Date().getFullYear()} MenuMoja. All rights reserved. 
              Made with <span className="text-secondary">&#9829;</span> for Mombasa Restaurants.
            </p>
            <p className="text-white/20 text-[10px] sm:text-xs font-body">
              Empowering the Kenyan Coast, one restaurant at a time.
            </p>
          </div>
        </div>
      </footer>

      <motion.button
        onClick={scrollToTop}
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: showScroll ? 1 : 0,
          scale: showScroll ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-6 left-6 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary text-white flex items-center justify-center shadow-lg hover:bg-secondary-dark transition-colors cursor-pointer"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
      </motion.button>

      <motion.a
        href="https://wa.me/254700123456?text=Hello%20MenuMoja!%20I%27d%20like%20to%20know%20more%20about%20your%20platform."
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: showWhatsApp ? 1 : 0,
          scale: showWhatsApp ? 1 : 0,
        }}
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center shadow-xl hover:shadow-green-500/30 animate-bounce cursor-pointer"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
      </motion.a>
    </>
  )
}
