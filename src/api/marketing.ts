import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchPosts = () =>
  api.get('/marketing/posts').then(unwrap)

export const createPost = (data: any) =>
  api.post('/marketing/posts/create', data).then(unwrap)

export const updatePost = (id: string, data: any) =>
  api.put(`/marketing/posts/${id}/edit`, data).then(unwrap)

export const approvePost = (id: string) =>
  api.put(`/marketing/posts/${id}/approve`).then(unwrap)

export const publishPost = (id: string) =>
  api.post(`/marketing/posts/${id}/publish-now`).then(unwrap)

export const deletePost = (id: string) =>
  api.delete(`/marketing/posts/${id}`).then(unwrap)

export const getConnections = () =>
  api.get('/marketing/connections').then(unwrap)

export const disconnectPlatform = (platform: string) =>
  api.delete(`/marketing/connect/${platform}`).then(unwrap)

export const getMarketingAnalytics = () =>
  api.get('/marketing/analytics').then(unwrap)

export const sendWhatsAppBroadcast = (data: any) =>
  api.post('/marketing/whatsapp/broadcast', data).then(unwrap)
