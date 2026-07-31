import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, CreditCard, Banknote, Smartphone, CheckCircle, Clock,
  Receipt, Calculator, ShoppingBag, X, ChevronDown, LogOut, Coffee, ArrowRight,
  Loader2, Hash, User, Printer, Plus, Minus, Trash2, RotateCcw,
  GripVertical, Fullscreen, SplitSquareVertical, MessageSquare, Sparkles,
  HeartHandshake, Percent, AlertTriangle, Undo2, Eye, List, Map,
  Music, Volume2, Settings2, Star, ScrollText
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { showSuccessToast, showErrorToast } from '@/components/ui/Toast'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'
import * as ordersApi from '@/api/orders'
import * as paymentsApi from '@/api/payments'
import * as tablesApi from '@/api/tables'
import NumberPad from '@/components/pos/NumberPad'
import FloorCanvas from '@/components/floor/FloorCanvas'

const ITEMS_PER_PAGE = 20

export default function CashierDashboard() {
  const navigate = useNavigate()
  const { restaurant } = useStore()
  const staffName = localStorage.getItem('staffName') || 'Cashier'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playSound, setPlaySound] = useState(true)

  const handleSignOut = () => {
    localStorage.removeItem('staffAccessToken')
    localStorage.removeItem('staffRefreshToken')
    localStorage.removeItem('staffRole')
    localStorage.removeItem('staffName')
    localStorage.removeItem('staffId')
    localStorage.removeItem('staffRestaurantSlug')
    navigate('/login')
  }

  const [orders, setOrders] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTable, setFilterTable] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'paid' | 'receipts'>('pending')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash')
  const [discount, setDiscount] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastPayment, setLastPayment] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [isTableGrid, setIsTableGrid] = useState(false)
  const [showNumberPad, setShowNumberPad] = useState<'cash' | 'discount' | null>(null)
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [cashierNote, setCashierNote] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [serviceChargePercent, setServiceChargePercent] = useState('')
  const [heldOrders, setHeldOrders] = useState<any[]>([])
  const [showHeldModal, setShowHeldModal] = useState(false)
  const [editingItems, setEditingItems] = useState(false)
  const [editItemQty, setEditItemQty] = useState<Record<string, number>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOrderTable, setNewOrderTable] = useState('')
  const [newOrderCustomer, setNewOrderCustomer] = useState('')
  const [newOrderItems, setNewOrderItems] = useState<any[]>([])
  const [newOrderSearch, setNewOrderSearch] = useState('')
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false)
  const [searchHighlight, setSearchHighlight] = useState('')
  const [receipts, setReceipts] = useState<any[]>([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [receiptFrom, setReceiptFrom] = useState('')
  const [receiptTo, setReceiptTo] = useState('')
  const [receiptMethod, setReceiptMethod] = useState('')
  const [receiptTable, setReceiptTable] = useState('')
  const [receiptQuery, setReceiptQuery] = useState('')
  const [receiptSearchInput, setReceiptSearchInput] = useState('')
  const [receiptPage, setReceiptPage] = useState(1)
  const [receiptHasMore, setReceiptHasMore] = useState(false)

  const soundRef = useRef<HTMLAudioElement | null>(null)
  const posRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    soundRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+Af39/gIB/f39/gH9/f4CAf39/f4B/f3+AgH9/f3+Af39/gIB/f39/gH9/f4B/f3+AgICAgICA')
  }, [])

  const playKaChing = useCallback(() => {
    if (playSound && soundRef.current) {
      soundRef.current.currentTime = 0
      soundRef.current.play().catch(() => {})
    }
  }, [playSound])

  const fetchOrders = async () => {
    try {
      const [ordersRes, summaryRes] = await Promise.all([
        ordersApi.fetchOrders({ perPage: 100 }),
        paymentsApi.fetchTodaySummary(),
      ])
      const raw = Array.isArray(ordersRes) ? ordersRes : ordersRes?.orders || ordersRes || []
      const normalized = raw.map((o: any) => ({
        ...o,
        total: Number(o.total ?? o.totalAmount ?? 0),
        items: (o.items || []).map((i: any) => ({
          ...i,
          name: i.name || i.itemName || 'Item',
          price: Number(i.price || i.itemPrice || 0),
          quantity: i.quantity || 1,
        })),
        tableNumber: o.tableNumber ?? 0,
        paymentMethod: o.paymentMethod || 'CASH',
        paymentStatus: o.paymentStatus || 'UNPAID',
        createdAt: o.createdAt || new Date().toISOString(),
        orderNumber: o.orderNumber || o.id?.slice(0, 8).toUpperCase(),
        cashierNote: o.cashierNote || '',
        tipAmount: Number(o.tipAmount || 0),
        serviceCharge: Number(o.serviceCharge || 0),
      }))
      setAllOrders(normalized)
      setOrders(normalized.filter((o: any) => {
        if (activeTab === 'pending') return o.paymentStatus !== 'PAID'
        return o.paymentStatus === 'PAID'
      }))
      if (summaryRes) setStats({
        todayTotal: summaryRes.totalRevenue || summaryRes.total || 0,
        ordersCount: summaryRes.totalOrders || summaryRes.orderCount || 0,
        pendingCount: normalized.filter((o: any) => o.paymentStatus !== 'PAID').length,
      })
    } catch { showErrorToast('Failed to load orders') }
    finally { setLoading(false) }
  }

  const [stats, setStats] = useState({ todayTotal: 0, ordersCount: 0, pendingCount: 0 })
  const [shift, setShift] = useState<any>(null)
  const [closeCashAmount, setCloseCashAmount] = useState('')
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [tables, setTables] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      tablesApi.fetchTables().catch(() => []),
      tablesApi.fetchZones().catch(() => []),
    ]).then(([t, z]) => {
      const tData = Array.isArray(t) ? t : t?.tables || t
      const zData = Array.isArray(z) ? z : z?.zones || z
      setTables(Array.isArray(tData) ? tData : [])
      setZones(Array.isArray(zData) ? zData : [])
    })
  }, [])

  const handleFloorTableClick = (tableId: string | null) => {
    if (!tableId) return
    const table = tables.find((t) => t.id === tableId)
    const atTable = allOrders
      .filter((o: any) => (o.tableId === tableId || Number(o.tableNumber) === table?.tableNumber) && o.paymentStatus !== 'PAID')
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (atTable.length > 0) {
      setSelectedOrder(atTable[0])
      return
    }
    setNewOrderTable(String(table?.tableNumber || ''))
    setShowCreateModal(true)
  }

  useEffect(() => { fetchOrders() }, [activeTab])
  useEffect(() => { const iv = setInterval(fetchOrders, 30000); return () => clearInterval(iv) }, [activeTab])

  const fetchReceipts = async (pageToLoad = 1) => {
    setLoadingReceipts(true)
    try {
      const params: any = { page: pageToLoad, perPage: 20 }
      if (receiptFrom) params.dateFrom = new Date(receiptFrom).toISOString()
      if (receiptTo) {
        const d = new Date(receiptTo)
        d.setHours(23, 59, 59, 999)
        params.dateTo = d.toISOString()
      }
      if (receiptMethod) params.method = receiptMethod
      if (receiptTable) params.tableNumber = Number(receiptTable)
      if (receiptQuery.trim()) params.q = receiptQuery.trim()
      const res = await paymentsApi.fetchReceipts(params)
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
      setReceipts((prev) => (pageToLoad === 1 ? list : [...prev, ...list]))
      setReceiptHasMore((pageToLoad * 20) < (res?.meta?.total ?? list.length))
    } catch {
      showErrorToast('Failed to load receipts')
    } finally {
      setLoadingReceipts(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'receipts') return
    setReceiptPage(1)
    fetchReceipts(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, receiptFrom, receiptTo, receiptMethod, receiptTable, receiptQuery])

  useEffect(() => {
    paymentsApi.getShifts().then((data: any) => {
      const shifts = Array.isArray(data) ? data : data?.shifts || data || []
      const openShift = shifts.find((s: any) => s.status === 'OPEN')
      setShift(openShift || null)
    }).catch(() => {})
  }, [showReceipt])

  const handleOpenShift = async () => {
    try {
      const res = await paymentsApi.openShift('')
      setShift(res.shift || res)
      showSuccessToast('Shift opened!')
    } catch (e: any) {
      if (e?.response?.status === 409) showErrorToast('Shift already open')
      else showErrorToast('Failed to open shift')
    }
  }

  const handleCloseShift = async () => {
    if (!shift || !closeCashAmount) return
    try {
      const actualCash = parseFloat(closeCashAmount)
      const res = await paymentsApi.closeShift(shift.id, actualCash)
      if (Math.abs(res.discrepancy || 0) > 100) {
        showErrorToast(`Discrepancy: KES ${(res.discrepancy || 0).toLocaleString()}. Verify cash count.`)
      } else {
        showSuccessToast(`Shift closed. Variance: KES ${(res.discrepancy || 0).toLocaleString()}`)
      }
      setShift(null); setCloseCashAmount(''); setShowCloseShift(false)
    } catch { showErrorToast('Failed to close shift') }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const hq = searchHighlight.toLowerCase()
    return orders.filter((o: any) => {
      const matchSearch = !q || o.orderNumber?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) ||
        o.items.some((i: any) => i.name.toLowerCase().includes(q)) ||
        String(o.tableNumber).includes(q)
      const matchTable = !filterTable || String(o.tableNumber) === filterTable
      return matchSearch && matchTable
    }).map((o) => ({
      ...o,
      _highlight: hq && (o.orderNumber?.toLowerCase().includes(hq) || o.items.some((i: any) => i.name.toLowerCase().includes(hq))),
    }))
  }, [orders, search, searchHighlight])

  const paginated = filtered.slice(0, page * ITEMS_PER_PAGE)
  const hasMore = paginated.length < filtered.length

  const orderTotal = useMemo(() => {
    if (!selectedOrder) return 0
    const baseTotal = selectedOrder.total || selectedOrder.totalAmount || 0
    const disc = parseFloat(discount) || 0
    const tip = parseFloat(tipAmount) || 0
    const sc = parseFloat(serviceChargePercent) || 0
    const scAmount = sc > 0 ? baseTotal * (sc / 100) : 0
    return Math.max(0, baseTotal - disc + tip + scAmount)
  }, [selectedOrder, discount, tipAmount, serviceChargePercent])

  const change = useMemo(() => {
    if (!cashReceived) return 0
    return Math.max(0, parseFloat(cashReceived) - orderTotal)
  }, [cashReceived, orderTotal])

  const handlePayment = async () => {
    if (!selectedOrder) return
    setProcessing(true)
    try {
      const tip = parseFloat(tipAmount) || 0
      const sc = parseFloat(serviceChargePercent) || 0
      const scAmount = sc > 0 ? (selectedOrder.total || 0) * (sc / 100) : 0

      if (paymentMethod === 'cash') {
        if (parseFloat(cashReceived) < orderTotal) { showErrorToast('Insufficient amount'); setProcessing(false); return }
        await paymentsApi.recordCashPayment({
          orderId: selectedOrder.id, amount: orderTotal,
          amountTendered: parseFloat(cashReceived),
          discount: parseFloat(discount) || 0,
        })
      } else if (paymentMethod === 'card') {
        await paymentsApi.recordCardPayment(selectedOrder.id, orderTotal)
      } else if (paymentMethod === 'mpesa') {
        if (!mpesaPhone) { showErrorToast('Enter customer phone'); setProcessing(false); return }
        await paymentsApi.initiateMpesa(selectedOrder.id, mpesaPhone)
        showSuccessToast('M-Pesa STK Push sent')
        setMpesaPhone(''); setSelectedOrder(null); setProcessing(false); fetchOrders()
        return
      }

      if (tip > 0) await paymentsApi.recordTip(selectedOrder.id, tip, paymentMethod).catch(() => {})
      if (scAmount > 0) await paymentsApi.recordServiceCharge(selectedOrder.id, scAmount).catch(() => {})
      if (cashierNote) await ordersApi.addOrderNote(selectedOrder.id, cashierNote).catch(() => {})

      playKaChing()
      const receiptNo = genReceiptNo()
      const subtotal = selectedOrder.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
      setLastPayment({
        receiptNo, orderNumber: selectedOrder.orderNumber,
        table: selectedOrder.tableNumber, items: selectedOrder.items,
        subtotal, discount: parseFloat(discount) || 0,
        total: orderTotal, method: paymentMethod,
        cashReceived: parseFloat(cashReceived) || 0, change,
        tip, serviceCharge: scAmount,
        time: new Date().toLocaleString('en-KE', { hour12: true }),
        date: new Date().toLocaleDateString('en-KE'),
        staffName,
      })
      setShowReceipt(true)
      showSuccessToast(`Payment recorded!${paymentMethod === 'cash' ? ` Change: KES ${change.toLocaleString()}` : ''}`)
      setSelectedOrder(null); setCashReceived(''); setDiscount(''); setTipAmount('')
      setServiceChargePercent(''); setCashierNote(''),
      fetchOrders()
    } catch { showErrorToast('Payment failed') }
    finally { setProcessing(false) }
  }

  const handleVoidItem = async (itemId: string) => {
    if (!selectedOrder) return
    if (!voidReason) { showErrorToast('Enter void reason'); return }
    try {
      await ordersApi.refundOrder(selectedOrder.id, voidReason, [{ id: itemId }])
      showSuccessToast('Item voided')
      setShowVoidModal(false); setVoidReason('')
      fetchOrders()
    } catch { showErrorToast('Failed to void item') }
  }

  const handleHoldOrder = () => {
    if (!selectedOrder) return
    setHeldOrders((prev) => [...prev, { ...selectedOrder, heldAt: new Date().toISOString() }])
    setSelectedOrder(null)
    showSuccessToast('Order held')
  }

  const handleRecallOrder = (order: any) => {
    setSelectedOrder(order)
    setHeldOrders((prev) => prev.filter((o) => o.id !== order.id))
    showSuccessToast('Order recalled')
  }

  const handleCreateQuickOrder = async () => {
    if (!newOrderTable && !newOrderCustomer) { showErrorToast('Enter table or customer name'); return }
    if (newOrderItems.length === 0) { showErrorToast('Add at least one item'); return }
    try {
      const res = await ordersApi.createPosOrder({
        tableNumber: parseInt(newOrderTable) || 0,
        customerName: newOrderCustomer || undefined,
        items: newOrderItems.map((item) => ({
          menuItemId: item.id, quantity: item.qty,
          specialInstructions: item.instructions,
        })),
        source: 'POS',
      })
      showSuccessToast(`Order #${res.orderNumber || res.id?.slice(0, 6)} created`)
      setShowCreateModal(false); setNewOrderTable(''); setNewOrderCustomer('')
      setNewOrderItems([]); setNewOrderSearch('')
      fetchOrders()
    } catch { showErrorToast('Failed to create order') }
  }

  const formatKES = (v: number) => `KES ${v.toLocaleString('en-KE')}`
  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
  }
  const genReceiptNo = () => {
    const now = new Date()
    const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
    const t = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    return `ETR-${d}-${t}${String(Math.floor(Math.random()*9000)+1000)}`
  }

  const getOrderUrgency = (createdAt: string) => {
    const mins = (Date.now() - new Date(createdAt).getTime()) / 60000
    if (mins > 30) return 'border-red-400 bg-red-50 dark:bg-red-900/10' as const
    if (mins > 15) return 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' as const
    return 'border-transparent' as const
  }

  const handlePrint = useCallback(() => {
    if (!lastPayment) return
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const r: any = restaurant || { name: 'MenuMoja' }
    const lp = lastPayment
    const itemsHtml = (lp.items || [])
      .map((i: any) => `<tr><td>${esc(i.name)}</td><td class="c">${i.quantity}</td><td class="r">${formatKES(Number(i.price || 0) * Number(i.quantity || 1))}</td></tr>`)
      .join('')
    const lines: string[] = []
    lines.push(`<div class="h"><div class="b">${esc(r.name || 'MenuMoja')}</div>`)
    if (r.address) lines.push(`<div>${esc(r.address)}</div>`)
    lines.push(`<div>PIN: ${esc(r.kraPin || 'P051234567X')}</div>`)
    if (r.phone) lines.push(`<div>Tel: ${esc(r.phone)}</div>`)
    lines.push(`</div>`)
    lines.push(`<div class="h"><div class="b">ETR RECEIPT</div><div>Serial: ${esc(lp.receiptNo)}</div><div>${esc(lp.date)} ${esc(lp.time)}</div></div>`)
    lines.push(`<div class="meta"><div><span>Order:</span><span>#${esc(lp.orderNumber)}</span></div>`)
    lines.push(`<div><span>Table:</span><span>${lp.table > 0 ? `T${lp.table}` : 'Takeaway'}</span></div>`)
    lines.push(`<div><span>Payment:</span><span>${esc(String(lp.method || '').toUpperCase())}</span></div>`)
    if (lp.staffName) lines.push(`<div><span>Cashier:</span><span>${esc(lp.staffName)}</span></div>`)
    lines.push(`</div>`)
    lines.push(`<table><thead><tr><th>Item</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table>`)
    lines.push(`<div class="totals"><div><span>Subtotal</span><span>${formatKES(lp.subtotal || 0)}</span></div>`)
    if ((lp.discount || 0) > 0) lines.push(`<div><span>Discount</span><span>-${formatKES(lp.discount)}</span></div>`)
    if ((lp.serviceCharge || 0) > 0) lines.push(`<div><span>Service Charge</span><span>${formatKES(lp.serviceCharge)}</span></div>`)
    if ((lp.tip || 0) > 0) lines.push(`<div><span>Tip</span><span>${formatKES(lp.tip)}</span></div>`)
    lines.push(`<div><span>VAT (16% incl.)</span><span>${formatKES(Math.round((lp.total || 0) * 0.16 / 1.16))}</span></div>`)
    lines.push(`<div class="total"><span>TOTAL</span><span>${formatKES(lp.total || 0)}</span></div></div>`)
    if (String(lp.method) === 'cash') {
      lines.push(`<div class="totals"><div><span>Cash Received</span><span>${formatKES(lp.cashReceived || 0)}</span></div>`)
      lines.push(`<div class="change"><span>Change Due</span><span>${formatKES(lp.change || 0)}</span></div></div>`)
    }
    lines.push(`<div class="foot">** Prices inclusive of VAT **<br/>Goods once sold cannot be returned<br/>Thank you for your business!<br/>Served by: ${esc(lp.staffName || 'Cashier')}</div>`)

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${esc(lp.orderNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; color: #000; }
  .h { text-align: center; border-bottom: 1px dashed #000; padding: 6px 0; }
  .h .b { font-weight: bold; text-transform: uppercase; }
  .meta { padding: 6px 0; border-bottom: 1px dashed #000; }
  .meta div { display: flex; justify-content: space-between; }
  table { width: 100%; border-bottom: 1px dashed #000; border-collapse: collapse; }
  th { text-align: left; font-weight: normal; padding: 3px 0; border-bottom: 1px solid #000; }
  td { padding: 3px 0; border-bottom: 1px dotted #ccc; }
  td.c, th.c { text-align: center; }
  td.r, th.r { text-align: right; }
  .totals { padding: 6px 0; border-bottom: 1px dashed #000; }
  .totals div { display: flex; justify-content: space-between; }
  .total { font-weight: bold; }
  .change { font-weight: bold; }
  .foot { text-align: center; padding: 8px 0; font-size: 10px; }
  @media print { body { width: 80mm; } }
</style></head><body>${lines.join('')}</body></html>`

    const win = window.open('', '_blank', 'width=420,height=640')
    if (!win) { showErrorToast('Pop-up blocked — please allow pop-ups to print receipts'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 250)
  }, [lastPayment, restaurant])

  const openReceipt = (p: any) => {
    const o = p.order || {}
    const items = (o.items || []).map((i: any) => ({ name: i.itemName || 'Item', quantity: i.quantity || 1, price: Number(i.itemPrice || 0) }))
    setLastPayment({
      receiptNo: p.mpesaReceiptNumber ? `MP-${p.mpesaReceiptNumber}` : `ETR-${String(p.id || '').slice(0, 8).toUpperCase()}`,
      orderNumber: o.orderNumber || '',
      table: o.tableNumber || 0,
      items,
      subtotal: Number(o.subtotal ?? items.reduce((s: number, it: any) => s + it.price * it.quantity, 0)),
      discount: 0,
      total: Number(o.totalAmount || p.amount || 0),
      method: String(p.paymentMethod || 'CASH').toLowerCase(),
      cashReceived: p.cashReceived != null ? Number(p.cashReceived) : 0,
      change: p.changeGiven != null ? Number(p.changeGiven) : 0,
      tip: Number(o.tipAmount || 0),
      serviceCharge: Number(o.serviceCharge || 0),
      date: p.processedAt ? new Date(p.processedAt).toLocaleDateString('en-KE') : '',
      time: p.processedAt ? new Date(p.processedAt).toLocaleString('en-KE', { hour12: true }) : '',
      staffName: p.cashier?.fullName || 'Cashier',
    })
    setShowReceipt(true)
  }

  const itemTotal = (order: any) => order?.items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0) || 0

  return (
    <div ref={posRef} className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="flex h-dvh overflow-hidden">
        {/* LEFT: Order List */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 border-r border-white/10">
          <header className="shrink-0 bg-white dark:bg-primary-light border-b border-white/10 px-3 py-2">
            {shift ? (
              <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 text-xs text-success">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="font-medium hidden sm:inline">Shift Open</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">Expected: {formatKES(shift.expectedCash || 0)}</span>
                </div>
                <button onClick={() => setShowCloseShift(true)} className="text-xs font-medium text-red-500 hover:text-red-600">
                  Close Shift
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <span className="text-xs text-amber-600 font-medium">No open shift</span>
                <button onClick={handleOpenShift} className="text-xs font-medium text-secondary hover:text-secondary-dark">
                  Open Shift
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-heading text-base sm:text-lg font-bold text-text-primary dark:text-white truncate">POS</h1>
                <Badge size="sm" variant="default" className="hidden sm:inline-flex">{stats.ordersCount} today</Badge>
                <Badge size="sm" variant={stats.pendingCount > 0 ? 'warning' : 'default'}>{stats.pendingCount}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPlaySound(!playSound)} className={`p-1.5 rounded-lg ${playSound ? 'hover:bg-black/5' : 'text-text-secondary/40'}`}>
                  {playSound ? <Volume2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                </button>
                <button onClick={() => setShowCreateModal(true)} className="p-1.5 rounded-lg hover:bg-black/5 text-secondary" title="Quick Order">
                  <Plus className="h-4 w-4" />
                </button>
                {heldOrders.length > 0 && (
                  <button onClick={() => setShowHeldModal(true)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 relative" title="Held Orders">
                    <RotateCcw className="h-4 w-4" />
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 text-[8px] text-white font-bold flex items-center justify-center">
                      {heldOrders.length}
                    </span>
                  </button>
                )}
                <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-black/5">
                  <Fullscreen className="h-4 w-4 text-text-secondary" />
                </button>
                <button onClick={() => setIsTableGrid(!isTableGrid)} className={`p-1.5 rounded-lg ${isTableGrid ? 'bg-secondary/10 text-secondary' : 'hover:bg-black/5 text-text-secondary'}`} title={isTableGrid ? 'List view' : 'Floor plan view'}>
                  {isTableGrid ? <Map className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
                <button onClick={() => setCustomerDisplayOpen(true)} className="p-1.5 rounded-lg hover:bg-black/5 text-text-secondary" title="Customer Display">
                  <Eye className="h-4 w-4" />
                </button>
                <span className="text-xs text-text-secondary hidden sm:inline mx-1">{staffName}</span>
                <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-red-100 text-text-secondary hover:text-red-500">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setSearchHighlight(e.target.value) }}
                  placeholder="Search order, item, table..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 text-sm text-text-primary focus:border-secondary focus:outline-none"
                />
              </div>
              <input
                value={filterTable} onChange={(e) => { setFilterTable(e.target.value); setPage(1) }}
                placeholder="Table #" type="number"
                className="w-20 rounded-xl border-2 border-gray-200 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-2 text-sm text-text-primary focus:border-secondary focus:outline-none"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {(['pending', 'paid', 'receipts'] as const).map((tab) => (
                <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); setSelectedOrder(null) }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === tab ? 'bg-secondary text-white shadow-sm' : 'bg-black/5 dark:bg-white/10 text-text-secondary hover:bg-black/10'
                  }`}>
                  {tab === 'pending' ? 'Unpaid' : tab === 'paid' ? 'Paid Today' : 'Receipts'}
                  <span className="ml-1.5 text-[10px] opacity-70">
                    ({tab === 'pending' ? stats.pendingCount : tab === 'paid' ? orders.length : receipts.length})
                  </span>
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y">
            {activeTab === 'receipts' ? (
              <>
                <div className="p-2 space-y-2 border-b border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
                  <div className="flex gap-1.5">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[9px] font-medium text-text-secondary mb-0.5">From</label>
                      <input type="date" value={receiptFrom} onChange={(e) => setReceiptFrom(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1.5 text-xs text-text-primary focus:border-secondary focus:outline-none" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[9px] font-medium text-text-secondary mb-0.5">To</label>
                      <input type="date" value={receiptTo} onChange={(e) => setReceiptTo(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1.5 text-xs text-text-primary focus:border-secondary focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <select value={receiptMethod} onChange={(e) => setReceiptMethod(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1.5 text-xs text-text-primary focus:border-secondary focus:outline-none">
                      <option value="">All methods</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="MPESA">M-Pesa</option>
                    </select>
                    <input value={receiptTable} onChange={(e) => setReceiptTable(e.target.value)} placeholder="Table #" type="number"
                      className="w-20 rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1.5 text-xs text-text-primary focus:border-secondary focus:outline-none" />
                    <button onClick={() => { setReceiptQuery(receiptSearchInput); setReceiptPage(1) }}
                      className="px-3 rounded-lg bg-secondary text-white text-xs font-medium hover:bg-secondary-dark transition-colors">
                      Search
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                    <input value={receiptSearchInput}
                      onChange={(e) => setReceiptSearchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { setReceiptQuery(receiptSearchInput); setReceiptPage(1) } }}
                      placeholder="Search order # or item..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/20 bg-transparent text-xs text-text-primary focus:border-secondary focus:outline-none" />
                  </div>
                </div>
                {loadingReceipts && receipts.length === 0 ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
                ) : receipts.length === 0 ? (
                  <div className="text-center py-16 text-text-secondary/50">
                    <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-accent text-sm">No receipts found</p>
                    <p className="text-xs mt-1">Adjust filters or search to find previous receipts</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-white/5">
                      {receipts.map((p: any) => (
                        <div key={p.id} onClick={() => openReceipt(p)}
                          className="cursor-pointer px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Receipt className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                              <span className="font-mono text-sm font-bold text-text-primary dark:text-white truncate">
                                #{p.order?.orderNumber || p.id?.slice(0, 8).toUpperCase()}
                              </span>
                              <Badge size="sm" variant={p.paymentMethod === 'MPESA' ? 'info' : p.paymentMethod === 'CARD' ? 'warning' : 'default'}>
                                {p.paymentMethod}
                              </Badge>
                            </div>
                            <span className="text-sm font-bold text-secondary shrink-0 ml-2">{formatKES(Number(p.amount))}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span>{p.order?.tableNumber > 0 ? `Table ${p.order.tableNumber}` : 'Takeaway'}</span>
                            <span>·</span>
                            <span>{p.processedAt ? new Date(p.processedAt).toLocaleString('en-KE', { hour12: true }) : ''}</span>
                            {p.cashier?.fullName && <><span>·</span><span>{p.cashier.fullName}</span></>}
                            {p.mpesaReceiptNumber && <span className="text-success ml-auto font-mono text-[10px]">MP: {p.mpesaReceiptNumber}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {receiptHasMore && (
                      <button onClick={() => { setReceiptPage((p) => p + 1); fetchReceipts(receiptPage + 1) }}
                        className="w-full py-3 text-xs text-secondary hover:bg-secondary/5 font-medium border-t border-white/10">
                        <ChevronDown className="h-3 w-3 inline mr-1" /> Load More Receipts
                      </button>
                    )}
                  </>
                )}
              </>
            ) : loading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
            ) : isTableGrid ? (
              <FloorCanvas
                tables={tables}
                zones={zones}
                orders={allOrders}
                mode="view"
                onSelect={handleFloorTableClick}
                className="h-full p-2"
                emptyHint="No tables yet — add them in Dashboard → Tables"
              />
            ) : paginated.length === 0 ? (
              <div className="text-center py-20 text-text-secondary/50">
                <Coffee className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-accent text-sm">No {activeTab === 'pending' ? 'unpaid' : 'paid'} orders</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/5">
                  {paginated.map((order: any) => {
                    const isSelected = selectedOrder?.id === order.id
                    const urgencyClass = activeTab === 'pending' ? getOrderUrgency(order.createdAt) : ''
                    return (
                      <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onClick={() => setSelectedOrder(isSelected ? null : order)}
                        className={`cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 border-l-4 ${
                          isSelected ? 'border-secondary bg-secondary/5 dark:bg-secondary/10' : urgencyClass || 'border-transparent'
                        } ${order._highlight ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
                        <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-text-primary dark:text-white">
                                #{order.orderNumber || order.id.slice(0, 6)}
                              </span>
                              <Badge size="sm" variant={order.paymentMethod === 'MPESA' ? 'info' : order.paymentMethod === 'CARD' ? 'warning' : 'default'}>
                                {order.paymentMethod}
                              </Badge>
                              {order.cashierNote && <MessageSquare className="w-3 h-3 text-text-secondary/50" />}
                            </div>
                            <span className="text-sm font-bold text-secondary">{formatKES(order.total)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span>{order.tableNumber > 0 ? `Table ${order.tableNumber}` : 'Takeaway'}</span>
                            <span>·</span>
                            <Clock className="w-3 h-3" /> {timeAgo(order.createdAt)}
                            <span>·</span>
                            <span>{order.items.reduce((s: number, i: any) => s + i.quantity, 0)} item{order.items.length !== 1 ? 's' : ''}</span>
                            {order.tipAmount > 0 && <span className="text-success">· Tip: {formatKES(order.tipAmount)}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {order.items.slice(0, 5).map((item: any, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-text-secondary truncate max-w-[120px]">
                                {item.quantity}x {item.name}
                              </span>
                            ))}
                            {order.items.length > 5 && (
                              <span className="text-[10px] text-text-secondary/50">+{order.items.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
                {hasMore && (
                  <button onClick={() => setPage(p => p + 1)}
                    className="w-full py-3 text-xs text-secondary hover:bg-secondary/5 font-medium border-t border-white/10">
                    <ChevronDown className="h-3 w-3 inline mr-1" /> Load More ({filtered.length - paginated.length} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Payment Panel */}
        <div className="w-80 sm:w-96 shrink-0 min-h-0 bg-white dark:bg-primary-light flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {showReceipt ? (
              <motion.div key="receipt" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-heading font-bold text-text-primary">Receipt</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={handlePrint}><Printer className="h-4 w-4" /></Button>
                    <button onClick={() => setShowReceipt(false)} className="p-1.5 rounded-lg hover:bg-black/5"><X className="h-4 w-4 text-text-secondary" /></button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 font-mono text-xs leading-relaxed" id="etr-receipt">
                  <div className="text-center border-b-2 border-dashed border-gray-300 dark:border-white/20 pb-3 mb-3">
                    <h3 className="font-bold text-sm uppercase tracking-wider">{restaurant?.name || 'MenuMoja'}</h3>
                    <p className="text-text-secondary mt-0.5">{restaurant?.address || ''}</p>
                    <p className="text-text-secondary">PIN: {restaurant?.kraPin || 'P051234567X'}</p>
                    <p className="text-text-secondary">Tel: {restaurant?.phone || ''}</p>
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-300">
                      <p className="font-bold">ETR RECEIPT</p>
                      <p className="text-[10px] text-text-secondary">Serial: {lastPayment?.receiptNo}</p>
                      <p className="text-[10px] text-text-secondary">Date: {lastPayment?.date}</p>
                      <p className="text-[10px] text-text-secondary">Time: {lastPayment?.time}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-[10px] text-text-secondary"><span>Order:</span><span>#{lastPayment?.orderNumber}</span></div>
                    <div className="flex justify-between text-[10px] text-text-secondary"><span>Table:</span><span>{lastPayment?.table > 0 ? `T${lastPayment.table}` : 'Takeaway'}</span></div>
                    <div className="flex justify-between text-[10px] text-text-secondary"><span>Payment:</span><span className="uppercase">{lastPayment?.method}</span></div>
                    <div className="flex justify-between text-[10px] text-text-secondary"><span>Cashier:</span><span>{lastPayment?.staffName}</span></div>
                  </div>
                  <table className="w-full text-[11px] border-y border-dashed border-gray-300">
                    <thead><tr className="text-text-secondary border-b border-gray-200">
                      <th className="text-left py-1 font-normal">Item</th>
                      <th className="text-center py-1 w-8 font-normal">Qty</th>
                      <th className="text-right py-1 w-20 font-normal">Amount</th>
                    </tr></thead>
                    <tbody>
                      {lastPayment?.items?.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="py-1 text-text-primary">{item.name}</td>
                          <td className="py-1 text-center">{item.quantity}</td>
                          <td className="py-1 text-right">{formatKES(item.price * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-b border-dashed border-gray-300 pb-2 mt-2 space-y-1">
                    <div className="flex justify-between text-[11px]"><span className="text-text-secondary">Subtotal</span><span>{formatKES(lastPayment?.subtotal || 0)}</span></div>
                    {lastPayment?.discount > 0 && <div className="flex justify-between text-[11px] text-success"><span>Discount</span><span>-{formatKES(lastPayment.discount)}</span></div>}
                    {lastPayment?.serviceCharge > 0 && <div className="flex justify-between text-[11px]"><span className="text-text-secondary">Service Charge</span><span>{formatKES(lastPayment.serviceCharge)}</span></div>}
                    {lastPayment?.tip > 0 && <div className="flex justify-between text-[11px]"><span className="text-text-secondary">Tip</span><span>{formatKES(lastPayment.tip)}</span></div>}
                    <div className="flex justify-between text-[11px] text-text-secondary"><span>VAT (16% incl.)</span><span>{formatKES(Math.round((lastPayment?.total || 0) * 0.16 / 1.16))}</span></div>
                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200"><span>TOTAL</span><span>{formatKES(lastPayment?.total || 0)}</span></div>
                  </div>
                  {lastPayment?.method === 'cash' && (
                    <div className="border-b border-dashed border-gray-300 pb-2 mt-2 space-y-1 text-[11px]">
                      <div className="flex justify-between"><span className="text-text-secondary">Cash Received</span><span>{formatKES(lastPayment.cashReceived)}</span></div>
                      <div className="flex justify-between font-bold text-success"><span>Change Due</span><span>{formatKES(lastPayment.change)}</span></div>
                    </div>
                  )}
                  <div className="text-center mt-3 pt-3 border-t-2 border-dashed border-gray-300">
                    <p className="text-[10px] text-text-secondary">** Prices inclusive of VAT **</p>
                    <p className="text-[10px] text-text-secondary">Goods once sold cannot be returned</p>
                    <p className="text-[10px] text-text-secondary">Thank you for your business!</p>
                    <p className="text-[9px] text-text-secondary mt-1">Served by: {lastPayment?.staffName || 'Cashier'}</p>
                    <p className="text-[9px] text-text-secondary font-bold mt-2">ETR PIN: {restaurant?.kraPin || 'P051234567X'}</p>
                  </div>
                </div>
                <div className="p-4 border-t border-white/10">
                  <Button fullWidth size="sm" onClick={() => setShowReceipt(false)}>Close Receipt</Button>
                </div>
              </motion.div>
            ) : selectedOrder ? (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-text-primary dark:text-white text-sm sm:text-base">
                      #{selectedOrder.orderNumber}
                    </h3>
                    <span className="text-xs text-text-secondary">T{selectedOrder.tableNumber || 'Takeaway'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={handleHoldOrder} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500" title="Hold Order">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setEditingItems(!editingItems); if (!editingItems) { const q: Record<string, number> = {}; selectedOrder.items.forEach((i: any) => { q[i.id || i.name] = i.quantity }); setEditItemQty(q) } }}
                      className="p-1.5 rounded-lg hover:bg-black/5 text-text-secondary" title="Edit Items">
                      <Settings2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setShowNotesModal(true); setCashierNote(selectedOrder.cashierNote || '') }} className="p-1.5 rounded-lg hover:bg-black/5 text-text-secondary" title="Note">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button onClick={() => setSelectedOrder(null)} className="p-1.5 rounded-lg hover:bg-black/5"><X className="h-4 w-4 text-text-secondary" /></button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 touch-pan-y">
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Clock className="w-3 h-3" /> {timeAgo(selectedOrder.createdAt)}
                    {selectedOrder.status !== 'SERVED' && selectedOrder.status !== 'CANCELLED' && (
                      <Badge size="sm" variant={selectedOrder.status === 'READY' ? 'success' : selectedOrder.status === 'PREPARING' ? 'warning' : 'info'}>
                        {selectedOrder.status}
                      </Badge>
                    )}
                  </div>

                  {/* Order Timeline */}
                  <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                    <span className={`w-2 h-2 rounded-full ${selectedOrder.createdAt ? 'bg-success' : 'bg-gray-300'}`} />
                    <span>Ordered</span>
                    {selectedOrder.confirmedAt && <><ArrowRight className="w-2.5 h-2.5" /><span className={`w-2 h-2 rounded-full bg-success`} /><span>Confirmed</span></>}
                    {selectedOrder.preparedAt && <><ArrowRight className="w-2.5 h-2.5" /><span className={`w-2 h-2 rounded-full bg-success`} /><span>Prepared</span></>}
                    {selectedOrder.servedAt && <><ArrowRight className="w-2.5 h-2.5" /><span className={`w-2 h-2 rounded-full bg-success`} /><span>Served</span></>}
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {selectedOrder.items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {editingItems ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => {
                                const key = item.id || item.name
                                setEditItemQty((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] || item.quantity) - 1) }))
                              }} className="w-6 h-6 rounded-lg bg-red-100 text-red-500 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                              <span className="w-6 text-center text-sm font-bold">{editItemQty[item.id || item.name] ?? item.quantity}</span>
                              <button onClick={() => {
                                const key = item.id || item.name
                                setEditItemQty((prev) => ({ ...prev, [key]: (prev[key] || item.quantity) + 1 }))
                              }} className="w-6 h-6 rounded-lg bg-green-100 text-green-500 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <span className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary shrink-0">
                              {item.quantity}
                            </span>
                          )}
                          <span className="text-sm text-text-primary dark:text-white truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-text-primary dark:text-white/80 shrink-0 ml-2">
                          {formatKES((editItemQty[item.id || item.name] ?? item.quantity) * item.price)}
                        </span>
                        {editingItems && (
                          <button onClick={() => { setShowVoidModal(true); setVoidReason('') }} className="ml-2 p-1 rounded hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Subtotal</span>
                      <span className="font-medium">{formatKES(itemTotal(selectedOrder))}</span>
                    </div>

                    {/* Discount */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-text-secondary shrink-0">Discount</span>
                      <div className="flex items-center gap-1">
                        <input value={discount} onChange={(e) => setDiscount(e.target.value)}
                          placeholder="0" type="number"
                          className="w-20 text-right rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
                          onFocus={() => setShowNumberPad('discount')}
                        />
                        <Percent className="w-3 h-3 text-text-secondary" />
                      </div>
                    </div>

                    {/* Service Charge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-text-secondary shrink-0">Service Charge</span>
                      <div className="flex items-center gap-1">
                        <input value={serviceChargePercent} onChange={(e) => setServiceChargePercent(e.target.value)}
                          placeholder="0" type="number"
                          className="w-16 text-right rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-text-secondary">%</span>
                      </div>
                    </div>

                    {/* Tip */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-text-secondary shrink-0">Tip</span>
                      <input value={tipAmount} onChange={(e) => setTipAmount(e.target.value)}
                        placeholder="0" type="number"
                        className="w-20 text-right rounded-lg border border-gray-200 dark:border-white/20 bg-transparent px-2 py-1 text-sm"
                      />
                    </div>

                    {/* Quick Amount Keys */}
                    {paymentMethod === 'cash' && !cashReceived && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[500, 1000, 2000, 5000].map((amt) => (
                          <button key={amt} onClick={() => setCashReceived(String(amt))}
                            className="px-3 py-1 rounded-lg bg-secondary/10 text-secondary text-xs font-medium hover:bg-secondary/20 active:scale-95 transition-all">
                            {formatKES(amt)}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-base sm:text-lg pt-2 border-t border-white/10">
                      <span>Total Due</span>
                      <span className="text-secondary">{formatKES(orderTotal)}</span>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'cash' as const, label: 'Cash', icon: Banknote, color: 'text-green-500' },
                        { id: 'card' as const, label: 'Card', icon: CreditCard, color: 'text-blue-500' },
                        { id: 'mpesa' as const, label: 'M-Pesa', icon: Smartphone, color: 'text-secondary' },
                      ]).map((m) => (
                        <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                          className={`flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium transition-all active:scale-95 ${
                            paymentMethod === m.id ? 'bg-secondary text-white shadow-sm' : 'bg-black/5 dark:bg-white/10 text-text-secondary hover:bg-black/10'
                          }`}>
                          <m.icon className={`h-5 w-5 ${paymentMethod === m.id ? 'text-white' : m.color}`} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'mpesa' && (
                    <div className="space-y-2">
                      <Input label="Customer Phone" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)}
                        placeholder="+2547XX XXX XXX" icon={<Smartphone className="h-4 w-4" />} />
                    </div>
                  )}

                  {paymentMethod === 'cash' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-text-secondary">Cash Received</label>
                        <button onClick={() => setShowNumberPad(showNumberPad === 'cash' ? null : 'cash')}
                          className="text-xs text-secondary hover:underline">
                          {showNumberPad === 'cash' ? 'Hide Keypad' : 'Show Keypad'}
                        </button>
                      </div>
                      <input value={cashReceived} onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="0.00" type="number" inputMode="decimal"
                        className="w-full mt-1 text-right text-2xl font-bold rounded-xl border-2 border-gray-200 dark:border-white/20 bg-transparent px-4 py-3 text-text-primary focus:border-secondary focus:outline-none"
                      />
                      {showNumberPad === 'cash' && (
                        <div className="mt-2">
                          <NumberPad value={cashReceived} onChange={setCashReceived} onClose={() => setShowNumberPad(null)} maxDecimals={2} />
                        </div>
                      )}
                      {parseFloat(cashReceived) >= orderTotal && (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="mt-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success">
                          <span className="text-xs">Change Due:</span>
                          <span className="text-xl font-bold ml-2">{formatKES(change)}</span>
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Number Pad for Discount */}
                  {showNumberPad === 'discount' && (
                    <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                      <NumberPad value={discount} onChange={setDiscount} onClose={() => setShowNumberPad(null)} maxDecimals={0} />
                    </div>
                  )}
                </div>

                <div className="p-3 sm:p-4 border-t border-white/10 space-y-2">
                  {editingItems && (
                    <Button fullWidth size="sm" variant="ghost" onClick={() => {
                      const updatedItems = selectedOrder.items.map((item: any) => ({
                        ...item,
                        quantity: editItemQty[item.id || item.name] ?? item.quantity,
                      })).filter((item: any) => (editItemQty[item.id || item.name] ?? item.quantity) > 0)
                      showSuccessToast('Items updated')
                      setEditingItems(false)
                      fetchOrders()
                    }}>
                      <CheckCircle className="h-4 w-4" /> Update Quantities
                    </Button>
                  )}
                  <Button fullWidth size="lg" loading={processing}
                    disabled={
                      (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < orderTotal)) ||
                      (paymentMethod === 'mpesa' && !mpesaPhone)
                    }
                    onClick={handlePayment}
                    className="text-sm sm:text-base"
                    icon={<CheckCircle className="h-5 w-5" />}>
                    {paymentMethod === 'mpesa' ? 'Send STK Push' : `Process · ${formatKES(orderTotal)}`}
                  </Button>
                  <div className="flex gap-2">
                    <Button fullWidth size="sm" variant="ghost" onClick={() => setShowSplitModal(true)} disabled={orderTotal <= 0}>
                      <SplitSquareVertical className="h-4 w-4" /> Split Bill
                    </Button>
                    <Button fullWidth size="sm" variant="ghost" onClick={() => { setShowVoidModal(true); setVoidReason('') }}>
                      <Undo2 className="h-4 w-4" /> Void
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0 flex items-center justify-center p-8">
                <div className="text-center text-text-secondary/40">
                  <Calculator className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="font-accent text-sm">Select an order</p>
                  <p className="text-xs mt-1">Tap any order on the left to process payment</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <span className="text-[10px] px-2 py-1 rounded bg-black/5">💡 Quick create with +</span>
                    <span className="text-[10px] px-2 py-1 rounded bg-black/5">📋 Toggle table grid</span>
                    <span className="text-[10px] px-2 py-1 rounded bg-black/5">🔢 Keypad for cash</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Shift Close Modal */}
      {showCloseShift && shift && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowCloseShift(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-sm shadow-soft border border-white/10">
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Close Shift</h3>
              <div className="space-y-3 mb-4">
                <div className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-text-secondary">Expected Cash</span><span className="font-bold">{formatKES(shift.expectedCash || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Card Total</span><span className="font-bold">{formatKES(shift.cardTotal || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">M-Pesa Total</span><span className="font-bold">{formatKES(shift.mpesaTotal || 0)}</span></div>
                </div>
                <Input label="Actual Cash Count" type="number" value={closeCashAmount}
                  onChange={(e) => setCloseCashAmount(e.target.value)} icon={<Banknote className="h-4 w-4" />} />
                {closeCashAmount && (
                  <div className={`rounded-xl p-3 text-sm font-medium ${
                    parseFloat(closeCashAmount) === (shift.expectedCash || 0) ? 'bg-success/10 text-success' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                  }`}>
                    Variance: KES {((parseFloat(closeCashAmount) || 0) - (shift.expectedCash || 0)).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" fullWidth onClick={() => setShowCloseShift(false)}>Cancel</Button>
                <Button fullWidth disabled={!closeCashAmount} onClick={handleCloseShift}>
                  <CheckCircle className="h-4 w-4" /> Confirm & Close
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Split Bill Modal */}
      {showSplitModal && selectedOrder && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowSplitModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-md shadow-soft border border-white/10">
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Split Bill</h3>
              <p className="text-sm text-text-secondary mb-4">Split across multiple payment methods. Partial payments require backend configuration.</p>
              <div className="space-y-3">
                {selectedOrder.items.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-medium">{formatKES(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total</span><span className="text-secondary">{formatKES(orderTotal)}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="ghost" fullWidth onClick={() => setShowSplitModal(false)}>Cancel</Button>
                <Button fullWidth onClick={() => { setShowSplitModal(false); showSuccessToast('Partial payments coming soon') }}>
                  Split
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Void Modal */}
      {showVoidModal && selectedOrder && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowVoidModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-sm shadow-soft border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-text-primary">Void / Refund</h3>
                  <p className="text-xs text-text-secondary">This action cannot be undone</p>
                </div>
              </div>
              <Input label="Reason for void" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer changed mind" />
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" fullWidth onClick={() => setShowVoidModal(false)}>Cancel</Button>
                <Button fullWidth variant="danger" disabled={!voidReason}
                  onClick={() => handleVoidItem(selectedOrder.id)}>
                  <Trash2 className="h-4 w-4" /> Confirm Void
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotesModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-sm shadow-soft border border-white/10">
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Cashier Note</h3>
              <textarea value={cashierNote} onChange={(e) => setCashierNote(e.target.value)}
                placeholder="Add an internal note to this order..."
                className="w-full rounded-xl border border-gray-200 dark:border-white/20 bg-transparent p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary/20"
                rows={4} />
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" fullWidth onClick={() => setShowNotesModal(false)}>Cancel</Button>
                <Button fullWidth onClick={async () => {
                  if (selectedOrder && cashierNote) {
                    await ordersApi.addOrderNote(selectedOrder.id, cashierNote).catch(() => {})
                    showSuccessToast('Note saved')
                  }
                  setShowNotesModal(false)
                }}>Save Note</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Held Orders Modal */}
      {showHeldModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowHeldModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-md shadow-soft border border-white/10">
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Held Orders ({heldOrders.length})</h3>
              {heldOrders.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-6">No held orders</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {heldOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
                      <div>
                        <span className="font-mono text-sm font-bold">#{order.orderNumber}</span>
                        <span className="text-xs text-text-secondary ml-2">T{order.tableNumber || '—'}</span>
                        <span className="text-xs text-text-secondary ml-2">{formatKES(order.total)}</span>
                      </div>
                      <Button size="sm" onClick={() => handleRecallOrder(order)}>
                        <RotateCcw className="h-3 w-3" /> Recall
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Button variant="ghost" fullWidth onClick={() => setShowHeldModal(false)}>Close</Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-primary-light rounded-2xl p-6 w-full max-w-lg shadow-soft border border-white/10 max-h-[90vh] overflow-y-auto">
              <h3 className="font-heading font-bold text-lg text-text-primary mb-4">Quick Order</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input label="Table Number" type="number" value={newOrderTable}
                    onChange={(e) => setNewOrderTable(e.target.value)} containerClassName="flex-1"
                    placeholder="Optional" />
                  <Input label="Customer Name" value={newOrderCustomer}
                    onChange={(e) => setNewOrderCustomer(e.target.value)} containerClassName="flex-1"
                    placeholder="Walk-in" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Add Items</label>
                  <input value={newOrderSearch} onChange={(e) => setNewOrderSearch(e.target.value)}
                    placeholder="Search menu items..."
                    className="w-full rounded-xl border border-gray-200 dark:border-white/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 mb-2"
                  />
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {newOrderItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2">
                        <span>{item.name} x{item.qty}</span>
                        <button onClick={() => setNewOrderItems((prev) => prev.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  {newOrderSearch && (
                    <div className="text-xs text-text-secondary text-center py-2">
                      Type item name and press "Add Item" button below
                    </div>
                  )}
                  <Button size="sm" variant="ghost" fullWidth onClick={() => {
                    if (newOrderSearch.trim()) {
                      setNewOrderItems((prev) => [...prev, { name: newOrderSearch.trim(), qty: 1, id: `temp-${Date.now()}` }])
                      setNewOrderSearch('')
                    }
                  }}>
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="ghost" fullWidth onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button fullWidth onClick={handleCreateQuickOrder} disabled={newOrderItems.length === 0}>
                  <CheckCircle className="h-4 w-4" /> Create Order
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Customer Display Overlay */}
      {customerDisplayOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-8"
          onClick={() => setCustomerDisplayOpen(false)}>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-white text-center max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-2">{restaurant?.name || 'MenuMoja'}</h2>
            <p className="text-gray-400 text-sm mb-8">Order Summary</p>
            <div className="text-6xl font-bold mb-8 text-secondary">
              {formatKES(orderTotal)}
            </div>
            <div className="space-y-2 text-lg">
              {selectedOrder.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between border-b border-gray-800 pb-2">
                  <span>{item.name} x{item.quantity}</span>
                  <span className="text-gray-300">{formatKES(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {discount && parseFloat(discount) > 0 && (
              <div className="flex justify-between mt-4 text-success text-lg">
                <span>Discount</span><span>-{formatKES(parseFloat(discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-3xl font-bold mt-6 pt-4 border-t border-gray-700">
              <span>Total</span><span className="text-secondary">{formatKES(orderTotal)}</span>
            </div>
            <p className="text-gray-500 text-sm mt-8">Tap anywhere to close</p>
          </motion.div>
        </div>
      )}
    </div>
  )
}
