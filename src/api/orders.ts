import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchOrders = (params?: any) =>
  api.get('/orders', { params }).then(unwrap)

export const fetchLiveOrders = () =>
  api.get('/orders/live').then(unwrap)

export const getOrder = (id: string) =>
  api.get(`/orders/${id}`).then(unwrap)

export const updateOrderStatus = (id: string, status: string, reason?: string) =>
  api.put(`/orders/${id}/status`, { status: status.toLowerCase(), cancelledReason: reason }).then(unwrap)

export const assignWaiter = (orderId: string, waiterId: string) =>
  api.put(`/orders/${orderId}/assign-waiter`, { waiterId }).then(unwrap)

export const cancelOrder = (id: string, reason: string) =>
  api.delete(`/orders/${id}`, { data: { reason } }).then(unwrap)

export const getOrderHistory = (params?: any) =>
  api.get('/orders/history', { params }).then(unwrap)

export const getKitchenOrders = () =>
  api.get('/orders/kitchen').then(unwrap)

export const placeOrder = (data: any) =>
  api.post('/orders/public/create', data).then(unwrap)

export const getOrderStatus = (orderId: string) =>
  api.get(`/orders/public/${orderId}/status`).then(unwrap)
