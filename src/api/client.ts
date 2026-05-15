import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const refreshRes = await axios.post(
            (import.meta.env.VITE_API_URL || '/api/v1') + '/auth/refresh-token',
            { refreshToken },
          )
          const newAccessToken = refreshRes.data?.data?.tokens?.accessToken
          if (!newAccessToken) throw new Error('No access token in response')
          localStorage.setItem('accessToken', newAccessToken)
          original.headers.Authorization = 'Bearer ' + newAccessToken
          return apiClient(original)
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
