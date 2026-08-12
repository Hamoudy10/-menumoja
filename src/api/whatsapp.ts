import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchSettings = () =>
  api.get('/whatsapp/settings').then(unwrap)

export const saveSettings = (data: any) =>
  api.put('/whatsapp/settings', data).then(unwrap)

export const fetchTemplates = () =>
  api.get('/whatsapp/templates').then(unwrap)

export const createTemplate = (data: any) =>
  api.post('/whatsapp/templates', data).then(unwrap)

export const updateTemplate = (id: string, data: any) =>
  api.put(`/whatsapp/templates/${id}`, data).then(unwrap)

export const deleteTemplate = (id: string) =>
  api.delete(`/whatsapp/templates/${id}`).then(unwrap)

export const fetchCampaigns = () =>
  api.get('/whatsapp/campaigns').then(unwrap)

export const createCampaign = (data: any) =>
  api.post('/whatsapp/campaigns', data).then(unwrap)

export const getCampaign = (id: string) =>
  api.get(`/whatsapp/campaigns/${id}`).then(unwrap)

export const sendCampaign = (id: string) =>
  api.post(`/whatsapp/campaigns/${id}/send`).then(unwrap)

export const deleteCampaign = (id: string) =>
  api.delete(`/whatsapp/campaigns/${id}`).then(unwrap)
