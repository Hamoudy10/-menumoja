import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const getOverview = (period?: string) =>
  api.get('/analytics/overview', { params: { period } }).then(unwrap)

export const getRevenue = (params?: any) =>
  api.get('/analytics/revenue', { params }).then(unwrap)

export const getOrderAnalytics = (params?: any) =>
  api.get('/analytics/orders', { params }).then(unwrap)

export const getTopMenuItems = (params?: any) =>
  api.get('/analytics/menu-items', { params }).then(unwrap)

export const getTablePerformance = () =>
  api.get('/analytics/tables').then(unwrap)

export const getScanAnalytics = (params?: any) =>
  api.get('/analytics/scans', { params }).then(unwrap)

export const getSearchTerms = () =>
  api.get('/analytics/search-terms').then(unwrap)

export const getAiQuestions = () =>
  api.get('/analytics/ai-questions').then(unwrap)

export const getSocialAnalytics = () =>
  api.get('/analytics/social').then(unwrap)
