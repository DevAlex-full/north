import { create } from 'zustand'
import { authService } from '../services/auth.service'

interface User { id: string; name: string; email: string }

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
  updateUser: (data: { name: string }) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  loadUser: async () => {
    set({ isLoading: true })
    try {
      const auth = await authService.isAuthenticated()
      if (auth) {
        const user = await authService.getMe()
        set({ user, isAuthenticated: true })
      } else {
        set({ user: null, isAuthenticated: false })
      }
    } catch {
      set({ user: null, isAuthenticated: false })
    } finally {
      set({ isLoading: false })
    }
  },

  login: async (email, password) => {
    const res = await authService.login({ email, password })
    set({ user: res.user, isAuthenticated: true })
  },

  register: async (name, email, password) => {
    const res = await authService.register({ name, email, password })
    set({ user: res.user, isAuthenticated: true })
  },

  logout: async () => {
    await authService.logout()
    set({ user: null, isAuthenticated: false })
  },

  updateUser: async (data) => {
    const updated = await authService.updateProfile(data)
    set({ user: updated })
  },
}))
