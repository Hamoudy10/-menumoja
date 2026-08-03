import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, X, Send } from 'lucide-react'

interface Intent {
  keywords: string[]
  reply: string
}

const INTENTS: Intent[] = [
  {
    keywords: ['pricing', 'price', 'cost', 'plans', 'plan', 'subscription', 'monthly', 'package', 'commission', 'fee'],
    reply: 'MenuMoja pricing is simple — you only pay when you sell:\n\n🔧 One-time setup: KES 5,000 (QR codes, menu built, staff trained)\n💸 Commission: 5% of sales made through the system\n🛡️ Monthly cap: never more than KES 10,000/month\n\nNo monthly subscription, no lock-in, and M-Pesa money goes straight to YOUR till. A restaurant doing KES 200,000/month in orders pays the KES 10,000 cap — small sales pay even less, no sales pay nothing! 🚀',
  },
  {
    keywords: ['features', 'feature', 'what can', 'does it do', 'capabilit', 'capab'],
    reply: 'MenuMoja gives your restaurant superpowers:\n\n📱 QR digital menus (scan-to-order)\n🤖 Chef AI assistant for customers\n💳 M-Pesa, card & cash payments with ETR receipts\n🍽️ Table & floor management\n👨‍🍳 Kitchen display + waiter tools\n📊 Smart analytics & revenue reports\n📣 Promotions, specials & offers\n🎥 Optional camera surveillance\n🌍 English, Swahili & Arabic support\n\nWhich one would you like to know more about?',
  },
  {
    keywords: ['demo', 'try', 'sample', 'preview', 'show me'],
    reply: 'You can try our interactive demo right now — click the "Watch Demo" button on the homepage to see MenuMoja in action. You can also start a free account and explore the dashboard yourself! 🎯',
  },
  {
    keywords: ['start', 'sign up', 'signup', 'register', 'get started', 'begin', 'create account', 'how to use', 'setup', 'set up'],
    reply: 'Getting started is easy:\n\n1️⃣ Click "Start Free Today" (no credit card needed)\n2️⃣ Create your restaurant profile in ~30 seconds\n3️⃣ Add your menu with our smart AI tools\n4️⃣ Print your QR codes and start taking orders!\n\nYou can be live today! 🚀',
  },
  {
    keywords: ['swahili', 'kiswahili', 'language', 'arabic', 'translation', 'translate'],
    reply: 'Ndiyo! MenuMoja inasaidia lugha tatu: Kiswahili, English, na Arabic. 🇰🇪 Customers can switch languages on the menu, and your items can have translated names and descriptions!',
  },
  {
    keywords: ['payment', 'mpesa', 'm-pesa', 'm pesa', 'mobile money', 'pay', 'cash', 'card'],
    reply: 'MenuMoja handles payments end-to-end:\n\n💵 Cash payments with ETR receipts (KRA-compliant)\n📱 M-Pesa STK push direct to your till number\n💳 Card payments\n🧾 Automatic receipts, change calculation & shift reconciliation\n\nEvery payment is tracked in real-time analytics!',
  },
  {
    keywords: ['qr', 'menu', 'scan', 'scanner', 'digital menu'],
    reply: 'With MenuMoja, every table gets its own QR code. Customers scan, browse your digital menu in their language, and order straight from their phone — no app download needed. You can also print a main QR for walk-ins and takeaway! 📱',
  },
  {
    keywords: ['order', 'ordering', 'order online', 'takeaway', 'delivery'],
    reply: 'Customers can order from their phones via QR, or your staff can take orders on the POS. Orders flow straight to the kitchen display, waiters get notified when food is ready, and everything syncs live across devices. ⚡',
  },
  {
    keywords: ['analytics', 'report', 'insights', 'dashboard', 'statistics', 'revenue', 'sales'],
    reply: 'Our analytics dashboard shows live revenue, orders, popular dishes, hourly trends, payment breakdowns and QR scan stats — plus exportable reports. Know exactly what\'s selling and when! 📊',
  },
  {
    keywords: ['ai', 'assistant', 'chat', 'artificial', 'chef'],
    reply: 'MenuMoja AI is built in!\n\n👨‍🍳 Chef AI answers customer questions on the menu (ingredients, allergens, recommendations)\n✍️ AI writes your menu descriptions and generates images\n🎯 AI suggests promotions and social posts\n\nIt saves hours of work every week! 🤖',
  },
  {
    keywords: ['camera', 'surveillance', 'cctv', 'security', 'monitor'],
    reply: 'The Premium plan includes camera surveillance — stream live cameras, get AI food-quality alerts, and keep an eye on the kitchen and dining area from your dashboard. 🎥',
  },
  {
    keywords: ['staff', 'waiter', 'cashier', 'kitchen', 'employees', 'team'],
    reply: 'MenuMoja has dedicated apps for your team:\n\n👨‍🍳 Kitchen display with order timers\n🍽️ Waiter dashboard with floor plan\n💼 POS cashier with number pad, splits & receipts\n\nStaff log in with their own PIN — everyone sees live updates!',
  },
  {
    keywords: ['support', 'help', 'contact', 'reach', 'assistance', 'problem'],
    reply: 'We\'re here for you! You can reach the MenuMoja team via the contact form on this site, email, or WhatsApp — and the in-app Help center has guides, FAQs and video tutorials. We typically reply within a few hours! 💬',
  },
  {
    keywords: ['about', 'company', 'who', 'team', 'behind'],
    reply: 'MenuMoja is a Kenyan-built restaurant technology platform. We help restaurants go digital with QR menus, online ordering and payments — made for the way Kenyan restaurants actually work. 🇰🇪',
  },
  {
    keywords: ['security', 'safe', 'privacy', 'data', 'secure'],
    reply: 'Your data is safe with us — secure authentication, role-based access for staff, encrypted connections, and cloud backups. You own your data, and you can export it anytime. 🔒',
  },
  {
    keywords: ['compare', 'comparison', 'competitor', 'other apps', 'better than', 'why menu', 'why us'],
    reply: 'Why restaurants choose MenuMoja:\n\n✅ Built for Kenya — M-Pesa, KRA ETR receipts, Swahili support\n✅ All-in-one: menu, ordering, payments, analytics, staff & AI\n✅ No hardware or app downloads needed\n✅ Affordable plans that pay for themselves\n✅ Local support that actually picks up!',
  },
  {
    keywords: ['integration', 'whatsapp', 'social', 'instagram', 'facebook'],
    reply: 'MenuMoja integrates with the tools you already use — WhatsApp sharing for menus and orders, AI-generated social media posts for Instagram/Facebook, and more coming soon! 🔗',
  },
  {
    keywords: ['free', 'trial', 'cancel', 'refund'],
    reply: 'You can start with a free trial — no credit card required. Upgrade to a paid plan only when you\'re ready, and cancel anytime. Your menu and data are always yours! ✅',
  },
  {
    keywords: ['thanks', 'thank', 'asante', 'shukran'],
    reply: 'Karibu sana! 😊 Happy to help — if you have any other questions about MenuMoja, just ask!',
  },
  {
    keywords: ['hi', 'hello', 'hey', 'jambo', 'habari', 'sasa', 'how are you', 'good morning', 'good evening'],
    reply: 'Hello! 👋 I\'m MenuMoja AI, your restaurant assistant. Ask me about our features, pricing, demo, or how to get started — or anything else about how MenuMoja can help your business!',
  },
  {
    keywords: ['hardware', 'equipment', 'device', 'tablet', 'phone', 'printer', 'internet', 'wifi', 'offline'],
    reply: 'MenuMoja works on anything with a browser — phones, tablets, laptops or a desktop PC. No special hardware needed! A small receipt printer is optional for the cashier (we support standard 80mm thermal printers), and a stable internet connection is enough. Orders also keep working through brief connection drops. 🖥️',
  },
  {
    keywords: ['print', 'receipt', 'etr', 'kra', 'tax', 'vat', 'invoice', 'cashier'],
    reply: 'The POS generates KRA-compliant ETR receipts automatically — with your business PIN, serial numbers and VAT breakdown. Receipts can be printed on 80mm thermal printers, re-printed anytime from the receipts history, and cashier shifts are reconciled automatically. 🧾',
  },
  {
    keywords: ['customize', 'customization', 'branding', 'brand', 'logo', 'color', 'colour', 'theme', 'appearance', 'design'],
    reply: 'You can fully brand your digital menu — your logo, cover photo, brand colors, fonts and gradient themes. Changes go live instantly on your customer-facing menu. 🎨',
  },
  {
    keywords: ['url', 'domain', 'link', 'website', 'vercel', 'hosting'],
    reply: 'Every restaurant gets its own public menu link (e.g. menu.menumoja.app/your-restaurant) plus QR codes for tables and walk-ins. No website skills needed — we handle the hosting! 🔗',
  },
  {
    keywords: ['pin', 'password', 'login', 'access', 'permission', 'roles', 'authorize'],
    reply: 'MenuMoja has role-based access — owners, managers, waiters, cashiers and kitchen staff each log in with their own credentials and only see what they need. Keep staff accountable with full audit trails. 🔐',
  },
  {
    keywords: ['backup', 'export', 'data', 'csv', 'excel', 'download', 'restore'],
    reply: 'Your data is backed up in the cloud automatically. You can also export orders, payments and reports to CSV/Excel anytime — your data is always yours. 💾',
  },
  {
    keywords: ['branch', 'branches', 'locations', 'multiple', 'outlet', 'chain', 'franchise'],
    reply: 'MenuMoja supports multiple branches — each location can have its own menu, tables, staff and reports, while you see everything across your business from one dashboard. 🏢',
  },
  {
    keywords: ['update', 'roadmap', 'coming soon', 'new features', 'version', 'upgrade'],
    reply: 'We ship new features regularly — recent additions include the Chef AI chat, promotions engine, floor-plan editor and receipt tracking. Your account gets every update automatically, no re-installation needed. 🚀',
  },
  {
    keywords: ['reserve', 'reservation', 'booking', 'table booking'],
    reply: 'Customers can reserve tables through your digital menu, and reservations appear in your dashboard so your team can prepare ahead. 🪑',
  },
  {
    keywords: ['notification', 'alert', 'sms', 'whatsapp', 'push'],
    reply: 'You and your staff get instant notifications for new orders, payments and ready dishes — on the dashboard and via the staff apps. WhatsApp and SMS integrations are available too. 🔔',
  },
  {
    keywords: ['refund', 'void', 'cancel', 'reversal', 'tip', 'service charge', 'discount'],
    reply: 'The POS handles everyday money situations — discounts, tips, service charges, split bills, voids with reasons, and full order cancellations — all recorded in the audit trail. 💰',
  },
  {
    keywords: ['hotel', 'bar', 'cafe', 'café', 'fast food', 'food truck', 'kiosk', 'guest house', 'type of restaurant'],
    reply: 'MenuMoja is built for all kinds of food businesses — restaurants, hotels, bars, cafés, fast food, food trucks and kiosks. The menu, floor plan, kitchen and POS adapt to how you work. 🍽️',
  },
  {
    keywords: ['whatsapp order', 'social media order', 'instagram order', 'facebook order'],
    reply: 'Customers can share your menu on WhatsApp, and you can generate AI posts for Instagram and Facebook to drive orders. The QR menu makes it effortless for customers to order from anywhere. 📲',
  },
]

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return dp[m][n]
}

