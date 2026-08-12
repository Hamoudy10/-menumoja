import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const getProfitabilityOverview = (period?: string) =>
  api.get('/analytics/profitability/overview', { params: period ? { period } : {} }).then(unwrap)

export const getMenuEngineering = (period?: string) =>
  api.get('/analytics/profitability/menu-engineering', { params: period ? { period } : {} }).then(unwrap)
