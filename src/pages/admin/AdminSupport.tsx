import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MessageSquare, Send, User, Clock,
  ChevronDown, CheckCircle, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import * as adminApi from '@/api/admin'

interface Ticket {
  id: string
  subject: string
  restaurant: string
  owner: string
  status: 'open' | 'in_progress' | 'resolved'
  priority: string
  category: string
  createdAt: string
  messages: { from: string; text: string; time: string }[]
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
}

const normalize = (t: any): Ticket => ({
  id: t.id,
  subject: t.subject || 'Support ticket',
  restaurant: t.restaurant?.name || '—',
  owner: t.restaurant?.ownerName || '—',
  status: t.status || 'open',
  priority: t.priority || 'medium',
  category: t.category || 'General',
  createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString('en-KE') : '',
  messages: Array.isArray(t.messages) ? t.messages.map((m: any) => ({
    from: m.from || (m.isAdmin ? 'Support Team' : t.restaurant?.name || 'Owner'),
    text: m.text || m.message || '',
    time: m.createdAt ? new Date(m.createdAt).toLocaleString('en-KE') : '',
  })) : [],
})

export default function AdminSupport() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const load = async (status: string) => {
    setLoading(true)
    try {
      const params: any = {}
      if (status !== 'all') params.status = status
      const res: any = await adminApi.fetchSupportTickets(params)
      const data = Array.isArray(res) ? res : res?.data || res?.tickets || []
      const normalized = (data as any[]).map(normalize)
      setTickets(normalized)
      setSelectedTicket((prev: Ticket | null) => prev ? normalized.find(t => t.id === prev.id) || null : null)
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(statusFilter) }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let data = [...tickets]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(t => t.subject.toLowerCase().includes(q) || t.restaurant.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    }
    return data
  }, [tickets, search])

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTicket) return
    setSending(true)
    try {
      await adminApi.replySupportTicket(selectedTicket.id, replyText)
      await load(statusFilter)
      setReplyText('')
      showSuccessToast('Reply sent')
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const handleResolve = async (ticketId: string) => {
    setSending(true)
    try {
      await adminApi.closeSupportTicket(ticketId)
      await load(statusFilter)
      showSuccessToast('Ticket marked as resolved')
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || 'Failed to close ticket')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Support</h1>
          <p className="text-sm text-white/50">{loading ? 'Loading...' : `${tickets.filter(t => t.status !== 'resolved').length} open tickets`}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar placeholder="Search tickets by ID, subject, or restaurant..." value={search} onChange={setSearch} />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-primary-light border border-white/10 text-white/80 text-sm outline-none focus:border-secondary"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-primary-light border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <p className="text-xs text-white/40 font-accent font-semibold uppercase tracking-wider">
              Tickets ({filtered.length})
            </p>
          </div>
          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {filtered.map((ticket) => (
              <motion.button
                key={ticket.id}
                layout
                onClick={() => setSelectedTicket(ticket)}
                className={`w-full text-left p-4 transition-colors hover:bg-white/5 ${
                  selectedTicket?.id === ticket.id ? 'bg-white/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-accent text-white/30">{ticket.id}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[ticket.priority] || priorityColors.medium}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white mt-0.5 truncate">{ticket.subject}</p>
                  </div>
                  <Badge
                    variant={
                      ticket.status === 'open' ? 'warning' :
                      ticket.status === 'in_progress' ? 'info' : 'success'
                    }
                    size="sm"
                    dot
                  >
                    {ticket.status === 'in_progress' ? 'In Progress' : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {ticket.restaurant}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {ticket.createdAt}
                  </span>
                </div>
              </motion.button>
            ))}
            {loading && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-white/30 animate-spin mx-auto" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">No tickets found</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-primary-light border border-white/5 rounded-2xl flex flex-col">
          {selectedTicket ? (
            <>
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-accent text-white/30">{selectedTicket.id}</span>
                    <h3 className="text-sm font-semibold text-white mt-0.5">{selectedTicket.subject}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span>{selectedTicket.restaurant}</span>
                  <span>•</span>
                  <span>{selectedTicket.owner}</span>
                  <span>•</span>
                  <span>{selectedTicket.category}</span>
                </div>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
                {selectedTicket.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === 'Support Team' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 ${
                      msg.from === 'Support Team'
                        ? 'bg-secondary/20 text-white rounded-tr-md'
                        : 'bg-white/5 text-white/80 rounded-tl-md'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold opacity-70">{msg.from}</span>
                        <span className="text-[9px] opacity-40">{msg.time}</span>
                      </div>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {selectedTicket.messages.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-8">No messages yet</p>
                )}
              </div>

              <div className="p-4 border-t border-white/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-secondary placeholder:text-white/30"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-white disabled:opacity-40 transition-all hover:bg-secondary-dark"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {selectedTicket.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(selectedTicket.id)}
                      className="flex items-center gap-1 text-xs text-success hover:text-success/80 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark as resolved
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/50 text-sm">Select a ticket to view</p>
                <p className="text-white/30 text-xs mt-1">Choose from the list on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
