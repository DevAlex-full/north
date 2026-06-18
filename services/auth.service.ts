import api from './api'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface LoginData { email: string; password: string }
export interface RegisterData { name: string; email: string; password: string }

export const authService = {
  async login(data: LoginData) {
    const res = await api.post('/auth/login', data)
    await AsyncStorage.setItem('@north:token', res.data.accessToken)
    await AsyncStorage.setItem('@north:refreshToken', res.data.refreshToken)
    await AsyncStorage.setItem('@north:user', JSON.stringify(res.data.user))
    return res.data
  },

  async register(data: RegisterData) {
    const res = await api.post('/auth/register', data)
    await AsyncStorage.setItem('@north:token', res.data.accessToken)
    await AsyncStorage.setItem('@north:refreshToken', res.data.refreshToken)
    await AsyncStorage.setItem('@north:user', JSON.stringify(res.data.user))
    return res.data
  },

  async logout() {
    try { await api.post('/auth/logout') } catch {}
    await AsyncStorage.multiRemove(['@north:token', '@north:refreshToken', '@north:user'])
  },

  async getMe() {
    const res = await api.get('/auth/me')
    return res.data
  },

  async updateProfile(data: { name: string }) {
    const res = await api.put('/auth/profile', data)
    return res.data
  },

  async updateSettings(data: any) {
    const res = await api.put('/auth/settings', data)
    return res.data
  },

  async updateNotifications(data: any) {
    const res = await api.put('/auth/notifications', data)
    return res.data
  },

  async getStoredUser() {
    const raw = await AsyncStorage.getItem('@north:user')
    return raw ? JSON.parse(raw) : null
  },

  async isAuthenticated() {
    const token = await AsyncStorage.getItem('@north:token')
    return !!token
  },
}
