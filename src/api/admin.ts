import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchAdminStats = () =>
  api.get('/admin/stats').then(unwrap)

export const fetchAdminRevenue = () =>
  api.get('/admin/revenue').then(unwrap)

export const fetchAdminRestaurants = (params?: any) =>
  api.get('/admin/restaurants', { params }).then((r: any) => ({
    data: r.data?.data || r.data,
    meta: r.data?.meta,
  }))

export const getAdminRestaurant = (id: string) =>
  api.get(`/admin/restaurants/${id}`).then(unwrap)

export const suspendAdminRestaurant = (id: string, reason: string) =>
  api.put(`/admin/restaurants/${id}/suspend`, { reason }).then(unwrap)

export const activateAdminRestaurant = (id: string) =>
  api.put(`/admin/restaurants/${id}/activate`).then(unwrap)

export const fetchAdminOwners = () =>
  api.get('/admin/owners').then(unwrap)

export const fetchSupportTickets = (params?: any) =>
  api.get('/admin/support-tickets', { params }).then(unwrap)

export const replySupportTicket = (id: string, message: string) =>
  api.post(`/admin/support-tickets/${id}/reply`, { message }).then(unwrap)

export const closeSupportTicket = (id: string) =>
  api.put(`/admin/support-tickets/${id}/close`).then(unwrap)

export const fetchAuditLogs = (params?: any) =>
  api.get('/admin/audit-logs', { params }).then((r: any) => ({
    data: r.data?.data || r.data,
    meta: r.data?.meta,
  }))
