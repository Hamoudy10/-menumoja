import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchReservations = (date?: string) =>
  api.get('/reservations', { params: date ? { date } : {} }).then(unwrap)

export const createReservation = (data: any) =>
  api.post('/reservations', data).then(unwrap)

export const updateReservation = (id: string, data: any) =>
  api.put(`/reservations/${id}`, data).then(unwrap)

export const checkInReservation = (id: string) =>
  api.post(`/reservations/${id}/check-in`).then(unwrap)

export const cancelReservation = (id: string) =>
  api.post(`/reservations/${id}/cancel`).then(unwrap)

export const markNoShow = (id: string) =>
  api.post(`/reservations/${id}/no-show`).then(unwrap)

export const fetchWaitlist = () =>
  api.get('/reservations/waitlist').then(unwrap)

export const addToWaitlist = (data: any) =>
  api.post('/reservations/waitlist', data).then(unwrap)

export const seatWaitlist = (id: string, tableId: string) =>
  api.post(`/reservations/waitlist/${id}/seat`, { tableId }).then(unwrap)

export const cancelWaitlist = (id: string) =>
  api.post(`/reservations/waitlist/${id}/cancel`).then(unwrap)
