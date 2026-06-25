import { useEffect } from 'react'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const isExpoGo = Constants.appOwnership === 'expo'

export interface NotificationSettings {
  morningEnabled: boolean
  morningTime: string
  prospectEnabled: boolean
  prospectTime: string
  indriveEnabled: boolean
  indriveTime: string
  closingEnabled: boolean
  closingTime: string
}

async function getNotifications() {
  if (isExpoGo) return null
  return await import('expo-notifications')
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications()
  if (!Notifications) return false

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'North',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const current = await Notifications.getPermissionsAsync()
  if (current.status === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number)
  return { hour: h || 0, minute: m || 0 }
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  await Notifications.cancelAllScheduledNotificationsAsync()
}

export async function scheduleNotifications(settings: NotificationSettings): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  await Notifications.cancelAllScheduledNotificationsAsync()

  const schedule = (hour: number, minute: number, title: string, body: string) =>
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { hour, minute, repeats: true } as any,
    })

  if (settings.morningEnabled) {
    const { hour, minute } = parseTime(settings.morningTime)
    await schedule(hour, minute, '🧭 North', 'Hora de programar! Abra seus projetos.')
  }

  if (settings.prospectEnabled) {
    const { hour, minute } = parseTime(settings.prospectTime)
    await schedule(hour, minute, '🎯 Prospecção', 'Hora de buscar clientes. Meta: 10 contatos hoje.')
  }

  if (settings.indriveEnabled) {
    const { hour, minute } = parseTime(settings.indriveTime)
    await schedule(hour, minute, '🚗 Indrive', 'Hora de rodar! Meta: R$ 150 líquido hoje.')
  }

  if (settings.closingEnabled) {
    const { hour, minute } = parseTime(settings.closingTime)
    await schedule(hour, minute, '📊 Fechamento', 'Registre seus ganhos e feche o caixa do dia.')
  }
}

export async function syncNotifications(
  enabled: boolean,
  settings: NotificationSettings
): Promise<{ granted: boolean; expoGo?: boolean }> {
  if (isExpoGo) {
    return { granted: false, expoGo: true }
  }

  if (!enabled) {
    await cancelAllNotifications()
    return { granted: true }
  }

  const granted = await requestNotificationPermission()
  if (!granted) {
    await cancelAllNotifications()
    return { granted: false }
  }

  await scheduleNotifications(settings)
  return { granted: true }
}

export function useNotifications() {
  useEffect(() => {
    if (isExpoGo) return

    let subscription: { remove: () => void } | null = null

    getNotifications().then((Notifications) => {
      if (!Notifications) return

      subscription = Notifications.addNotificationReceivedListener((notification) => {
        console.log('Notificação recebida:', notification)
      })
    })

    return () => {
      subscription?.remove()
    }
  }, [])
}