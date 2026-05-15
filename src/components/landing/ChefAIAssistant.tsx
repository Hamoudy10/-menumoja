import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, X, Send } from 'lucide-react'

export function ChefAIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ id: string; role: string; text: string }[]>([
    { id: '1', role: 'ai', text: 'Habari! 👨‍🍳 I\'m Chef AI, your restaurant assistant. Ask me how MenuMoja can help your business!' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { id: Date.now().toString(), role: 'user', text: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      const lower = input.toLowerCase()
      let reply = ''
      if (lower.includes('pricing') || lower.includes('price') || lower.includes('cost')) {
        reply = 'We offer three plans: Starter (KES 1,500/mo), Business (KES 2,500/mo), and Premium (KES 5,000/mo). Each includes QR menus, ordering, and M-Pesa payments!'
      } else if (lower.includes('feature') || lower.includes('what')) {
        reply = 'MenuMoja gives you QR digital menus, AI ordering assistant, M-Pesa payments, smart analytics, camera surveillance, and AI marketing tools!'
      } else if (lower.includes('demo')) {
        reply = 'You can try our interactive demo right now! Click the "Watch Demo" button on our homepage to see how it works. 🎯'
      } else if (lower.includes('sign') || lower.includes('start') || lower.includes('register')) {
        reply = 'Getting started is easy! Click "Start Free Today" — no credit card required. You\'ll be up and running in 30 seconds! 🚀'
      } else if (lower.includes('swahili') || lower.includes('kiswahili') || lower.includes('language')) {
        reply = 'Ndiyo! MenuMoja inasaidia Kiswahili, English, na Arabic. Wateja wako wanaweza kubadilisha lugha kwa urahisi. 🇰🇪'
      } else {
        reply = 'I can tell you about our pricing, features, demo, or how to get started! What would you like to know? 😊'
      }
      setTyping(false)
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: reply }])
    }, 1200)
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 300) }}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary shadow-warm text-white"
        animate={{
          boxShadow: [
            '0 0 20px rgba(255,107,53,0.4)',
            '0 0 40px rgba(255,107,53,0.7)',
            '0 0 20px rgba(255,107,53,0.4)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChefHat className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 rounded-2xl bg-white dark:bg-primary-light border border-white/10 shadow-soft overflow-hidden"
            >
              <div className="flex items-center justify-between bg-secondary px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5" />
                  <span className="font-heading text-sm font-bold">Chef AI</span>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <div className="h-80 overflow-y-auto bg-[#e8ddd4] px-4 py-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-secondary text-white rounded-br-md'
                          : 'bg-white text-text-primary rounded-bl-md shadow-sm'
                      }`}>
                        <p className="font-body text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {typing && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                              className="h-2 w-2 rounded-full bg-gray-400"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 bg-white dark:bg-primary-light px-4 py-3">
                <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything..."
                    className="flex-1 rounded-2xl bg-gray-100 dark:bg-white/10 px-4 py-2.5 font-body text-sm text-text-primary dark:text-white outline-none placeholder:text-text-secondary/50"
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={!input.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}