import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChefHat, Store, Menu, QrCode, TrendingUp, Smartphone,
  ArrowRight, Check, Star, Users, Clock, ShoppingCart,
  CreditCard, BarChart3, Sparkles, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const stats = [
  { label: 'Active Restaurants', value: '2,500+', icon: Store },
  { label: 'Monthly Orders', value: '150K+', icon: ShoppingCart },
  { label: 'Avg. Rating', value: '4.8★', icon: Star },
  { label: 'Countries', value: '12+', icon: Users },
]

const features = [
  {
    icon: Smartphone,
    title: 'Digital Menu',
    description: 'Beautiful mobile-optimized menu with QR code access',
    color: 'var(--color-secondary)',
  },
  {
    icon: QrCode,
    title: 'QR Ordering',
    description: 'Customers scan, browse, and order from their phone',
    color: '#2ECC71',
  },
  {
    icon: CreditCard,
    title: 'M-Pesa Integration',
    description: 'Seamless mobile money payments',
    color: '#3498DB',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Track sales, popular items, and customer trends',
    color: '#9B59B6',
  },
  {
    icon: Clock,
    title: 'Order Management',
    description: 'Real-time order alerts and kitchen display',
    color: '#E74C3C',
  },
  {
    icon: Zap,
    title: 'AI Assistant',
    description: 'Smart AI that understands your customers and helps them order faster',
    color: '#F39C12',
  },
]

const testimonials = [
  {
    name: 'Grace Mwangi',
    role: 'Owner, Swahili Flavors',
    text: 'MenuMoja transformed how my customers order. Setup took 15 minutes!',
    rating: 5,
    avatar: '👩‍🍳',
  },
  {
    name: 'David Ochieng',
    role: 'Manager, Lakeside Grill',
    text: 'The QR code system is genius. Our table turnover improved by 40%.',
    rating: 5,
    avatar: '👨‍🍳',
  },
  {
    name: 'Amina Hassan',
    role: 'Owner, Zanzibar Kitchen',
    text: "M-Pesa integration made payments so easy. My customers love it!",
    rating: 5,
    avatar: '👩‍🍳',
  },
]

const menuItems = [
  { name: 'Nyama Choma', price: 'KES 850', emoji: '🥩', tag: 'Popular' },
  { name: 'Chicken Biryani', price: 'KES 650', emoji: '🍛', tag: 'Special' },
  { name: 'Mango Juice', price: 'KES 250', emoji: '🥭', tag: null },
  { name: 'Samosas', price: 'KES 350', emoji: '🥟', tag: 'Chef\'s Pick' },
]

