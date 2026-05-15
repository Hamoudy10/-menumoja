import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchPayments = (params?: any) =>
  api.get('/payments', { params }).then(unwrap)

export const getPayment = (id: string) =>
  api.get(`/payments/${id}`).then(unwrap)

export const fetchTodaySummary = () =>
  api.get('/payments/summary/today').then(unwrap)

export const initiateMpesa = (orderId: string, phone: string) =>
  api.post('/payments/mpesa/initiate', { orderId, phone }).then(unwrap)

export const getMpesaStatus = (checkoutRequestId: string) =>
  api.get(`/payments/mpesa/${checkoutRequestId}/status`).then(unwrap)

export const recordCashPayment = (data: any) =>
  api.post('/payments/cash/record', data).then(unwrap)

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
