import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export interface BillingInvoice {
  id: string
  invoiceNumber: string
  amountKes: number | string
  periodStart: string
  periodEnd: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'VOID'
  paymentMethod?: string | null
  reference?: string | null
  notes?: string | null
  paidAt?: string | null
  createdAt: string
  plan?: { id: string; name: string } | null
}

export interface BillingOverview {
  subscription: {
    status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'SUSPENDED'
    trialEndsAt: string | null
    planExpiresAt: string | null
    plan: { id: string; name: string; priceMonthlyKes: number; priceYearlyKes: number } | null
  }
  outstanding: { count: number; amountKes: number }
  invoices: BillingInvoice[]
}

export const fetchBillingOverview = (): Promise<BillingOverview> =>
  api.get('/billing/overview').then(unwrap)

export const fetchInvoices = (status?: string): Promise<BillingInvoice[]> =>
  api.get('/billing/invoices', { params: status ? { status } : undefined }).then(unwrap)

export const getInvoice = (id: string): Promise<BillingInvoice> =>
  api.get(`/billing/invoices/${id}`).then(unwrap)

export const claimInvoicePayment = (
  id: string,
  data: { method: 'MPESA' | 'CASH' | 'BANK' | 'CARD'; reference: string; notes?: string }
) => api.post(`/billing/invoices/${id}/claim`, data).then(unwrap)
