import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PRODUCTION_API_URL = 'https://north-back.onrender.com/api/v1'

/**
 * A URL definida em EXPO_PUBLIC_API_URL existe exclusivamente para o
 * desenvolvimento local via Metro/Expo Go.
 *
 * Em builds instaladas e atualizações OTA (__DEV__ === false), a aplicação
 * IGNORA completamente EXPO_PUBLIC_API_URL e usa sempre o endpoint fixo de
 * produção. Isso impede que um `.env.local`, variável de shell ou cache do
 * Metro incorpore acidentalmente um IP privado (192.168.x.x/localhost) em uma
 * OTA publicada para o aplicativo instalado.
 */
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim()
const DEVELOPMENT_API_URL = ENV_API_URL || PRODUCTION_API_URL
const BASE_URL = (__DEV__ ? DEVELOPMENT_API_URL : PRODUCTION_API_URL).replace(
  /\/+$/,
  ''
)

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

console.log('[North API] Ambiente:', __DEV__ ? 'development' : 'production')
console.log(
  '[North API] Origem da URL:',
  __DEV__ && ENV_API_URL
    ? 'EXPO_PUBLIC_API_URL (somente desenvolvimento)'
    : 'endpoint fixo de produção'
)
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
  PRODUCTION_API_URL,
}

export default api
