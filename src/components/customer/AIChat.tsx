'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, X, Send, Plus, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { customerChat } from '@/api/ai'

interface ChatMessage {
  id: string
  role: 'ai' | 'customer'
  text: string
  item?: ChatItem
}

interface ChatItem {
  id: string
  name: string
  price: number
  photoUrl?: string | null
}

interface AIChatProps {
  restaurantId?: string
  menuItems?: ChatItem[]
}

const defaultQuickReplies = [
  { text: "What's popular?", key: 'popular' },
  { text: 'Vegetarian options?', key: 'veggie' },
  { text: 'Payment methods?', key: 'payment' },
]

function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function AIChat({ restaurantId, menuItems = [] }: AIChatProps) {
  const { addToCart, language } = useStore()
  const greeting = language === 'sw'
    ? 'Karibu! Ninaweza kukusaidiaje leo? 😊'
    : language === 'ar'
      ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟ 😊'
      : 'Welcome! I am your chef assistant — ask me about the menu, ingredients, allergens, recommendations or payment! 😊'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'ai', text: greeting },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [quickReplies, setQuickReplies] = useState(defaultQuickReplies)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<string>('')
  const idRef = useRef(0)

  const nextId = () => `${++idRef.current}`

  useEffect(() => {
    if (!restaurantId) return
    const stored = sessionStorage.getItem(`chefSession_${restaurantId}`)
    if (stored) sessionRef.current = stored
    else {
      sessionRef.current = makeSessionId()
      sessionStorage.setItem(`chefSession_${restaurantId}`, sessionRef.current)
    }
  }, [restaurantId])

  const itemMap = useCallback(() => {
    const map = new Map<string, ChatItem>()
    menuItems.forEach((i) => map.set(i.id, i))
    return map
  }, [menuItems])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, typing, scrollToBottom])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  const handleSend = async (text: string) => {
    if (!text.trim() || typing || !restaurantId) return

    const userMsg: ChatMessage = { id: nextId(), role: 'customer', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    try {
      const res = await customerChat(
        restaurantId,
        sessionRef.current || makeSessionId(),
        text.trim(),
        language === 'sw' ? 'sw' : 'en'
      )
      const aiMsg: ChatMessage = {
        id: nextId(),
        role: 'ai',
        text: res.reply || 'I am not sure about that one — try asking the staff! 😊',
      }
      if (res.suggestedItems?.length) {
        const map = itemMap()
        const found = res.suggestedItems
          .map((ref: string) => {
            const byId = map.get(ref)
            if (byId) return byId
            const needle = ref.trim().toLowerCase()
            return menuItems.find((i) => i.name.toLowerCase() === needle || i.name.toLowerCase().includes(needle))
          })
          .filter((i: ChatItem | undefined): i is ChatItem => Boolean(i))
        if (found.length > 0) aiMsg.item = found[0]
      }
      if (res.quickReplies?.length) {
        setQuickReplies(res.quickReplies.map((q: string, i: number) => ({ text: q, key: `qr-${i}` })))
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'ai',
          text: language === 'sw'
            ? 'Samahani, nina shida ya kiufundi. Tafadhali jaribu tena.'
            : 'Sorry, I hit a technical hiccup — please try again in a moment.',
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  const handleAddToCart = (item: ChatItem) => {
    addToCart(item)
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'customer', text: `Add ${item.name} to my order` },
    ])
    const confirmMsg: ChatMessage = {
      id: nextId(),
      role: 'ai',
      text: `✅ ${item.name} has been added to your order! You can review it in your cart.`,
    }
    setTimeout(() => setMessages((prev) => [...prev, confirmMsg]), 500)
  }

  const formatKES = (amount: number) => `KES ${Number(amount).toLocaleString('en-KE')}`

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary shadow-warm text-white"
        animate={{
          boxShadow: [
            '0 0 20px rgba(255,107,53,0.4)',
            '0 0 40px rgba(255,107,53,0.7)',
            '0 0 20px rgba(255,107,53,0.4)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        title="Ask the chef"
      >
        <ChefHat className="h-6 w-6" />
        <motion.span
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success border-2 border-white"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col bg-white"
          >
            <div className="flex items-center justify-between bg-secondary px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                <div>
                  <span className="font-heading text-sm font-bold block">Chef Assistant</span>
                  <span className="text-[10px] opacity-80">Ask about our menu — instant answers</span>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#e8ddd4] px-4 py-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'customer'
                          ? 'bg-secondary text-white rounded-br-md'
                          : 'bg-white text-text-primary rounded-bl-md shadow-sm'
                      }`}
                    >
                      <p className="font-body text-sm leading-relaxed">{msg.text}</p>
                      {msg.item && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 flex items-center gap-2 rounded-xl bg-gray-50 p-2"
                        >
                          <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center">
                            {msg.item.photoUrl ? (
                              <img src={msg.item.photoUrl} alt={msg.item.name} className="w-full h-full object-cover" />
                            ) : (
                              <ChefHat className="w-5 h-5 text-secondary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-text-primary truncate">{msg.item.name}</p>
                            <p className="text-xs font-bold text-secondary">{formatKES(msg.item.price)}</p>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => { if (msg.item) handleAddToCart(msg.item) }}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-white shrink-0"
                            title="Add to cart"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </motion.button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {typing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
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
                  </motion.div>
                )}

                {messages.length === 1 && !typing && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickReplies.map((qr) => (
                      <motion.button
                        key={qr.key}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSend(qr.text)}
                        className="rounded-full border border-secondary/30 bg-white px-4 py-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary/5"
                      >
                        {qr.text}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-gray-100 bg-white px-4 py-3">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(input) }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about a dish, ingredients, allergens..."
                  className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-body text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-white disabled:opacity-50"
                >
                  {typing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