export default function DemoPage() {
  const [showMockup, setShowMockup] = useState(false)
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'analytics'>('menu')

  useEffect(() => {
    const t = setTimeout(() => setShowMockup(true), 500)
    return () => clearTimeout(t)
  }, [])

  const OrderNotification = () => (
    <motion.div
      initial={{ opacity: 0, y: 50, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ delay: 2 }}
      className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-xl p-4 border border-gray-100 max-w-[220px]"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-semibold text-success">New Order</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">🍛</span>
        <div>
          <p className="text-xs font-semibold">Table 5</p>
          <p className="text-[10px] text-text-secondary">Chicken Biryani x2</p>
        </div>
        <span className="text-xs font-bold text-secondary ml-auto">KES 1,300</span>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-background-light">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg text-primary">MenuMoja</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">
              Login
            </a>
            <Button size="sm" variant="primary" onClick={() => window.location.href = '/signup'}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-light to-primary pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm mb-6"
              >
                <Sparkles className="w-4 h-4 text-accent" />
                The #1 Restaurant Platform in East Africa
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl lg:text-6xl font-heading font-bold text-white leading-tight mb-6"
              >
                Your Restaurant,{' '}
                <span className="text-gradient">Digital</span>
                {' '}in Minutes
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-gray-300 mb-8 max-w-lg"
              >
                Create a stunning digital menu, accept orders via QR code, and grow your business with AI-powered tools.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-4"
              >
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight className="w-5 h-5" />}
                  iconPosition="right"
                  onClick={() => window.location.href = '/signup'}
                >
                  Start Free Trial
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-white hover:bg-white/10"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  See how it works
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-6 mt-10"
              >
                <div className="flex -space-x-2">
                  {['👩‍🍳', '👨‍🍳', '👩‍🍳', '👨‍🍳'].map((a, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm border-2 border-primary/50">
                      {a}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Trusted by 2,500+ restaurants</p>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="relative"
            >
              <div className="relative">
                <div className="bg-white/5 backdrop-blur-sm rounded-[32px] p-4 border border-white/10">
                  <div className="bg-white rounded-[24px] overflow-hidden shadow-2xl">
                    <div className="bg-gray-100 px-4 py-3 flex items-center justify-between border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                          <div className="w-2.5 h-2.5 rounded-full bg-success" />
                        </div>
                        <span className="text-xs text-text-secondary ml-2 font-medium">Dashboard Preview</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-success/10 text-success rounded-full font-medium">LIVE</span>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-white text-xs font-bold">
                          B
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary">Bahari Restaurant</p>
                          <p className="text-[10px] text-text-secondary">Swahili & Grill • Mombasa</p>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-success" />
                          <span className="text-[10px] text-success font-medium">Online</span>
                        </div>
                      </div>

                      <div className="flex gap-1 mb-4 bg-gray-50 rounded-xl p-1">
                        {(['menu', 'orders', 'analytics'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-all ${
                              activeTab === tab
                                ? 'bg-white text-primary shadow-soft'
                                : 'text-text-secondary hover:text-primary'
                            }`}
                          >
                            {tab === 'menu' ? 'Menu' : tab === 'orders' ? 'Orders' : 'Analytics'}
                          </button>
                        ))}
                      </div>

                      <AnimatePresence mode="wait">
                        {activeTab === 'menu' && (
                          <motion.div
                            key="menu"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-2"
                          >
                            {menuItems.map((item, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-lg bg-secondary/5 flex items-center justify-center text-lg">
                                  {item.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-semibold truncate">{item.name}</p>
                                    {item.tag && (
                                      <span className="text-[8px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-semibold">
                                        {item.tag}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-secondary font-medium">{item.price}</p>
                                </div>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}

                        {activeTab === 'orders' && (
                          <motion.div
                            key="orders"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-2"
                          >
                            {[
                              { table: 'Table 5', items: 'Nyama Choma x2', total: 'KES 1,700', status: 'New', emoji: '🥩' },
                              { table: 'Table 3', items: 'Chicken Biryani x1', total: 'KES 650', status: 'Preparing', emoji: '🍛' },
                              { table: 'Table 8', items: 'Samosas x3', total: 'KES 1,050', status: 'Ready', emoji: '🥟' },
                            ].map((order, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50">
                                <span className="text-lg">{order.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold">{order.table}</p>
                                  <p className="text-[10px] text-text-secondary">{order.items}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-secondary">{order.total}</p>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${
                                    order.status === 'New' ? 'bg-success/10 text-success' :
                                    order.status === 'Preparing' ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary'
                                  }`}>{order.status}</span>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}

                        {activeTab === 'analytics' && (
                          <motion.div
                            key="analytics"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {[
                                { label: 'Today', value: 'KES 45,200', change: '+12%', up: true },
                                { label: 'Orders', value: '47', change: '+8%', up: true },
                                { label: 'Avg. Order', value: 'KES 962', change: '+5%', up: true },
                                { label: 'Customers', value: '89', change: '+15%', up: true },
                              ].map((stat, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-2.5">
                                  <p className="text-[10px] text-text-secondary">{stat.label}</p>
                                  <p className="text-sm font-bold text-primary">{stat.value}</p>
                                  <span className="text-[9px] text-success font-medium">{stat.change}</span>
                                </div>
                              ))}
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-[10px] text-text-secondary mb-2">Popular Items</p>
                              <div className="space-y-1.5">
                                {[
                                  { name: 'Nyama Choma', pct: 85 },
                                  { name: 'Chicken Biryani', pct: 70 },
                                  { name: 'Mango Juice', pct: 55 },
                                ].map((item, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="text-[10px] text-text-secondary w-24 truncate">{item.name}</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.pct}%` }}
                                        className="h-full rounded-full bg-secondary"
                                      />
                                    </div>
                                    <span className="text-[10px] font-semibold text-secondary">{item.pct}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
                <OrderNotification />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <Icon className="w-6 h-6 text-secondary mx-auto mb-2" />
                  <p className="text-2xl font-heading font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-text-secondary">{stat.label}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-heading font-bold text-primary mb-4">
              Everything You Need to Run Your Restaurant
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              From digital menus to AI-powered ordering — we've got you covered
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft hover:shadow-warm transition-all"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-primary mb-2">{feature.title}</h3>
                  <p className="text-sm text-text-secondary">{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-heading font-bold text-white mb-4">
              Loved by Restaurant Owners
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto">
              See what our customers have to say about MenuMoja
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              >
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.avatar}</span>
                  <div>
                    <p className="text-white text-sm font-semibold">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center mx-auto mb-6">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-heading font-bold text-primary mb-4">
              Ready to Digitize Your Restaurant?
            </h2>
            <p className="text-text-secondary mb-8 max-w-lg mx-auto">
              Join thousands of restaurants already using MenuMoja. Get started in minutes, not days.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
                onClick={() => window.location.href = '/signup'}
              >
                Start Free Trial
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.location.href = '/login'}
              >
                Sign In
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-success" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-success" />
                14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-success" />
                Cancel anytime
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-primary py-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-heading font-bold">MenuMoja</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2025 MenuMoja. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
