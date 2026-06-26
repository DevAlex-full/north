import axios, { AxiosInstance, AxiosError } from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://north-back.onrender.com/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Injeta token em todas as requisições
api.interceptors.request.use(async (config) => {
  const url = config.url || ''
  const isAuthPublicRoute =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')

  if (!isAuthPublicRoute) {
    const token = await AsyncStorage.getItem('@north:token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Refresh token automático em 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = await AsyncStorage.getItem('@north:refreshToken')
        if (!refreshToken) throw new Error('Sem refresh token')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        await AsyncStorage.setItem('@north:token', data.accessToken)
        await AsyncStorage.setItem('@north:refreshToken', data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch {
        await AsyncStorage.multiRemove(['@north:token', '@north:refreshToken', '@north:user'])
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
