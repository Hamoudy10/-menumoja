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

export const setTableStatus = (id: string, status: string, version?: number) =>
  api.put(`/restaurant/me/tables/${id}/status`, { status, version }).then(unwrap)

export const updateTableSession = (id: string, action: 'START' | 'END', guestCount?: number, version?: number) =>
  api.put(`/restaurant/me/tables/${id}/session`, { action, guestCount, version }).then(unwrap)

export const fetchZones = () =>
  api.get('/restaurant/me/zones').then(unwrap)

export const createZone = (data: any) =>
  api.post('/restaurant/me/zones', data).then(unwrap)

export const updateZone = (id: string, data: any) =>
  api.put(`/restaurant/me/zones/${id}`, data).then(unwrap)

export const deleteZone = (id: string) =>
  api.delete(`/restaurant/me/zones/${id}`).then(unwrap)
