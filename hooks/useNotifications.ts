import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

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

/**
 * Solicita permissão de notificações ao sistema. Necessário no Android 13+
 * e em todo iOS antes de qualquer agendamento funcionar.
 */
export async function requestNotificationPermission(): Promise<boolean> {
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

/**
 * Cancela todas as notificações locais agendadas do North.
 * Deve ser chamada quando o usuário desativa as notificações.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Reagenda as notificações locais com base nas preferências do usuário.
 * Sempre cancela tudo antes, para nunca duplicar agendamentos.
 */
export async function scheduleNotifications(settings: NotificationSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()

  const schedule = (hour: number, minute: number, title: string, body: string) =>
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { hour, minute, repeats: true } as Notifications.NotificationTriggerInput,
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

/**
 * Garante que o estado de notificações agendadas no dispositivo reflita
 * exatamente as preferências do usuário: se `enabled` for false, cancela
 * tudo; se for true, solicita permissão e (re)agenda.
 */
export async function syncNotifications(
  enabled: boolean,
  settings: NotificationSettings
): Promise<{ granted: boolean }> {
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
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notificação recebida:', notification)
    })
    return () => sub.remove()
  }, [])
}
