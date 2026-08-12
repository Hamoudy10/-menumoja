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

export const placeOrder = (data: any, idempotencyKey?: string) =>
  api.post('/orders/public/create', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined).then(unwrap)

export const getOrderStatus = (orderId: string) =>
  api.get(`/orders/public/${orderId}/status`).then(unwrap)

export const createPosOrder = (data: any, idempotencyKey?: string) =>
  api.post('/orders', data, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined).then(unwrap)

export const addOrderNote = (id: string, note: string) =>
  api.put(`/orders/${id}/note`, { note }).then(unwrap)

export const holdOrder = (id: string) =>
  api.put(`/orders/${id}/hold`).then(unwrap)

export const unholdOrder = (id: string) =>
  api.put(`/orders/${id}/unhold`).then(unwrap)

export const refundOrder = (id: string, reason: string, items?: any[]) =>
  api.post(`/orders/${id}/refund`, { reason, items }).then(unwrap)
