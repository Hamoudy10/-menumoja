import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle, Search, ChevronDown, ChevronUp, Bot, MessageCircle,
  Mail, Phone, Video, FileText, ArrowRight, Play,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchBar } from '@/components/ui/SearchBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { showSuccessToast } from '@/components/ui/Toast'

const faqs = [
  { q: 'How do I add a new menu item?', a: 'Go to Menu Manager, select a category, and click "Add Menu Item". Fill in the details and save.' },
  { q: 'How do I process M-Pesa payments?', a: 'M-Pesa payments are processed automatically. Ensure your till number is configured in Settings > Payment Settings.' },
  { q: 'How do I add staff members?', a: 'Navigate to Settings > Staff section. Click "Add Staff" and fill in their details and role.' },
  { q: 'How does AI marketing work?', a: 'Enable Auto Mode in the Marketing page. AI will generate and schedule content based on your menu and preferences.' },
  { q: 'How do I manage live orders?', a: 'Use the Orders page. Live orders appear in a Kanban board. Click on order cards to advance their status.' },
  { q: 'Can I customize my QR code?', a: 'Yes, visit Settings > QR Manager to customize colors, shapes, and templates for your QR codes.' },
  { q: 'How do I view analytics?', a: 'The Analytics page shows revenue trends, popular items, heatmaps, and more. Use the period selector to filter data.' },
  { q: 'How do I change the app language?', a: 'Go to Settings > Language. Select your preferred language and click Save. The entire interface will update.' },
  { q: 'How do I set up a table-specific QR?', a: 'In Settings > QR Manager, click "Generate Table QR", enter the table number and label, then generate.' },
  { q: 'How do I use AI for menu descriptions?', a: 'Edit a menu item, scroll to the description section, click "Write with AI" and optionally add context for better results.' },
]

const tutorials = [
  {
    title: 'Getting Started with MenuMoja',
    duration: '4:30',
    videoId: 'dQw4w9WgXcQ',
    description: 'Learn the basics of setting up your restaurant on MenuMoja',
  },
  {
    title: 'How to Manage Your Menu',
    duration: '6:15',
    videoId: 'dQw4w9WgXcQ',
    description: 'Add categories, items, and use AI for descriptions',
  },
  {
    title: 'Processing Orders & Payments',
    duration: '5:45',
    videoId: 'dQw4w9WgXcQ',
    description: 'Handle live orders and configure M-Pesa payments',
  },
  {
    title: 'AI Marketing Setup Guide',
    duration: '7:20',
    videoId: 'dQw4w9WgXcQ',
    description: 'Set up AI-powered social media marketing for your restaurant',
  },
  {
    title: 'QR Code Generation & Customization',
    duration: '3:50',
    videoId: 'dQw4w9WgXcQ',
    description: 'Generate main and table-specific QR codes with custom designs',
  },
  {
    title: 'Theme & Appearance Customization',
    duration: '4:10',
    videoId: 'dQw4w9WgXcQ',
    description: 'Customize colors, fonts, and gradients for your brand',
  },
]

