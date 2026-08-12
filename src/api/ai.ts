import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const customerChat = (restaurantId: string, sessionId: string, message: string, language: string) =>
  api.post('/ai/chat/customer', { restaurantId, sessionId, message, language }).then(unwrap)

export const generateDescription = (data: any) =>
  api.post('/ai/generate/description', data).then(unwrap)

export const generateRestaurantDescription = (data: any) =>
  api.post('/ai/generate/restaurant-description', data).then(unwrap)

export const generateImage = (prompt: string, itemName: string) =>
  api.post('/ai/generate/image', { prompt, itemName }).then(unwrap)

export const enhanceImage = (imageUrl: string) =>
  api.post('/ai/enhance/image', { imageUrl }).then(unwrap)

export const generateFaq = (data: any) =>
  api.post('/ai/generate/faq', data).then(unwrap)

export const generateSocialPost = (data: any) =>
  api.post('/ai/generate/social-post', data).then(unwrap)

export const getAiUsage = (period?: string) =>
  api.get('/ai/usage', { params: period ? { period } : {} }).then(unwrap)