function fuzzyIncludes(text: string, keyword: string): boolean {
  if (keyword.length <= 4) {
    if (new RegExp(`\\b${keyword}\\b`).test(text)) return true
  } else if (text.includes(keyword)) {
    return true
  }
  const words = text.split(/\s+/)
  const threshold = keyword.length >= 8 ? 2 : keyword.length >= 5 ? 1 : 0
  if (threshold === 0) return false
  return words.some((w) => {
    const stemmed = w.replace(/(ing|ed|es|s)$/, '')
    const kwStemmed = keyword.replace(/(ing|ed|es|s)$/, '')
    if (stemmed === kwStemmed) return true
    return levenshtein(w, keyword) <= threshold || levenshtein(stemmed, kwStemmed) <= threshold
  })
}

function generateGeneralReply(input: string): string | null {
  if (/(thanks|thank you|asante|shukran)/.test(input)) {
    return 'Karibu sana! 😊 Happy to help — if you have any other questions about MenuMoja, just ask!'
  }
  if (/(joke|funny|make me laugh)/.test(input)) {
    return 'Why did the restaurant\'s website apply for a job? Because it wanted to improve its server skills! 😄 Speaking of servers — MenuMoja\'s are fast and reliable, just like our jokes. Ask me about the features anytime!'
  }
  if (/(weather|rain|sunny|hot today|cold)/.test(input)) {
    return 'I can\'t check the live forecast, but here\'s a hot tip 🌦️ — whatever the weather, restaurants using MenuMoja keep serving because orders come straight to the kitchen display. Ask me about our features while you\'re here!'
  }
  if (/(capital of|who is|what is the|history of|recipe for|how to cook|interesting fact|trivia)/.test(input)) {
    return 'That\'s a fun general-knowledge question! 🤔 My specialty is everything about MenuMoja — features, pricing, demo, payments, staff tools and AI — but I\'m happy to chat. Ask me "what are the features" or "how much does it cost"!'
  }
  const math = input.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/x])\s*(-?\d+(?:\.\d+)?)/)
  if (math && /^[0-9+\-*/x. ]+$/.test(math[0].replace(/ /g, ''))) {
    const a = parseFloat(math[1])
    const b = parseFloat(math[3])
    const op = math[2]
    const val = op === '+' ? a + b : op === '-' ? a - b : (op === 'x' || op === '*') ? a * b : b !== 0 ? a / b : null
    if (val !== null) return `${a} ${op} ${b} = ${val} 😊 Anything else you'd like to know about MenuMoja?`
  }
  if (/how are you|how's it going|doing well|how do you do/.test(input)) {
    return 'I\'m doing great, thank you! ⚡ Always online and ready to help with everything MenuMoja — features, pricing, demo or getting started. What would you like to know?'
  }
  return null
}

function generateReply(input: string): string {
  const normalized = input.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const general = generateGeneralReply(normalized)
  if (general) return general
  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => fuzzyIncludes(normalized, kw))) {
      return intent.reply
    }
  }
  return 'Great question! I can tell you about our features, pricing plans, free demo, getting started, payments, staff tools or AI features — or just chat! What would you like to explore? 😊'
}

export function ChefAIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ id: string; role: string; text: string }[]>([
    { id: '1', role: 'ai', text: 'Habari! 👋 I\'m MenuMoja AI, your restaurant assistant. Ask me how MenuMoja can help your business!' },
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
      const reply = generateReply(input)
      setTyping(false)
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: reply }])
    }, 1000)
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
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
        title="MenuMoja AI"
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
                  <div>
                    <span className="font-heading text-sm font-bold block">MenuMoja AI</span>
                    <span className="text-[10px] opacity-80">Online — answers instantly</span>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <div className="h-80 overflow-y-auto bg-[#e8ddd4] px-4 py-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 ${
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
                    placeholder="Ask about features, pricing, demo..."
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
