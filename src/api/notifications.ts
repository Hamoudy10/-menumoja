import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchNotifications = () =>
  api.get('/notifications').then(unwrap)

export const markAsRead = (id: string) =>
  api.put(`/notifications/${id}/read`).then(unwrap)

export const markAllAsRead = () =>
  api.put('/notifications/read-all').then(unwrap)

export const deleteNotification = (id: string) =>
  api.delete(`/notifications/${id}`).then(unwrap)

export const getUnreadCount = () =>
  api.get('/notifications/unread-count').then(unwrap)
