import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchCameras = () =>
  api.get('/cameras').then(unwrap)

export const createCamera = (data: any) =>
  api.post('/cameras', data).then(unwrap)

export const updateCamera = (id: string, data: any) =>
  api.put(`/cameras/${id}`, data).then(unwrap)

export const deleteCamera = (id: string) =>
  api.delete(`/cameras/${id}`).then(unwrap)

export const testCameraConnection = (id: string) =>
  api.post(`/cameras/${id}/test`).then(unwrap)

export const getStreamToken = (id: string) =>
  api.post(`/cameras/${id}/stream-token`).then(unwrap)

export const getAlerts = () =>
  api.get('/cameras/alert').then(unwrap)

export const getCameraAlerts = (cameraId: string) =>
  api.get(`/cameras/${cameraId}/alerts`).then(unwrap)

export const reviewAlert = (alertId: string) =>
  api.put(`/cameras/alert/${alertId}/review`).then(unwrap)
