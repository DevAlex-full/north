import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFIX = '@north:'

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },

  async set(key: string, value: any): Promise<void> {
    try { await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch {}
  },

  async remove(key: string): Promise<void> {
    try { await AsyncStorage.removeItem(PREFIX + key) } catch {}
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      const northKeys = keys.filter(k => k.startsWith(PREFIX))
      await AsyncStorage.multiRemove(northKeys)
    } catch {}
  },
}
