import { useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X, ChefHat, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import DashboardSidebar from './DashboardSidebar'
import { useStore } from '@/store/useStore'
import * as aiApi from '@/api/ai'

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { darkMode, fetchCategories, fetchOrders, fetchLiveOrders, fetchPayments, fetchTodaySummary, fetchTables, fetchStaff, fetchCameras, fetchNotifications } = useStore()

  useEffect(() => {
    fetchCategories()
    fetchOrders()
    fetchLiveOrders()
    fetchPayments()
    fetchTodaySummary()
    fetchTables()
    fetchStaff()
    fetchCameras()
    fetchNotifications()
  }, [])

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-background-dark' : 'bg-background-light'} flex`}>
      <div className="hidden lg:flex">
        <DashboardSidebar />
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 h-full"
            >
              <DashboardSidebar onClose={() => setMobileMenuOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-gray-100 dark:border-white/5 flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-primary">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-text-secondary dark:text-white/60"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-heading font-bold text-primary dark:text-white text-lg">Dashboard</span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <ChefAIAssistant />
    </div>
  )
}

function ChefAIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ id: string; role: string; text: string }[]>([
    { id: '1', role: 'ai', text: 'Habari! I\'m Chef AI. How can I help you run your restaurant today? 👨‍🍳' },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { id: Date.now().toString(), role: 'user', text: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)
    try {
      const { restaurant } = useStore.getState()
      const data = await aiApi.customerChat(restaurant?.id || '', 'dashboard', input.trim(), 'en')
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: data.reply || data.response || 'I\'m here to help!' }])
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: 'I can help you manage your menu, check orders, or answer questions about your restaurant!' }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-secondary shadow-warm text-white"
        animate={{ boxShadow: ['0 0 20px rgba(255,107,53,0.4)', '0 0 40px rgba(255,107,53,0.7)', '0 0 20px rgba(255,107,53,0.4)'] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChefHat className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
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
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen(false)}><X className="h-5 w-5" /></motion.button>
              </div>
              <div className="h-80 overflow-y-auto bg-[#e8ddd4] px-4 py-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-secondary text-white rounded-br-md' : 'bg-white text-text-primary rounded-bl-md shadow-sm'}`}>
                        <p className="font-body text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {typing && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (<motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} className="h-2 w-2 rounded-full bg-gray-400" />))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-100 bg-white dark:bg-primary-light px-4 py-3">
                <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex items-center gap-2">
                  <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Chef AI..." className="flex-1 rounded-2xl bg-gray-100 dark:bg-white/10 px-4 py-2.5 font-body text-sm text-text-primary dark:text-white outline-none placeholder:text-text-secondary/50" />
                  <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!input.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-white disabled:opacity-50"><Send className="h-4 w-4" /></motion.button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}


