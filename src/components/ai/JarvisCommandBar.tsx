import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Sparkles, X, Send, Mic, Loader2, Check, XCircle, Undo2, ShieldAlert, Bot,
} from 'lucide-react'
import * as commandApi from '@/api/command'
import { showErrorToast, showInfoToast } from '@/components/ui/Toast'

/**
 * Phase B — the "Jarvis" command bar for restaurant admins.
 *
 * - Text or hold-to-talk voice (Groq Whisper via the server; graceful 503).
 * - Reads answer inline; writes render a confirmation card (never auto-run).
 * - Ambiguity renders option chips; the chosen option is sent as a follow-up
 *   with the original intent so the server can resolve it.
 * - Confirmed low-risk actions expose a short Undo window.
 *
 * This component is rendered only inside the owner dashboard layout, so staff
 * never see it (and the API rejects them with 403 regardless).
 */

type ProposalState = 'pending' | 'executing' | 'done' | 'rejected' | 'failed'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  kind?: 'answer' | 'clarify' | 'proposal' | 'refused' | 'error'
  data?: any
  options?: Array<{ id: string; label: string }>
  proposal?: commandApi.CommandProposal
  proposalState?: ProposalState
  undoUntil?: string
}

const SUGGESTIONS = ['Sales today', 'What stock is low?', 'Show open orders', 'Daily briefing']

function uid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
}

