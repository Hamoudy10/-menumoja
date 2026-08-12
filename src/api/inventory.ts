import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchInventoryItems = () =>
  api.get('/inventory/items').then(unwrap)

export const createInventoryItem = (data: any) =>
  api.post('/inventory/items', data).then(unwrap)

export const updateInventoryItem = (id: string, data: any) =>
  api.put(`/inventory/items/${id}`, data).then(unwrap)

export const deleteInventoryItem = (id: string) =>
  api.delete(`/inventory/items/${id}`).then(unwrap)

export const fetchMovements = (params?: any) =>
  api.get('/inventory/movements', { params }).then(unwrap)

export const recordMovement = (data: any) =>
  api.post('/inventory/movements', data).then(unwrap)

export const fetchLowStock = () =>
  api.get('/inventory/low-stock').then(unwrap)

export const fetchSuppliers = () =>
  api.get('/inventory/suppliers').then(unwrap)

export const createSupplier = (data: any) =>
  api.post('/inventory/suppliers', data).then(unwrap)

export const updateSupplier = (id: string, data: any) =>
  api.put(`/inventory/suppliers/${id}`, data).then(unwrap)

export const deleteSupplier = (id: string) =>
  api.delete(`/inventory/suppliers/${id}`).then(unwrap)

export const fetchPurchaseOrders = () =>
  api.get('/inventory/purchase-orders').then(unwrap)

export const getPurchaseOrder = (id: string) =>
  api.get(`/inventory/purchase-orders/${id}`).then(unwrap)

export const createPurchaseOrder = (data: any) =>
  api.post('/inventory/purchase-orders', data).then(unwrap)

export const updatePurchaseOrder = (id: string, data: any) =>
  api.put(`/inventory/purchase-orders/${id}`, data).then(unwrap)

export const receivePurchaseOrder = (id: string, receivedQty?: Record<string, number>) =>
  api.post(`/inventory/purchase-orders/${id}/receive`, { receivedQty }).then(unwrap)
