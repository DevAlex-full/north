import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LOCAL_API_URL = 'http://192.168.1.27:3000/api/v1'
const PRODUCTION_API_URL = 'https://north-back.onrender.com/api/v1'

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (__DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL)

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

console.log('[North API] Ambiente:', __DEV__ ? 'development' : 'production')
console.log('[North API] URL utilizada:', BASE_URL)

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Injeta o access token nas rotas protegidas.
api.interceptors.request.use(async (config) => {
  const url = config.url ?? ''

  const isPublicAuthRoute =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')

  if (!isPublicAuthRoute) {
    const token = await AsyncStorage.getItem('@north:token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

// Renova automaticamente o access token quando a API retorna 401.
api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as
      | RetryableRequestConfig
      | undefined

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      const refreshToken = await AsyncStorage.getItem(
        '@north:refreshToken'
      )

      if (!refreshToken) {
        throw new Error('Refresh token não encontrado')
      }

      const { data } = await axios.post<{
        accessToken: string
        refreshToken: string
      }>(
        `${BASE_URL}/auth/refresh`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      )

      await AsyncStorage.multiSet([
        ['@north:token', data.accessToken],
        ['@north:refreshToken', data.refreshToken],
      ])

      originalRequest.headers.Authorization =
        `Bearer ${data.accessToken}`

      return api(originalRequest)
    } catch (refreshError) {
      await AsyncStorage.multiRemove([
        '@north:token',
        '@north:refreshToken',
        '@north:user',
      ])

      return Promise.reject(refreshError)
    }
  }
)

export {
  BASE_URL,
  LOCAL_API_URL,
  PRODUCTION_API_URL,
}

export default api