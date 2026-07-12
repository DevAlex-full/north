import { useState, useCallback } from 'react'
import { storage } from '../utils/storage'
import {
  requestNotificationPermission,
  scheduleImmediateNotification,
  cancelNotificationById,
  scheduleDailyPendencyReminder,
  cancelNotificationsByPrefix,
  isExpoGo,
} from './useNotifications'
import {
  getPendencyNotificationPlan,
  DEFAULT_CRM_NOTIFICATION_PREFERENCES,
  type CrmNotificationPreferences,
  type BuildPendenciesInput,
} from '../utils/notifications'

const PREFERENCES_KEY = 'crmNotificationPreferences'
const LAST_SYNC_KEY = 'crmNotificationLastSync'

/** Fase 5.2 — snapshot do que estava agendado na última sincronização, para detectar mudança sem reagendar à toa. */
type SyncSnapshot = Record<string, { count: number }>

export interface PendencySyncResult {
  /** `false` quando o usuário nunca concedeu permissão de notificação (ou está no Expo Go). */
  granted: boolean
  /** `true` quando rodando em Expo Go — notificações locais não funcionam nesse ambiente. */
  expoGo?: boolean
}

/**
 * Fase 5.2 — Hook de orquestração da Central de Notificações Inteligentes.
 * Não recalcula nenhuma regra de negócio (isso é 100% de
 * `utils/notifications.ts`/`utils/commercial.ts`) — só cuida de:
 *  1) carregar/salvar as preferências locais (AsyncStorage via
 *     `utils/storage.ts`, já existente no projeto — nenhuma dependência
 *     nova);
 *  2) comparar o plano de notificação atual com o que foi agendado da
 *     última vez, para só agendar/atualizar categorias que mudaram e
 *     cancelar as que deixaram de existir (regra 5.2C: sem duplicidade,
 *     sem reagendar indefinidamente, sem notificar lista vazia).
 */
export function usePendencyNotifications() {
  const [preferences, setPreferences] = useState<CrmNotificationPreferences>(DEFAULT_CRM_NOTIFICATION_PREFERENCES)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const loadPreferences = useCallback(async () => {
    const saved = await storage.get<CrmNotificationPreferences>(PREFERENCES_KEY)
    setPreferences(saved ?? DEFAULT_CRM_NOTIFICATION_PREFERENCES)
    setIsLoaded(true)
    return saved ?? DEFAULT_CRM_NOTIFICATION_PREFERENCES
  }, [])

  const updatePreferences = useCallback(async (next: CrmNotificationPreferences) => {
    setPreferences(next)
    await storage.set(PREFERENCES_KEY, next)

    // O lembrete diário é o único item time-based (recorrente por horário);
    // os demais são recalculados só quando `sync` roda (foco na tela ou
    // botão "Atualizar alertas") — não é disparado a cada mudança de campo.
    if (next.dailyReminderEnabled) {
      await scheduleDailyPendencyReminder(
        next.dailyReminderTime,
        '🔔 North — Resumo do dia',
        'Confira suas pendências na Central de Pendências.'
      )
    } else {
      await cancelNotificationById('crm-daily-reminder')
    }
  }, [])

  /**
   * Recalcula o plano de notificações e sincroniza com o que já está
   * agendado no dispositivo. Retorna `granted=false` sem agendar nada se
   * a permissão não foi concedida (ou estamos no Expo Go) — nunca quebra o
   * app por causa disso.
   */
  const sync = useCallback(async (input: BuildPendenciesInput): Promise<PendencySyncResult> => {
    setIsSyncing(true)
    try {
      const prefs = (await storage.get<CrmNotificationPreferences>(PREFERENCES_KEY)) ?? DEFAULT_CRM_NOTIFICATION_PREFERENCES
      const plan = getPendencyNotificationPlan(input, prefs)

      // Nenhuma categoria ativa e nada agendado antes: nem vale pedir permissão.
      const previousSnapshot = (await storage.get<SyncSnapshot>(LAST_SYNC_KEY)) ?? {}
      if (plan.length === 0 && Object.keys(previousSnapshot).length === 0) {
        return { granted: true }
      }

      if (isExpoGo) {
        return { granted: false, expoGo: true }
      }

      const granted = await requestNotificationPermission()
      if (!granted) {
        return { granted: false }
      }

      const nextSnapshot: SyncSnapshot = {}
      for (const category of plan) {
        nextSnapshot[category.identifier] = { count: category.count }
        const previous = previousSnapshot[category.identifier]
        // Já agendada com a mesma contagem: não reagenda a mesma pendência à toa (regra 5.2C).
        if (previous && previous.count === category.count) continue
        await scheduleImmediateNotification(category.identifier, category.title, category.body)
      }

      // Categorias que existiam antes e não existem mais no plano atual: cancela.
      for (const identifier of Object.keys(previousSnapshot)) {
        if (!nextSnapshot[identifier]) {
          await cancelNotificationById(identifier)
        }
      }

      await storage.set(LAST_SYNC_KEY, nextSnapshot)
      return { granted: true }
    } finally {
      setIsSyncing(false)
    }
  }, [])

  /** Cancela todos os alertas da Central de Pendências (prefixo `crm-`) e limpa o snapshot — usado quando o usuário desativa tudo. */
  const cancelAll = useCallback(async () => {
    await cancelNotificationsByPrefix('crm-')
    await storage.remove(LAST_SYNC_KEY)
  }, [])

  return { preferences, isLoaded, isSyncing, loadPreferences, updatePreferences, sync, cancelAll }
}