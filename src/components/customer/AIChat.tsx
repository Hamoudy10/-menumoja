'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, MessageCircle, X, Send, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { MenuItem } from '@/types'

interface ChatMessage {
  id: string
  role: 'ai' | 'customer'
  text: string
  item?: MenuItem
}

const quickReplies = [
  { text: "What's popular?", key: 'popular' },
  { text: 'Vegetarian options?', key: 'veggie' },
  { text: 'Payment methods?', key: 'payment' },
]

function generateAIResponse(text: string, items: any[]): string {
  const lower = text.toLowerCase()
  if (lower.includes('popular') || lower.includes('best')) {
    const popular = items.filter((i) => i.isPopular)
    if (popular.length > 0) {
      return `Our most popular dishes right now: ${popular.slice(0, 3).map((i) => i.name).join(', ')}. Would you like to try any of these? 🔥`
    }
    return 'All our dishes are customer favorites! Let me suggest our Nyama Choma or Chicken Biryani 🍖'
  }
  if (lower.includes('vegetarian') || lower.includes('veggie') || lower.includes('vegan') || lower.includes('plant')) {
    const veg = items.filter((i) => i.dietaryTags.includes('Vegetarian') || i.dietaryTags.includes('Vegan'))
    if (veg.length > 0) {
      return `We have great vegetarian/vegan options: ${veg.slice(0, 3).map((i) => i.name).join(', ')}. All made with fresh local ingredients! 🌿`
    }
    return 'Our Vegetable Pilau and Kachumbari are excellent vegetarian choices! 🌿'
  }
  if (lower.includes('payment') || lower.includes('mpesa') || lower.includes('cash')) {
    return 'We accept M-Pesa (mobile money) and cash payments. M-Pesa is faster and more convenient! Just select at checkout. 📱'
  }
  if (lower.includes('spicy') || lower.includes('hot')) {
    return 'Our Chicken Biryani has a nice spicy kick! We can adjust the spice level - just add a note when ordering. 🌶️'
  }
  if (lower.includes('halal')) {
    return 'Yes, we are Halal certified! All our meat is sourced from certified halal suppliers. ✅'
  }
  if (lower.includes('time') || lower.includes('how long') || lower.includes('wait')) {
    return 'Most dishes take 10-25 minutes to prepare. We\'ll keep you updated on your order status! ⏱️'
  }
  if (lower.includes('mombasa') || lower.includes('coastal') || lower.includes('beach')) {
    return 'We bring the taste of Mombasa to your plate! Our recipes are inspired by authentic coastal Swahili cuisine. 🏖️'
  }
  return 'I\'d be happy to help! You can ask me about our popular dishes, ingredients, dietary options, payment methods, or anything else about our menu! 😊'
}

export function AIChat() {
  const { categories, addToCart, cart, language } = useStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'ai',
      text: language === 'sw'
        ? 'Karibu! Ninaweza kukusaidiaje leo? 😊'
        : language === 'ar'
          ? 'مرحباً! كيف يمكنني مساعدتك اليوم؟ 😊'
          : 'Welcome! How can I help you today? 😊',
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = categories.flatMap((c) => c.items)

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
    if (!text.trim()) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'customer', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    setTimeout(() => {
      const aiText = generateAIResponse(text, allItems)
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: aiText }

      if (text.toLowerCase().includes('popular') || text.toLowerCase().includes('best')) {
        const popular = allItems.filter((i) => i.isPopular)
        if (popular.length > 0) {
          aiMsg.item = popular[0]
        }
      } else if (text.toLowerCase().includes('vegetarian')) {
        const veg = allItems.filter((i) => i.dietaryTags.includes('Vegetarian'))
        if (veg.length > 0) aiMsg.item = veg[0]
      }

      setTyping(false)
      setMessages((prev) => [...prev, aiMsg])
    }, 1500 + Math.random() * 1000)
  }

  const handleQuickReply = (text: string) => {
    handleSend(text)
  }

  const handleAddToCart = (item: MenuItem) => {
    addToCart(item)
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'customer', text: `Add ${item.name} to my order` },
    ])
    const confirmMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      text: `✅ ${item.name} has been added to your order! You can review it in your cart.`,
    }
    setTimeout(() => setMessages((prev) => [...prev, confirmMsg]), 500)
  }

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-secondary shadow-warm text-white"
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
                <span className="font-heading text-sm font-bold">MenuMoja Assistant</span>
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
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-secondary/20 to-accent/20 text-lg">
                            {msg.item.categoryId === '1' ? '🍖' : msg.item.categoryId === '2' ? '🥟' : '🥤'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-text-primary truncate">{msg.item.name}</p>
                            <p className="text-xs font-bold text-secondary">{formatKES(msg.item.price)}</p>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => handleAddToCart(msg.item!)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-white"
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
                        onClick={() => handleQuickReply(qr.text)}
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
                  placeholder="Type a message..."
                  className="flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-body text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
