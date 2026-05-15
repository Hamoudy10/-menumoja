import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchTables = () =>
  api.get('/restaurant/me/tables').then(unwrap)

export const createTable = (data: any) =>
  api.post('/restaurant/me/tables', data).then(unwrap)

export const updateTable = (id: string, data: any) =>
  api.put(`/restaurant/me/tables/${id}`, data).then(unwrap)

export const deleteTable = (id: string) =>
  api.delete(`/restaurant/me/tables/${id}`).then(unwrap)
