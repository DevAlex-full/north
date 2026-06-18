import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../stores/auth.store'
import { LoadingScreen } from '../components/ui/LoadingScreen'

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => { loadUser() }, [])

  useEffect(() => {
    if (isLoading) return
    const inAuth = segments[0] === '(auth)'
    if (!isAuthenticated && !inAuth) { router.replace('/(auth)/login') }
    else if (isAuthenticated && inAuth) { router.replace('/(tabs)/dashboard') }
  }, [isAuthenticated, isLoading, segments])

  if (isLoading) return <LoadingScreen message="Iniciando North..." />

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' }, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  )
}