export default function HelpPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [showChefAi, setShowChefAi] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiChat, setAiChat] = useState<{ role: string; content: string }[]>([
    { role: 'ai', content: 'Hello! I\'m Chef AI. How can I help you with your restaurant today?' },
  ])
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [activeVideo, setActiveVideo] = useState<string | null>(null)

  const filteredFaqs = faqs.filter((f) =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  )

  const handleAiSend = () => {
    if (!aiMessage.trim()) return
    setAiChat([...aiChat, { role: 'user', content: aiMessage }])
    setTimeout(() => {
      setAiChat((prev) => [...prev, {
        role: 'ai',
        content: 'Great question! Let me help you with that. Based on our documentation, here\'s what you need to know...',
      }])
    }, 1000)
    setAiMessage('')
  }

  const handleContactSubmit = () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) return
    showSuccessToast(t('help.messageSent'))
    setContactForm({ name: '', email: '', message: '' })
  }

  const filteredTutorials = tutorials.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">{t('help.title')}</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">{t('help.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowChefAi(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-secondary to-accent px-4 py-2.5 text-white font-accent text-sm font-medium shadow-warm"
        >
          <Bot className="h-4 w-4" />
          {t('help.chefAI')}
        </motion.button>
      </div>

      <SearchBar
        placeholder={t('help.searchPlaceholder')}
        value={search}
        onChange={setSearch}
        className="max-w-xl"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">{t('help.faq')}</h3>
            {filteredFaqs.length === 0 ? (
              <EmptyState icon={<Search className="h-8 w-8" />} title="No results" description="Try a different search term" />
            ) : (
              <div className="space-y-2">
                {filteredFaqs.map((faq) => (
                  <div key={faq.q} className="rounded-xl border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === faq.q ? null : faq.q)}
                      className="flex w-full items-center justify-between p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <span className="font-body text-sm font-medium text-text-primary dark:text-white flex-1 pr-4">{faq.q}</span>
                      {openFaq === faq.q ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-text-secondary" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
                      )}
                    </button>
                    <AnimatePresence>
                      {openFaq === faq.q && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="px-3 pb-3 font-body text-sm text-text-secondary dark:text-white/60">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">{t('help.contactSupport')}</h3>
            <div className="space-y-3">
              <Input label={t('help.name')} value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
              <Input label={t('help.email')} type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              <div>
                <label className="mb-2 block font-accent text-sm font-medium text-text-primary dark:text-white/90">{t('help.message')}</label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2.5 font-body text-text-primary dark:text-white transition-all focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                  rows={3}
                  placeholder="How can we help?"
                />
              </div>
              <Button fullWidth onClick={handleContactSubmit}>
                <Mail className="h-4 w-4" /> {t('help.sendMessage')}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
            <h3 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-4">{t('help.videoTutorials')}</h3>
            {filteredTutorials.length === 0 ? (
              <EmptyState icon={<Video className="h-8 w-8" />} title="No tutorials found" description="Try a different search term" />
            ) : (
              <div className="space-y-3">
                {filteredTutorials.map((t) => (
                  <div key={t.title}>
                    <div
                      onClick={() => setActiveVideo(activeVideo === t.videoId ? null : t.videoId)}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="relative flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-secondary/20 to-accent/20 overflow-hidden">
                        <img
                          src={`https://img.youtube.com/vi/${t.videoId}/mqdefault.jpg`}
                          alt={t.title}
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                          <Play className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-text-primary dark:text-white group-hover:text-secondary transition-colors">{t.title}</p>
                        <p className="font-accent text-xs text-text-secondary dark:text-white/50 mt-0.5">{t.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-accent text-[10px] text-text-secondary dark:text-white/40">{t.duration}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                    </div>
                    <AnimatePresence>
                      {activeVideo === t.videoId && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden rounded-xl"
                        >
                          <div className="p-2">
                            <div className="aspect-video rounded-lg overflow-hidden bg-black">
                              <iframe
                                src={`https://www.youtube.com/embed/${t.videoId}?autoplay=1`}
                                title={t.title}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-light p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold">{t('help.needImmediateHelp')}</h3>
            <p className="font-body text-sm text-white/70 mt-1">{t('help.support247')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-accent" />
              <span className="font-accent text-sm">+254 700 123 456</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" />
              <span className="font-accent text-sm">support@menumoja.co.ke</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showChefAi && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowChefAi(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl bg-white dark:bg-primary-light border border-white/10 shadow-soft overflow-hidden"
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-secondary to-accent p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-accent text-sm font-bold text-white">Chef AI</p>
                    <p className="font-accent text-[10px] text-white/70">Online</p>
                  </div>
                </div>
                <button onClick={() => setShowChefAi(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>

              <div className="h-80 overflow-y-auto p-4 space-y-3">
                {aiChat.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'ai'
                        ? 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-white'
                        : 'bg-secondary text-white'
                    }`}>
                      <p className="font-body text-sm">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="border-t border-white/10 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                    placeholder={t('help.askChefAI')}
                    className="flex-1 rounded-xl border-2 border-gray-200 dark:border-white/20 bg-transparent px-3 py-2 text-sm font-body text-text-primary dark:text-white outline-none focus:border-secondary transition-colors"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAiSend}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-white"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function X(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
