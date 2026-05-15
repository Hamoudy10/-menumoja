import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, MessageSquare, Send, User, Clock,
  ChevronDown, CheckCircle, AlertCircle, RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { SearchBar } from '@/components/ui/SearchBar'
import { showSuccessToast } from '@/components/ui/Toast'

interface Ticket {
  id: string
  subject: string
  restaurant: string
  owner: string
  status: 'open' | 'in_progress' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  assignedTo: string | null
  createdAt: string
  messages: { from: string; text: string; time: string }[]
}

const supportStaff = ['Grace Mwangi', 'Peter Kamau', 'Mary Wanjiku', 'Unassigned']

const initialTickets: Ticket[] = [
  {
    id: 'TKT-1001', subject: 'Unable to process M-Pesa payment', restaurant: 'Bahari Restaurant',
    owner: 'James Ochieng', status: 'open', priority: 'high', category: 'Payment',
    assignedTo: null, createdAt: '10 min ago',
    messages: [{ from: 'James Ochieng', text: 'My customers are unable to complete M-Pesa payments since yesterday. Getting timeout errors.', time: '10 min ago' }],
  },
  {
    id: 'TKT-1002', subject: 'Menu items not displaying correctly on mobile', restaurant: 'Savannah Bistro',
    owner: 'Grace Mwangi', status: 'in_progress', priority: 'medium', category: 'Technical',
    assignedTo: 'Peter Kamau', createdAt: '1 hour ago',
    messages: [
      { from: 'Grace Mwangi', text: 'Some menu items with special characters are not displaying correctly on mobile devices.', time: '1 hour ago' },
      { from: 'Peter Kamau', text: 'Looking into this. Can you share a screenshot of the affected items?', time: '45 min ago' },
    ],
  },
  {
    id: 'TKT-1003', subject: 'Billing discrepancy on invoice', restaurant: 'Coastal Delights',
    owner: 'Amina Hassan', status: 'resolved', priority: 'medium', category: 'Billing',
    assignedTo: 'Grace Mwangi', createdAt: '3 hours ago',
    messages: [
      { from: 'Amina Hassan', text: 'My invoice for this month shows KES 55,000 but I should be on the Business plan at KES 35,000.', time: '3 hours ago' },
      { from: 'Grace Mwangi', text: 'I checked your account. You were upgraded to Premium on Jan 1st. Would you like to downgrade back?', time: '2 hours ago' },
      { from: 'Amina Hassan', text: 'Oh I see, that makes sense. Please keep it as is, we want the extra features.', time: '1 hour ago' },
      { from: 'Grace Mwangi', text: 'Great! I\'ve marked this as resolved. Let us know if you need anything else.', time: '30 min ago' },
    ],
  },
  {
    id: 'TKT-1004', subject: 'QR codes not scanning', restaurant: 'Riverside Kitchen',
    owner: 'Sarah Wanjiku', status: 'open', priority: 'urgent', category: 'Technical',
    assignedTo: null, createdAt: '20 min ago',
    messages: [{ from: 'Sarah Wanjiku', text: 'Our QR codes on the table tents are not scanning properly. Customers are complaining. Need this fixed urgently!', time: '20 min ago' }],
  },
  {
    id: 'TKT-1005', subject: 'How to add staff accounts', restaurant: 'Mountain View Cafe',
    owner: 'Peter Njoroge', status: 'in_progress', priority: 'low', category: 'Account',
    assignedTo: 'Mary Wanjiku', createdAt: '1 day ago',
    messages: [
      { from: 'Peter Njoroge', text: 'I need to add 3 waiters to my account. How do I do that?', time: '1 day ago' },
      { from: 'Mary Wanjiku', text: 'Go to Settings > Staff Management and click "Add Staff". I can send you a guide if needed.', time: '20 hours ago' },
    ],
  },
  {
    id: 'TKT-1006', subject: 'Analytics data not updating', restaurant: 'The Golden Wok',
    owner: 'Li Wei', status: 'resolved', priority: 'medium', category: 'Technical',
    assignedTo: 'Peter Kamau', createdAt: '2 days ago',
    messages: [
      { from: 'Li Wei', text: 'My analytics dashboard has not updated since yesterday. It\'s stuck on old data.', time: '2 days ago' },
      { from: 'Peter Kamau', text: 'We had a data sync issue. It should be resolved now. Can you check?', time: '1 day ago' },
      { from: 'Li Wei', text: 'Yes, it\'s working now. Thank you!', time: '1 day ago' },
    ],
  },
]

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
}

export default function AdminSupport() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tickets, setTickets] = useState(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [showAssignDropdown, setShowAssignDropdown] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let data = [...tickets]
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(t => t.subject.toLowerCase().includes(q) || t.restaurant.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') data = data.filter(t => t.status === statusFilter)
    return data.sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 }
      return order[a.priority] - order[b.priority]
    })
  }, [tickets, search, statusFilter])

  const handleReply = () => {
    if (!replyText.trim() || !selectedTicket) return
    setTickets(prev => prev.map(t => {
      if (t.id !== selectedTicket.id) return t
      return {
        ...t,
        status: 'in_progress' as const,
        messages: [...t.messages, { from: 'Support Team', text: replyText, time: 'Just now' }],
      }
    }))
    setSelectedTicket(prev => prev ? {
      ...prev,
      status: 'in_progress' as const,
      messages: [...prev.messages, { from: 'Support Team', text: replyText, time: 'Just now' }],
    } : null)
    setReplyText('')
    showSuccessToast('Reply sent')
  }

  const handleAssign = (ticketId: string, staff: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t
      return { ...t, assignedTo: staff === 'Unassigned' ? null : staff }
    }))
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, assignedTo: staff === 'Unassigned' ? null : staff } : null)
    }
    setShowAssignDropdown(null)
    showSuccessToast(`Ticket assigned to ${staff}`)
  }

  const handleResolve = (ticketId: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t
      return { ...t, status: 'resolved' as const }
    }))
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status: 'resolved' as const } : null)
    }
    showSuccessToast('Ticket marked as resolved')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Support</h1>
          <p className="text-sm text-white/50">{tickets.filter(t => t.status !== 'resolved').length} open tickets</p>
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColors[ticket.priority]}`}>
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
                {ticket.assignedTo && (
                  <p className="text-xs text-secondary mt-1">Assigned to: {ticket.assignedTo}</p>
                )}
              </motion.button>
            ))}
            {filtered.length === 0 && (
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
                  <div className="relative">
                    <button
                      onClick={() => setShowAssignDropdown(showAssignDropdown === selectedTicket.id ? null : selectedTicket.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-xs transition-all"
                    >
                      {selectedTicket.assignedTo || 'Assign'} <ChevronDown className="w-3 h-3" />
                    </button>
                    <AnimatePresence>
                      {showAssignDropdown === selectedTicket.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute right-0 top-full mt-1 w-40 bg-primary border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden"
                        >
                          {supportStaff.map((staff) => (
                            <button
                              key={staff}
                              onClick={() => handleAssign(selectedTicket.id, staff)}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                selectedTicket.assignedTo === staff || (staff === 'Unassigned' && !selectedTicket.assignedTo)
                                  ? 'text-secondary bg-secondary/10'
                                  : 'text-white/70 hover:bg-white/5'
                              }`}
                            >
                              {staff}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                    disabled={!replyText.trim()}
                    className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-white disabled:opacity-40 transition-all hover:bg-secondary-dark"
                  >
                    <Send className="w-4 h-4" />
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
