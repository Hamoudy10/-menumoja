import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchStaff = () =>
  api.get('/restaurant/me/staff').then(unwrap)

export const addStaff = (data: any) =>
  api.post('/restaurant/me/staff', data).then(unwrap)

export const removeStaff = (id: string) =>
  api.delete(`/restaurant/me/staff/${id}`).then(unwrap)

export const updateStaff = (id: string, data: any) =>
  api.put(`/restaurant/me/staff/${id}`, data).then(unwrap)

export const resetStaffPin = (id: string) =>
  api.post(`/restaurant/me/staff/${id}/reset-pin`).then(unwrap)
