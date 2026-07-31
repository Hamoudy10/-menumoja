import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchPromotions = () =>
  api.get('/restaurant/me/promotions').then(unwrap)

export const createPromotion = (data: any) =>
  api.post('/restaurant/me/promotions', data).then(unwrap)

export const updatePromotion = (id: string, data: any) =>
  api.put(`/restaurant/me/promotions/${id}`, data).then(unwrap)

export const deletePromotion = (id: string) =>
  api.delete(`/restaurant/me/promotions/${id}`).then(unwrap)
