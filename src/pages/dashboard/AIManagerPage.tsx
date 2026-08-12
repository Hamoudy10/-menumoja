import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, RefreshCw, TrendingUp, Trophy, Percent, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { showErrorToast } from '@/components/ui/Toast'
import * as aiApi from '@/api/ai'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  source?: 'llm' | 'tool'
}

const SUGGESTED_QUESTIONS = [
  'How did we perform this month?',
  'What is our most profitable dish?',
  'Which stock is running low?',
  'How many customers came back?',
  'Who served the most orders?',
  'Forecast next week sales',
]

const BRIEFING_ICONS: Record<string, React.ReactNode> = {
  revenue: <TrendingUp className="h-4 w-4" />,
  top_seller: <Trophy className="h-4 w-4" />,
  margin: <Percent className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  comparison: <TrendingUp className="h-4 w-4" />,
  note: <Info className="h-4 w-4" />,
}

export default function AIManagerPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [briefing, setBriefing] = useState<any>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true)
    try {
      const data = await aiApi.getManagerBriefing()
      setBriefing(data)
    } catch { showErrorToast('Failed to load briefing') }
    finally { setBriefingLoading(false) }
  }, [])

  useEffect(() => { loadBriefing() }, [loadBriefing])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const ask = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || asking) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setAsking(true)
    try {
      const res = await aiApi.askManager(question)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, source: res.source }])
    } catch { showErrorToast('Failed to get an answer') }
    finally { setAsking(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary dark:text-white">AI Restaurant Manager</h1>
          <p className="font-body text-sm text-text-secondary dark:text-white/50">Ask about your sales, profitability, stock, customers, staff, campaigns and forecasts — answered only from your real data</p>
        </div>
        <button onClick={loadBriefing} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-text-secondary" title="Refresh briefing">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Daily briefing */}
      <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-secondary" />
          <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white">Daily Briefing</h2>
          {briefing && <span className="text-xs text-text-secondary">· {briefing.date}</span>}
        </div>
        {briefingLoading ? (
          <Skeleton variant="card" className="h-32" />
        ) : briefing && briefing.insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {briefing.insights.map((insight: any, i: number) => (
              <div key={i} className={`rounded-xl p-3.5 ${insight.type === 'warning' ? 'bg-red-500/10 border border-red-500/20' : insight.type === 'note' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-black/5 dark:bg-white/5'}`}>
                <p className={`font-accent text-sm font-bold flex items-center gap-2 ${insight.type === 'warning' ? 'text-red-500' : insight.type === 'note' ? 'text-amber-600 dark:text-amber-400' : 'text-text-primary dark:text-white'}`}>
                  {BRIEFING_ICONS[insight.type]} {insight.title}
                </p>
                <p className="text-xs text-text-secondary mt-1.5">{insight.reason}</p>
                <p className="text-[10px] text-text-secondary/70 mt-1">Source: {insight.source}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No briefing available — check your order data.</p>
        )}
      </div>

      {/* Chat */}
      <div className="rounded-2xl bg-white dark:bg-primary-light border border-white/10 p-5">
        <h2 className="font-heading text-lg font-bold text-text-primary dark:text-white mb-3">Ask the Manager</h2>

        <div className="space-y-3 max-h-[420px] overflow-y-auto mb-4 pr-1">
          {messages.length === 0 && (
            <div>
              <p className="text-xs text-text-secondary mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => ask(q)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-secondary text-white' : 'bg-black/5 dark:bg-white/10 text-text-primary dark:text-white'
              }`}>
                {m.content}
                {m.role === 'assistant' && m.source === 'tool' && (
                  <p className="text-[10px] text-text-secondary mt-1">Answering from structured data (AI skipped for reliability/cost)</p>
                )}
              </div>
            </motion.div>
          ))}
          {asking && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-black/5 dark:bg-white/10 px-4 py-2.5 flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="e.g. What should I promote tonight?"
          />
          <Button onClick={() => ask()} loading={asking}><Send className="h-4 w-4" /></Button>
        </div>
        <p className="text-[10px] text-text-secondary mt-2">The manager only answers from your real data — it never invents numbers. When the AI is unavailable or over budget, it returns the structured data directly.</p>
      </div>
    </div>
  )
}
