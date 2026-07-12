import { useEffect } from 'react'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

export const isExpoGo = Constants.appOwnership === 'expo'

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

/**
 * Fase 5.2 — Cancela apenas as notificações agendadas cujo identificador
 * começa com `prefix`, em vez de derrubar TODAS as notificações do
 * dispositivo. Necessário porque a Central de Pendências (Fase 5.2) passou
 * a agendar notificações próprias (prefixo `crm-`) que não podem ser
 * apagadas sempre que o usuário resalva os lembretes diários de rotina
 * (prefixo `daily-`, veja `scheduleNotifications` abaixo) — e vice-versa.
 */
export async function cancelNotificationsByPrefix(prefix: string): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(
    scheduled
      .filter((n: { identifier: string }) => n.identifier.startsWith(prefix))
      .map((n: { identifier: string }) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  )
}

/**
 * Fase 5.2 — Agenda (ou substitui, se já existir o mesmo `identifier`) uma
 * notificação de disparo imediato. Usada pela Central de Pendências para
 * alertas derivados do estado atual (follow-ups, prazos, subtarefas) —
 * diferente dos lembretes diários de rotina, que são recorrentes por
 * horário. Retorna silenciosamente (`void`) em Expo Go ou sem permissão,
 * seguindo o mesmo guard já usado no resto deste arquivo.
 */
export async function scheduleImmediateNotification(identifier: string, title: string, body: string): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, sound: true },
    trigger: null,
  })
}

/** Fase 5.2 — Cancela uma única notificação agendada pelo `identifier`. */
export async function cancelNotificationById(identifier: string): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  await Notifications.cancelScheduledNotificationAsync(identifier)
}

/**
 * Fase 5.2 — Agenda o lembrete diário da Central de Pendências, num
 * horário recorrente escolhido pelo usuário em Configurações. Usa
 * identificador fixo (`crm-daily-reminder`): chamar de novo substitui o
 * agendamento anterior — não precisa cancelar manualmente antes.
 */
export async function scheduleDailyPendencyReminder(time: string, title: string, body: string): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  const { hour, minute } = parseTime(time)
  await Notifications.scheduleNotificationAsync({
    identifier: 'crm-daily-reminder',
    content: { title, body, sound: true },
    trigger: { hour, minute, repeats: true } as any,
  })
}

export async function scheduleNotifications(settings: NotificationSettings): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return

  // Fase 5.2 — Antes cancelava TUDO (cancelAllScheduledNotificationsAsync),
  // o que apagava também os alertas da Central de Pendências (prefixo
  // `crm-`) sempre que o usuário resalvava esta seção. Agora cancela só os
  // lembretes de rotina (prefixo `daily-`), que são os únicos que esta
  // função gerencia.
  await cancelNotificationsByPrefix('daily-')

  const schedule = (hour: number, minute: number, title: string, body: string, identifier: string) =>
    Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body, sound: true },
      trigger: { hour, minute, repeats: true } as any,
    })

  if (settings.morningEnabled) {
    const { hour, minute } = parseTime(settings.morningTime)
    await schedule(hour, minute, '🧭 North', 'Hora de programar! Abra seus projetos.', 'daily-morning')
  }

  if (settings.prospectEnabled) {
    const { hour, minute } = parseTime(settings.prospectTime)
    await schedule(hour, minute, '🎯 Prospecção', 'Hora de buscar clientes. Meta: 10 contatos hoje.', 'daily-prospect')
  }

  if (settings.indriveEnabled) {
    const { hour, minute } = parseTime(settings.indriveTime)
    await schedule(hour, minute, '🚗 Indrive', 'Hora de rodar! Meta: R$ 150 líquido hoje.', 'daily-indrive')
  }

  if (settings.closingEnabled) {
    const { hour, minute } = parseTime(settings.closingTime)
    await schedule(hour, minute, '📊 Fechamento', 'Registre seus ganhos e feche o caixa do dia.', 'daily-closing')
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

      subscription = Notifications.addNotificationReceivedListener(() => {
        // Listener reservado para tratar notificações recebidas em
        // primeiro plano no futuro (ex: navegar para uma tela específica).
      })
    })

    return () => {
      subscription?.remove()
    }
  }, [])
}