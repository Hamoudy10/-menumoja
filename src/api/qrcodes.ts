import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchQrCodes = () =>
  api.get('/qr').then(unwrap)

export const generateQrCode = (data: { label: string; tableNumber?: number; type?: string; template?: number }) =>
  api.post('/qr/generate', data).then(unwrap)

export const generateBatchQrCodes = (data: { numberOfTables: number; template?: number }) =>
  api.post('/qr/generate-batch', data).then(unwrap)

export const getQrCode = (id: string) =>
  api.get(`/qr/${id}`).then(unwrap)

export const updateQrCode = (id: string, data: any) =>
  api.put(`/qr/${id}`, data).then(unwrap)

export const deleteQrCode = (id: string) =>
  api.delete(`/qr/${id}`).then(unwrap)

export const downloadQrPng = (id: string) =>
  api.get(`/qr/${id}/download`, { responseType: 'blob' })

export const downloadQrPdf = (id: string) =>
  api.get(`/qr/${id}/pdf`, { responseType: 'blob' })