function errorMessage(error: any, fallback: string): string {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

export default function JarvisCommandBar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [now, setNow] = useState(Date.now())

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastIntentRef = useRef('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const mediaRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const wantRecordRef = useRef(false)

  const push = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const patch = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }, [])

  // ⌘/Ctrl+K toggles, Escape closes
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, transcribing])

  // Tick only while an undo window is visible.
  useEffect(() => {
    if (!messages.some((m) => m.undoUntil)) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [messages])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      setInput('')
      lastIntentRef.current = trimmed
      push({ id: uid(), role: 'user', text: trimmed })
      setSending(true)

      try {
        const result = await commandApi.sendCommand(trimmed, {
          conversationId,
          uiContext: { route: location.pathname },
        })
        if (result.conversationId) setConversationId(result.conversationId)

        if (result.kind === 'answer') {
          push({ id: uid(), role: 'assistant', kind: 'answer', text: result.reply, data: result.data })
        } else if (result.kind === 'refused') {
          push({ id: uid(), role: 'assistant', kind: 'refused', text: result.reply })
        } else if (result.kind === 'clarify') {
          push({
            id: uid(),
            role: 'assistant',
            kind: 'clarify',
            text: result.clarification.question || result.reply,
            options: result.clarification.options,
          })
        } else {
          push({
            id: uid(),
            role: 'assistant',
            kind: 'proposal',
            text: result.reply,
            proposal: result.proposal,
            proposalState: 'pending',
          })
        }
      } catch (error: any) {
        const status = error?.response?.status
        if (status === 403) {
          push({ id: uid(), role: 'assistant', kind: 'error', text: 'AI commands are limited to restaurant admins.' })
        } else {
          push({ id: uid(), role: 'assistant', kind: 'error', text: errorMessage(error, 'Something went wrong. Please try again.') })
        }
      } finally {
        setSending(false)
      }
    },
    [conversationId, location.pathname, push, sending]
  )

  const handleOption = (option: { label: string }) => {
    const intent = lastIntentRef.current
    const text = intent ? `${intent} (${option.label})` : option.label
    void send(text)
  }

  const confirmProposal = async (message: ChatMessage) => {
    if (!message.proposal) return
    patch(message.id, { proposalState: 'executing' })
    try {
      const result: any = await commandApi.confirmAction(message.proposal.id)
      patch(message.id, {
        proposalState: 'done',
        text: result?.message || 'Done.',
        undoUntil: result?.undoUntil,
      })
    } catch (error: any) {
      patch(message.id, {
        proposalState: 'failed',
        text: errorMessage(error, 'Could not apply this action.'),
      })
    }
  }

  const rejectProposal = async (message: ChatMessage) => {
    if (!message.proposal) return
    patch(message.id, { proposalState: 'rejected', text: 'Okay — I will not apply that.' })
    try {
      await commandApi.rejectAction(message.proposal.id)
    } catch {
      /* already reflected in the UI */
    }
  }

  const undoProposal = async (message: ChatMessage) => {
    if (!message.proposal) return
    try {
      const result: any = await commandApi.undoAction(message.proposal.id)
      patch(message.id, { text: result?.message || 'Undone.', undoUntil: undefined })
    } catch (error: any) {
      patch(message.id, { undoUntil: undefined, text: errorMessage(error, 'The undo window has passed.') })
    }
  }

  async function transcribeAndSend(blob: Blob) {
    setTranscribing(true)
    try {
      const form = new FormData()
      const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      form.append('audio', blob, `command.${extension}`)
      const result: any = await commandApi.transcribeAudio(form)
      const text = String(result?.text || '').trim()
      if (!text) {
        showErrorToast('I could not hear anything — please try again')
        return
      }
      await send(text)
    } catch (error: any) {
      if (error?.response?.status === 503) {
        setVoiceEnabled(false)
        showInfoToast('Voice is not set up yet — type your command instead')
      } else if (error?.response?.status === 403) {
        showErrorToast('AI commands are limited to restaurant admins')
      } else {
        showErrorToast(errorMessage(error, 'Could not transcribe the audio'))
      }
    } finally {
      setTranscribing(false)
    }
  }

  function startRecording() {
    if (!voiceEnabled || recording || transcribing || sending) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceEnabled(false)
      showInfoToast('Voice is not supported on this device — type instead')
      return
    }
    wantRecordRef.current = true

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!wantRecordRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        mediaRef.current = stream
        const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type)) || ''
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        chunksRef.current = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop())
          mediaRef.current = null
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
          chunksRef.current = []
          if (blob.size > 0) void transcribeAndSend(blob)
        }
        recorderRef.current = recorder
        recorder.start()
        setRecording(true)
      })
      .catch(() => {
        wantRecordRef.current = false
        showErrorToast('Microphone permission is required for voice commands')
      })
  }

  function stopRecording() {
    wantRecordRef.current = false
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    setRecording(false)
  }

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      mediaRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const renderAssistant = (message: ChatMessage) => {
    if (message.kind === 'proposal' && message.proposal) {
      const state = message.proposalState || 'pending'
      const undoRemaining = message.undoUntil ? Math.max(0, Math.ceil((new Date(message.undoUntil).getTime() - now) / 1000)) : 0
      return (
        <div key={message.id} className="space-y-2">
          <div className="rounded-2xl border border-secondary/30 bg-secondary/5 p-3 dark:border-secondary/40 dark:bg-secondary/10">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-accent font-semibold uppercase tracking-wide text-secondary">
              <ShieldAlert className="h-3.5 w-3.5" />
              {message.proposal.risk === 'high' ? 'Needs confirmation · high impact' : 'Needs confirmation'}
            </div>
            <p className="font-body text-sm text-text-primary dark:text-white">{message.proposal.summary}</p>

            {state === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void confirmProposal(message)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-accent font-semibold text-white hover:bg-secondary-dark"
                >
                  <Check className="h-3.5 w-3.5" /> Confirm
                </button>
                <button
                  onClick={() => void rejectProposal(message)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-xs font-accent font-medium text-text-secondary hover:bg-black/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            )}

            {state === 'executing' && (
              <p className="mt-3 flex items-center gap-2 text-xs text-text-secondary dark:text-white/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…
              </p>
            )}

            {(state === 'done' || state === 'failed' || state === 'rejected') && (
              <p className={`mt-2 text-sm ${state === 'done' ? 'text-success' : state === 'failed' ? 'text-danger' : 'text-text-secondary dark:text-white/60'}`}>
                {message.text}
              </p>
            )}

            {state === 'done' && message.undoUntil && undoRemaining > 0 && (
              <button
                onClick={() => void undoProposal(message)}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-accent font-medium text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo ({undoRemaining}s)
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div key={message.id} className="space-y-2">
        <div
          className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 font-body text-sm ${
            message.kind === 'error'
              ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
              : message.kind === 'refused'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                : 'border border-black/5 bg-white text-text-primary dark:border-white/10 dark:bg-primary-light dark:text-white'
          }`}
        >
          {message.text}
        </div>

        {message.options && message.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOption(option)}
                className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-xs font-accent font-medium text-secondary hover:bg-secondary/20"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {message.data !== undefined && (
          <details className="rounded-xl border border-black/5 bg-black/[0.02] p-2 text-[10px] text-text-secondary dark:border-white/10 dark:bg-white/5 dark:text-white/50">
            <summary className="cursor-pointer select-none font-accent font-medium">View data</summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(message.data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Floating pill */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-secondary px-4 py-3 font-accent text-sm font-semibold text-white shadow-warm hover:bg-secondary-dark"
        title="Ask Jarvis (Ctrl/Cmd+K)"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Jarvis</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed bottom-5 right-5 z-50 flex h-[min(640px,78vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-primary-light"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-primary to-primary-light px-4 py-3 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Bot className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-heading text-sm font-bold leading-tight">Menu Moja Jarvis</p>
                  <p className="font-accent text-[10px] text-white/50">Admin assistant · confirms before changes</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close Jarvis"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background-light p-4 dark:bg-background-dark">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="max-w-[92%] rounded-2xl border border-black/5 bg-white px-3.5 py-2.5 font-body text-sm text-text-primary dark:border-white/10 dark:bg-primary-light dark:text-white">
                    I'm Jarvis. Ask about sales, stock, tables or orders — or tell me to update the menu.
                    I'll always ask before I change anything.
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => void send(suggestion)}
                        className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-xs font-accent font-medium text-secondary hover:bg-secondary/20"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <p className="flex items-center gap-1 text-[10px] text-text-secondary dark:text-white/40">
                    <Sparkles className="h-3 w-3" /> Voice: hold the mic and speak (English / Kiswahili).
                  </p>
                </div>
              )}

              {messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl bg-secondary px-3.5 py-2.5 font-body text-sm text-white">
                      {message.text}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-start">
                    {renderAssistant(message)}
                  </div>
                )
              )}

              {(sending || transcribing) && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl border border-black/5 bg-white px-3.5 py-2.5 dark:border-white/10 dark:bg-primary-light">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary" />
                  </div>
                </div>
              )}

              {!voiceEnabled && (
                <p className="text-center text-[10px] text-text-secondary dark:text-white/40">
                  Voice isn't configured yet — type your command.
                </p>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-black/5 p-3 dark:border-white/10">
              {recording && (
                <p className="mb-2 flex items-center gap-1.5 text-xs font-accent text-red-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Listening… release to send
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(input)
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={recording ? 'Listening…' : 'Ask Jarvis…'}
                  maxLength={1000}
                  disabled={sending || transcribing}
                  className="min-w-0 flex-1 rounded-xl border border-black/10 bg-background-light px-3 py-2.5 font-body text-sm text-text-primary outline-none focus:border-secondary disabled:opacity-60 dark:border-white/10 dark:bg-background-dark dark:text-white"
                />
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId)
                    startRecording()
                  }}
                  onPointerUp={stopRecording}
                  onPointerCancel={stopRecording}
                  disabled={sending || transcribing}
                  title={voiceEnabled ? 'Hold to talk' : 'Voice not configured — type instead'}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
                    recording
                      ? 'bg-red-500 text-white'
                      : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20'
                  }`}
                >
                  {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-white transition-colors hover:bg-secondary-dark disabled:opacity-40"
                  title="Send"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
