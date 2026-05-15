import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Smartphone, Wifi, Calendar, Car, Bike,
  Plus, X, ChevronDown, ChevronUp, ArrowLeft, ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'

const defaultFaqs = [
  { id: 'mpesa', question: 'Do you accept M-Pesa?', answer: '', enabled: false, icon: Smartphone },
  { id: 'wifi', question: 'Free WiFi available?', answer: '', enabled: false, icon: Wifi },
  { id: 'reservations', question: 'Do you accept reservations?', answer: '', enabled: false, icon: Calendar },
  { id: 'parking', question: 'Is parking available?', answer: '', enabled: false, icon: Car },
  { id: 'delivery', question: 'Do you offer delivery?', answer: '', enabled: false, icon: Bike },
]

interface Props {
  onNext: () => void
  onPrev: () => void
}

export default function Step5AISetup({ onNext, onPrev }: Props) {
  const { onboarding, updateOnboarding } = useStore()
  const [faqs, setFaqs] = useState(
    onboarding.faqs.length > 0 ? onboarding.faqs.map(f => ({ ...f, id: f.question, icon: Bot })) : defaultFaqs
  )
  const [showCustom, setShowCustom] = useState(false)
  const [customQ, setCustomQ] = useState('')
  const [customA, setCustomA] = useState('')

  const toggleFaq = (id: string) => {
    const updated = faqs.map((f) =>
      f.id === id ? { ...f, enabled: !f.enabled } : f
    )
    setFaqs(updated)
    syncToStore(updated)
  }

  const updateAnswer = (id: string, answer: string) => {
    const updated = faqs.map((f) =>
      f.id === id ? { ...f, answer } : f
    )
    setFaqs(updated)
    syncToStore(updated)
  }

  const syncToStore = (updated: typeof faqs) => {
    updateOnboarding({
      faqs: updated.map(({ question, answer, enabled }) => ({ question, answer, enabled })),
    })
  }

  const addCustomFaq = () => {
    if (!customQ.trim()) return
    const newFaq = {
      id: `custom-${Date.now()}`,
      question: customQ.trim(),
      answer: customA.trim(),
      enabled: true,
      icon: Bot,
    }
    const updated = [...faqs, newFaq]
    setFaqs(updated)
    syncToStore(updated)
    setCustomQ('')
    setCustomA('')
    setShowCustom(false)
  }

  const removeFaq = (id: string) => {
    const updated = faqs.filter((f) => f.id !== id)
    setFaqs(updated)
    syncToStore(updated)
  }

  const enabledCount = faqs.filter((f) => f.enabled).length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 rounded-full text-secondary text-sm font-accent font-semibold mb-3">
          <Bot className="w-4 h-4" />
          AI-Powered FAQ Setup
        </div>
        <h2 className="text-2xl font-heading font-bold text-primary">Smart FAQ Configuration</h2>
        <p className="text-text-secondary text-sm mt-1">
          Let AI handle customer questions — toggle what applies to your restaurant
        </p>
      </div>

      <Card padding="lg" className="space-y-4">
        <AnimatePresence>
          {faqs.map((faq, i) => {
            const Icon = faq.icon
            return (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/5 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">{faq.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {faq.id.startsWith('custom-') && (
                      <button
                        onClick={() => removeFaq(faq.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className={`relative w-12 h-6 rounded-full transition-all ${
                        faq.enabled ? 'bg-secondary' : 'bg-gray-200'
                      }`}
                    >
                      <motion.div
                        animate={{ x: faq.enabled ? 24 : 2 }}
                        className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-soft"
                      />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {faq.enabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-gray-50">
                        <div className="pt-3">
                          <label className="block text-xs font-accent font-semibold text-text-secondary mb-1.5">
                            Details for AI auto-response
                          </label>
                          <div className="relative">
                            <textarea
                              value={faq.answer}
                              onChange={(e) => updateAnswer(faq.id, e.target.value)}
                              placeholder={`Tell customers about ${faq.question.toLowerCase()}...`}
                              rows={2}
                              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm resize-none transition-all"
                            />
                            {faq.answer && (
                              <div className="absolute right-2 bottom-2">
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              </div>
                            )}
                          </div>
                          {!faq.answer && (
                            <button
                              onClick={() => {
                                const suggestions: Record<string, string> = {
                                  mpesa: 'Yes, we accept M-Pesa payments. Simply select M-Pesa at checkout and follow the prompt on your phone.',
                                  wifi: 'Yes, free WiFi is available for all customers. Ask our staff for the password.',
                                  reservations: 'Yes, we accept reservations. Please call us or book online through our website.',
                                  parking: 'Yes, we have ample parking space available for our customers.',
                                  delivery: 'Yes, we offer delivery through our platform and partner services.',
                                }
                                const suggestion = suggestions[faq.id] || `Yes, we offer ${faq.question.toLowerCase()}.`
                                updateAnswer(faq.id, suggestion)
                              }}
                              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-secondary to-accent text-white rounded-lg text-[10px] font-semibold hover:opacity-90 transition-opacity"
                            >
                              <Bot className="w-3 h-3" />
                              Let AI write
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {showCustom ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-50 rounded-xl p-4 space-y-3"
          >
            <input
              type="text"
              value={customQ}
              onChange={(e) => setCustomQ(e.target.value)}
              placeholder="e.g., Do you have vegetarian options?"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary outline-none text-sm transition-all"
              autoFocus
            />
            <textarea
              value={customA}
              onChange={(e) => setCustomA(e.target.value)}
              placeholder="Answer for AI (optional)"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary outline-none text-sm resize-none transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustom(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-text-secondary hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCustomFaq}
                disabled={!customQ.trim()}
                className="flex-1 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary-dark transition-colors disabled:opacity-50"
              >
                Add FAQ
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-text-secondary hover:border-secondary/50 hover:text-secondary transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Custom FAQ
          </button>
        )}
      </Card>

      {enabledCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 rounded-full text-success text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {enabledCount} FAQ{enabledCount !== 1 ? 's' : ''} active with AI auto-response
          </span>
        </motion.div>
      )}

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onPrev} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
