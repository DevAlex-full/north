import { useEffect, useRef } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useRouter, useSegments } from 'expo-router'
import { AppState, AppStateStatus } from 'react-native'
import { useAuthStore } from '../stores/auth.store'
import { useUpdateStore } from '../stores/update.store'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { UpdateAvailableModal } from '../components/ui/UpdateAvailableModal'

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore()
  const { isModalVisible, checkOnLaunchOrResume, applyUpdate, dismissModal } = useUpdateStore()
  const segments = useSegments()
  const router = useRouter()
  const appState = useRef<AppStateStatus>(AppState.currentState)

  useEffect(() => { loadUser() }, [])

  useEffect(() => {
    if (isLoading) return
    const inAuth = segments[0] === '(auth)'
    if (!isAuthenticated && !inAuth) { router.replace('/(auth)/login') }
    else if (isAuthenticated && inAuth) { router.replace('/(tabs)/dashboard') }
  }, [isAuthenticated, isLoading, segments])

  // Verifica atualização OTA automaticamente ao abrir o app.
  useEffect(() => {
    checkOnLaunchOrResume()
  }, [])

  // Verifica novamente sempre que o app volta do background para o
  // primeiro plano (ex: usuário trocou de app e voltou para o North).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const cameFromBackground = appState.current.match(/inactive|background/) && nextState === 'active'
      if (cameFromBackground) {
        checkOnLaunchOrResume()
      }
      appState.current = nextState
    })
    return () => subscription.remove()
  }, [])

  if (isLoading) return <LoadingScreen message="Iniciando North..." />

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F172A' }, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <UpdateAvailableModal
        visible={isModalVisible}
        onUpdateNow={applyUpdate}
        onLater={dismissModal}
      />
    </>
  )
}