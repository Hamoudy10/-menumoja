import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchCustomers = (params?: any) =>
  api.get('/customers', { params }).then((r: any) => ({
    data: r.data?.data || r.data,
    meta: r.data?.meta,
    segments: r.data?.segments || {},
  }))

export const getCustomer = (id: string) =>
  api.get(`/customers/${id}`).then(unwrap)

export const updateCustomer = (id: string, data: any) =>
  api.put(`/customers/${id}`, data).then(unwrap)

export const exportCustomerData = (id: string) =>
  api.get(`/customers/${id}/export`).then(unwrap)

export const deleteCustomer = (id: string) =>
  api.delete(`/customers/${id}`).then(unwrap)
