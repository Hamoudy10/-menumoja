import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchPayments = (params?: any) =>
  api.get('/payments', { params }).then(unwrap)

export const fetchReceipts = (params?: any) =>
  api.get('/payments/receipts', { params }).then((r: any) => ({
    data: r.data?.data || r.data,
    meta: r.data?.meta,
  }))

export const getPayment = (id: string) =>
  api.get(`/payments/${id}`).then(unwrap)

export const fetchTodaySummary = () =>
  api.get('/payments/summary/today').then(unwrap)

export const initiateMpesa = (orderId: string, phone: string, idempotencyKey?: string) =>
  api.post('/payments/mpesa/initiate', { orderId, phone }, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined).then(unwrap)

export const getMpesaStatus = (checkoutRequestId: string) =>
  api.get(`/payments/mpesa/${checkoutRequestId}/status`).then(unwrap)

export const recordCashPayment = (data: any, idempotencyKey?: string) =>
  api.post('/payments/cash/record', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined).then(unwrap)

export const getRevenueReport = (params?: any) =>
  api.get('/payments/report', { params }).then(unwrap)

export const getTaxReport = (params?: any) =>
  api.get('/payments/report/tax', { params }).then(unwrap)

export const openShift = (cashierId: string) =>
  api.post('/payments/cash/open-shift', { cashierId }).then(unwrap)

export const closeShift = (shiftId: string, actualCash: number) =>
  api.post('/payments/cash/close-shift', { shiftId, actualCash }).then(unwrap)

export const getShifts = () =>
  api.get('/payments/cash/shifts').then(unwrap)

export const recordCardPayment = (orderId: string, amount: number, idempotencyKey?: string) =>
  api.post('/payments/card/record', { orderId, amount }, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined).then(unwrap)

export const recordTip = (orderId: string, amount: number, method: string) =>
  api.post('/payments/tip', { orderId, amount, method }).then(unwrap)

export const recordServiceCharge = (orderId: string, amount: number) =>
  api.post('/payments/service-charge', { orderId, amount }).then(unwrap)

export const voidPayment = (paymentId: string, reason: string) =>
  api.post(`/payments/${paymentId}/void`, { reason }).then(unwrap)
