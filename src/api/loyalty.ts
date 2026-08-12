import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchProgram = () =>
  api.get('/loyalty/program').then(unwrap)

export const updateProgram = (data: any) =>
  api.put('/loyalty/program', data).then(unwrap)

export const fetchRules = () =>
  api.get('/loyalty/rules').then(unwrap)

export const createRule = (data: any) =>
  api.post('/loyalty/rules', data).then(unwrap)

export const updateRule = (id: string, data: any) =>
  api.put(`/loyalty/rules/${id}`, data).then(unwrap)

export const deleteRule = (id: string) =>
  api.delete(`/loyalty/rules/${id}`).then(unwrap)

export const fetchAccounts = () =>
  api.get('/loyalty/accounts').then(unwrap)

export const getAccount = (customerId: string) =>
  api.get(`/loyalty/accounts/${customerId}`).then(unwrap)

export const adjustPoints = (customerId: string, points: number, reason: string) =>
  api.post(`/loyalty/accounts/${customerId}/adjust`, { points, reason }).then(unwrap)

export const fetchRewards = (customerId?: string) =>
  api.get('/loyalty/rewards', { params: customerId ? { customerId } : {} }).then(unwrap)

export const redeemReward = (rewardId: string) =>
  api.post(`/loyalty/rewards/${rewardId}/redeem`).then(unwrap)

export const cancelReward = (rewardId: string) =>
  api.post(`/loyalty/rewards/${rewardId}/cancel`).then(unwrap)
