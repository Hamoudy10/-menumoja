import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchCategories = () =>
  api.get('/menu/categories').then(unwrap)

export const addCategory = (data: any) =>
  api.post('/menu/categories', data).then(unwrap)

export const updateCategory = (id: string, data: any) =>
  api.put(`/menu/categories/${id}`, data).then(unwrap)

export const removeCategory = (id: string) =>
  api.delete(`/menu/categories/${id}`).then(unwrap)

export const addItem = (data: any) =>
  api.post('/menu/items', data).then(unwrap)

export const updateItem = (itemId: string, data: any) =>
  api.put(`/menu/items/${itemId}`, data).then(unwrap)

export const removeItem = (itemId: string) =>
  api.delete(`/menu/items/${itemId}`).then(unwrap)

export const toggleItemAvailability = (itemId: string) =>
  api.put(`/menu/items/${itemId}/toggle`).then(unwrap)

export const getItems = (params?: any) =>
  api.get('/menu/items', { params }).then(unwrap)

export const getItem = (id: string) =>
  api.get(`/menu/items/${id}`).then(unwrap)

export const bulkUpdateItems = (data: any) =>
  api.post('/menu/items/bulk-update', data).then(unwrap)

export const duplicateItem = (id: string) =>
  api.post(`/menu/items/${id}/duplicate`).then(unwrap)

export const reorderCategories = (order: any[]) =>
  api.put('/menu/categories/reorder', { order }).then(unwrap)

export const reorderItems = (data: any) =>
  api.put('/menu/items/reorder', data).then(unwrap)

export const getPublicMenu = (slug: string) =>
  api.get(`/menu/public/${slug}`).then(unwrap)

export const searchPublicMenu = (slug: string, query: string) =>
  api.get(`/menu/public/${slug}/search`, { params: { q: query } }).then(unwrap)

export const getMenuUpsells = (slug: string, itemIds: string[]) =>
  api.get(`/menu/public/${slug}/upsells`, { params: { itemIds: itemIds.join(',') } }).then(unwrap)

export const getPersonalizedMenu = (slug: string, sessionId?: string, cartItemIds?: string[]) =>
  api.get(`/menu/public/${slug}/personalized`, {
    params: {
      sessionId: sessionId || undefined,
      cartItemIds: cartItemIds && cartItemIds.length > 0 ? cartItemIds.join(',') : undefined,
    },
  }).then(unwrap)
