import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchRestaurant = () =>
  api.get('/restaurant/me').then(unwrap)

export const updateRestaurant = (data: any) =>
  api.put('/restaurant/me', data).then(unwrap)

export const updateSettings = (data: any) =>
  api.put('/restaurant/me/settings', data).then(unwrap)

export const getOpeningHours = () =>
  api.get('/restaurant/me/opening-hours').then(unwrap)

export const updateOpeningHours = (hours: any[]) =>
  api.put('/restaurant/me/opening-hours', { hours }).then(unwrap)

export const getBranches = () =>
  api.get('/restaurant/me/branches').then(unwrap)

export const createBranch = (data: any) =>
  api.post('/restaurant/me/branches', data).then(unwrap)
