import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(unwrap)

export const loginWithGoogle = (credential: string) =>
  api.post('/auth/google', { credential }).then(unwrap)

export const register = (data: any) =>
  api.post('/auth/register', data).then(unwrap)

export const verifyOtp = (userId: string, otp: string) =>
  api.post('/auth/verify-otp', { userId, otp }).then(unwrap)

export const resendOtp = (userId: string) =>
  api.post('/auth/resend-otp', { userId }).then(unwrap)

export const logout = (refreshToken?: string) =>
  api.delete('/auth/logout', { data: { refreshToken } }).then(unwrap)

export const refreshToken = (token: string) =>
  api.post('/auth/refresh-token', { refreshToken: token }).then(unwrap)

export const forgotPassword = (identifier: string) => {
  const isEmail = identifier.includes('@')
  return api.post('/auth/forgot-password', isEmail ? { email: identifier } : { phone: identifier }).then(unwrap)
}

export const resetPassword = (identifier: string, otp: string, newPassword: string) => {
  const isEmail = identifier.includes('@')
  return api.post('/auth/reset-password', isEmail ? { email: identifier, otp, newPassword } : { phone: identifier, otp, newPassword }).then(unwrap)
}

export const staffLogin = (pin: string, restaurantSlug: string) =>
  api.post('/auth/staff/login', { pin, restaurantSlug }).then(unwrap)

export const adminLogin = (email: string, password: string) =>
  api.post('/auth/admin/login', { email, password }).then(unwrap)
