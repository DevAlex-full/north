import type { Lead } from '../types/lead.types'
import type { Project } from '../types/project.types'
import {
  groupFollowUpsByUrgency,
  getOperationalHealth,
  getPendingSubtasksSummary,
  getUpcomingDeliveries,
  getOverdueProjects,
} from './commercial'

/** Fase 5.1 — Tipo de pendência consolidada na Central de Pendências. */
export type PendencyType =
  | 'FOLLOW_UP_OVERDUE'
  | 'FOLLOW_UP_TODAY'
  | 'PROJECT_NO_NEXT_ACTION'
  | 'PROJECT_NEAR_DEADLINE'
  /** Fase 5.2 — prazo já passou (distinto de "próximo"). */
  | 'PROJECT_OVERDUE'
  | 'PENDING_SUBTASK'
  | 'LEAD_STALE'
  | 'UPCOMING_DELIVERY'

/** Fase 5.1 — Nível de prioridade. Sempre derivado em tempo real, nunca persistido. */
export type PendencyPriority = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO'

/** Fase 5.1 — Card inteligente de pendência (item 3 da fase). */
export interface PendencyItem {
  id: string
  type: PendencyType
  title: string
  project: string | null
  client: string | null
  deadline: string | null
  priority: PendencyPriority
  suggestedAction: string
}

export interface PendencyCounts {
  CRITICO: number
  ALTO: number
  MEDIO: number
  BAIXO: number
}

/** Fase 5.1 — janela (dias) para classificar "prazo próximo"/"entrega próxima" como CRÍTICO/ALTO em vez de ALTO/MÉDIO. */
const URGENT_DAYS_THRESHOLD = 3

/**
 * Fase 5.1 — Ação sugerida por tipo de pendência. Texto fixo e genérico
 * (não depende de IA nem de configuração) — é só o "próximo passo óbvio"
 * de cada tipo de pendência, para dar contexto acionável ao card.
 */
const SUGGESTED_ACTION: Record<PendencyType, string> = {
  FOLLOW_UP_OVERDUE: 'Entrar em contato o quanto antes',
  FOLLOW_UP_TODAY: 'Fazer contato hoje',
  PROJECT_NO_NEXT_ACTION: 'Definir o próximo passo do projeto',
  PROJECT_NEAR_DEADLINE: 'Verificar andamento antes do prazo',
  PROJECT_OVERDUE: 'Verificar o que houve e realinhar prazo com o cliente',
  PENDING_SUBTASK: 'Concluir a subtarefa',
  LEAD_STALE: 'Reativar contato com o lead',
  UPCOMING_DELIVERY: 'Preparar entrega e alinhar com o cliente',
}

function daysUntil(dateStr: string, now: Date): number {
  return Math.ceil((new Date(dateStr).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

function getClientName(project: Project, leads: Lead[]): string | null {
  return leads.find((l) => l.id === project.clientId)?.name ?? null
}

export interface BuildPendenciesInput {
  leads: Lead[]
  projects: Project[]
  /** Resultado de `useFollowUps()` — leads com followUpAt vencido ou dentro da janela consultada. */
  followUps: Lead[]
}

/**
 * Fase 5.1 — Consolida as 7 categorias de pendência pedidas em uma única
 * lista classificada por prioridade. Não faz nenhuma chamada a
 * service/store: recebe `leads`/`projects`/`followUps` já carregados pela
 * tela (via stores/hooks existentes) e delega toda a filtragem bruta para
 * `utils/commercial.ts` (`groupFollowUpsByUrgency`, `getOperationalHealth`,
 * `getPendingSubtasksSummary`, `getUpcomingDeliveries`) — a mesma lógica
 * já usada no Dashboard Operacional (Fase 4.5), sem recalcular nada do
 * zero. Esta função só adiciona a camada de classificação de prioridade e
 * a normalização em `PendencyItem`.
 */
export function buildPendencies({ leads, projects, followUps }: BuildPendenciesInput): PendencyItem[] {
  const now = new Date()
  const items: PendencyItem[] = []

  const followUpGroups = groupFollowUpsByUrgency(followUps)
  const health = getOperationalHealth(leads, projects)
  const pendingSubtasks = getPendingSubtasksSummary(projects)
  const upcomingDeliveries = getUpcomingDeliveries(projects)
  const overdueProjects = getOverdueProjects(projects)

  followUpGroups.overdue.forEach((lead) => {
    items.push({
      id: `followup-overdue-${lead.id}`,
      type: 'FOLLOW_UP_OVERDUE',
      title: `Follow-up atrasado — ${lead.name}`,
      project: null,
      client: lead.name,
      deadline: lead.followUpAt,
      priority: 'CRITICO',
      suggestedAction: SUGGESTED_ACTION.FOLLOW_UP_OVERDUE,
    })
  })

  followUpGroups.today.forEach((lead) => {
    items.push({
      id: `followup-today-${lead.id}`,
      type: 'FOLLOW_UP_TODAY',
      title: `Follow-up hoje — ${lead.name}`,
      project: null,
      client: lead.name,
      deadline: lead.followUpAt,
      priority: 'ALTO',
      suggestedAction: SUGGESTED_ACTION.FOLLOW_UP_TODAY,
    })
  })

  health.projectsWithoutNextAction.forEach((project) => {
    items.push({
      id: `no-next-action-${project.id}`,
      type: 'PROJECT_NO_NEXT_ACTION',
      title: `Sem próxima ação — ${project.name}`,
      project: project.name,
      client: getClientName(project, leads),
      deadline: project.deadline,
      priority: 'MEDIO',
      suggestedAction: SUGGESTED_ACTION.PROJECT_NO_NEXT_ACTION,
    })
  })

  health.projectsWithNearDeadline.forEach((project) => {
    const days = project.deadline ? daysUntil(project.deadline, now) : null
    items.push({
      id: `near-deadline-${project.id}`,
      type: 'PROJECT_NEAR_DEADLINE',
      title: `Prazo próximo — ${project.name}`,
      project: project.name,
      client: getClientName(project, leads),
      deadline: project.deadline,
      priority: days !== null && days <= URGENT_DAYS_THRESHOLD ? 'CRITICO' : 'ALTO',
      suggestedAction: SUGGESTED_ACTION.PROJECT_NEAR_DEADLINE,
    })
  })

  overdueProjects.forEach((project) => {
    items.push({
      id: `overdue-project-${project.id}`,
      type: 'PROJECT_OVERDUE',
      title: `Prazo vencido — ${project.name}`,
      project: project.name,
      client: getClientName(project, leads),
      deadline: project.deadline,
      priority: 'CRITICO',
      suggestedAction: SUGGESTED_ACTION.PROJECT_OVERDUE,
    })
  })

  pendingSubtasks.forEach((subtask) => {
    items.push({
      id: `subtask-${subtask.subtaskId}`,
      type: 'PENDING_SUBTASK',
      title: subtask.subtaskTitle,
      project: subtask.projectName,
      client: null,
      deadline: null,
      priority: subtask.taskPriority === 1 ? 'ALTO' : subtask.taskPriority === 2 ? 'MEDIO' : 'BAIXO',
      suggestedAction: `${SUGGESTED_ACTION.PENDING_SUBTASK} da tarefa "${subtask.taskTitle}"`,
    })
  })

  health.staleLeads.forEach((lead) => {
    items.push({
      id: `stale-lead-${lead.id}`,
      type: 'LEAD_STALE',
      title: `Sem retorno — ${lead.name}`,
      project: null,
      client: lead.name,
      deadline: lead.lastContactAt,
      priority: 'ALTO',
      suggestedAction: SUGGESTED_ACTION.LEAD_STALE,
    })
  })

  upcomingDeliveries.forEach((project) => {
    const days = project.deadline ? daysUntil(project.deadline, now) : null
    items.push({
      id: `delivery-${project.id}`,
      type: 'UPCOMING_DELIVERY',
      title: `Entrega próxima — ${project.name}`,
      project: project.name,
      client: getClientName(project, leads),
      deadline: project.deadline,
      priority: days !== null && days <= URGENT_DAYS_THRESHOLD ? 'ALTO' : 'MEDIO',
      suggestedAction: SUGGESTED_ACTION.UPCOMING_DELIVERY,
    })
  })

  return items
}

const PRIORITY_ORDER: PendencyPriority[] = ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO']

/** Fase 5.1 — Conta pendências por prioridade (para o card do Dashboard). */
export function countPendenciesByPriority(items: PendencyItem[]): PendencyCounts {
  return {
    CRITICO: items.filter((i) => i.priority === 'CRITICO').length,
    ALTO: items.filter((i) => i.priority === 'ALTO').length,
    MEDIO: items.filter((i) => i.priority === 'MEDIO').length,
    BAIXO: items.filter((i) => i.priority === 'BAIXO').length,
  }
}

/** Fase 5.1 — Agrupa pendências por prioridade, na ordem CRÍTICO → ALTO → MÉDIO → BAIXO (para a Central de Pendências). */
export function groupPendenciesByPriority(items: PendencyItem[]): Record<PendencyPriority, PendencyItem[]> {
  const grouped = { CRITICO: [], ALTO: [], MEDIO: [], BAIXO: [] } as Record<PendencyPriority, PendencyItem[]>
  items.forEach((item) => { grouped[item.priority].push(item) })
  return grouped
}

export { PRIORITY_ORDER }

// ============================================================
// Fase 5.2 — Notificações Inteligentes
// ============================================================

/**
 * Fase 5.2 — Preferências de notificação da Central de Pendências.
 *
 * Persistidas apenas localmente (via `utils/storage.ts`, AsyncStorage já
 * existente no projeto) — NÃO no backend. O model `NotificationSetting`
 * atual (schema.prisma) só tem campos fixos de um recurso anterior e
 * não-relacionado (lembretes de rotina pessoal: `morningEnabled`,
 * `prospectEnabled`, `indriveEnabled`, `closingEnabled`) — não há coluna
 * para "follow-ups", "projetos e entregas" ou "pendências críticas". Como
 * a regra desta fase é não alterar schema/migration sem aprovação, essas
 * 4 preferências ficam no dispositivo por enquanto. Se no futuro fizer
 * sentido sincronizar entre aparelhos, a proposta seria adicionar 5 campos
 * novos ao model `NotificationSetting` (`crmFollowUpsEnabled`,
 * `crmProjectsEnabled`, `crmCriticalEnabled`, `crmDailyReminderEnabled`,
 * `crmDailyReminderTime`) — uma migration aditiva, sem quebrar nada
 * existente.
 */
export interface CrmNotificationPreferences {
  followUpsEnabled: boolean
  projectsEnabled: boolean
  criticalPendenciesEnabled: boolean
  dailyReminderEnabled: boolean
  dailyReminderTime: string
}

export const DEFAULT_CRM_NOTIFICATION_PREFERENCES: CrmNotificationPreferences = {
  followUpsEnabled: true,
  projectsEnabled: true,
  criticalPendenciesEnabled: true,
  dailyReminderEnabled: false,
  dailyReminderTime: '08:00',
}

/**
 * Fase 5.2 — Indica se um `PendencyItem` está, pelas preferências atuais,
 * dentro de uma categoria que pode gerar notificação. Usada tanto para
 * montar o plano de notificações (`getPendencyNotificationPlan`) quanto
 * para o indicador visual "🔔" na Central de Pendências (item 5.2E) — uma
 * função só, para não duplicar a regra de classificação em dois lugares.
 */
export function isPendencyNotifiable(item: PendencyItem, prefs: CrmNotificationPreferences): boolean {
  if (item.priority === 'CRITICO' && prefs.criticalPendenciesEnabled) return true

  if (
    (item.type === 'FOLLOW_UP_OVERDUE' || item.type === 'FOLLOW_UP_TODAY' || item.type === 'LEAD_STALE') &&
    prefs.followUpsEnabled
  ) {
    return true
  }

  if (
    (item.type === 'PROJECT_NO_NEXT_ACTION' ||
      item.type === 'PROJECT_NEAR_DEADLINE' ||
      item.type === 'PROJECT_OVERDUE' ||
      item.type === 'UPCOMING_DELIVERY' ||
      item.type === 'PENDING_SUBTASK') &&
    prefs.projectsEnabled
  ) {
    return true
  }

  return false
}

/** Fase 5.2 — Uma categoria agregada de alerta, pronta para agendar como notificação local. */
export interface PendencyNotificationCategory {
  identifier: string
  title: string
  body: string
  count: number
}

/** Fase 5.2 — janela (dias) para "subtarefa com prazo próximo" (baseado no `dueDate` da tarefa-mãe). */
const SUBTASK_DEADLINE_WARNING_DAYS = 3

/**
 * Fase 5.2B — Monta os "cenários mínimos" de notificação pedidos, como
 * categorias agregadas (uma notificação por categoria, não uma por item —
 * evita spam quando há muitas pendências do mesmo tipo). Cada categoria só
 * entra no plano se: (a) a preferência correspondente está ativada, e (b)
 * a contagem é maior que zero (nunca notifica lista vazia). Não agenda
 * nada sozinha — só descreve o que DEVERIA estar agendado; quem decide
 * agendar/cancelar de fato é `hooks/usePendencyNotifications.ts`,
 * comparando este plano com o que já estava agendado.
 *
 * "Entregas próximas" (`UPCOMING_DELIVERY`) e "leads sem retorno"
 * (`LEAD_STALE`) não têm categoria própria aqui: não estão nos cenários
 * mínimos pedidos para notificação (Fase 5.2B), embora continuem
 * aparecendo normalmente na Central de Pendências (Fase 5.1).
 */
export function getPendencyNotificationPlan(
  { leads, projects, followUps }: BuildPendenciesInput,
  preferences: CrmNotificationPreferences
): PendencyNotificationCategory[] {
  const now = new Date()
  const categories: PendencyNotificationCategory[] = []

  const followUpGroups = groupFollowUpsByUrgency(followUps)
  const health = getOperationalHealth(leads, projects)
  const overdueProjects = getOverdueProjects(projects)
  const pendingSubtasks = getPendingSubtasksSummary(projects)
  const prioritySubtasks = pendingSubtasks.filter((s) => s.taskPriority === 1)
  const nearDeadlineSubtasks = pendingSubtasks.filter((s) => {
    if (!s.taskDueDate) return false
    const days = daysUntil(s.taskDueDate, now)
    return days >= 0 && days <= SUBTASK_DEADLINE_WARNING_DAYS
  })

  if (preferences.followUpsEnabled) {
    if (followUpGroups.overdue.length > 0) {
      categories.push({
        identifier: 'crm-followup-overdue',
        title: '📅 Follow-ups atrasados',
        body: `Você tem ${followUpGroups.overdue.length} follow-up(s) atrasado(s).`,
        count: followUpGroups.overdue.length,
      })
    }
    if (followUpGroups.today.length > 0) {
      categories.push({
        identifier: 'crm-followup-today',
        title: '📅 Follow-ups de hoje',
        body: `Você tem ${followUpGroups.today.length} follow-up(s) para hoje.`,
        count: followUpGroups.today.length,
      })
    }
    if (followUpGroups.upcoming.length > 0) {
      categories.push({
        identifier: 'crm-followup-upcoming',
        title: '📅 Follow-ups próximos',
        body: `Você tem ${followUpGroups.upcoming.length} follow-up(s) nos próximos dias.`,
        count: followUpGroups.upcoming.length,
      })
    }
  }

  if (preferences.projectsEnabled) {
    if (overdueProjects.length > 0) {
      categories.push({
        identifier: 'crm-project-overdue',
        title: '🚨 Projeto(s) com prazo vencido',
        body: `${overdueProjects.length} projeto(s) passaram do prazo combinado.`,
        count: overdueProjects.length,
      })
    }
    if (health.projectsWithNearDeadline.length > 0) {
      categories.push({
        identifier: 'crm-project-near-deadline',
        title: '⏳ Prazo próximo',
        body: `${health.projectsWithNearDeadline.length} projeto(s) com prazo se aproximando.`,
        count: health.projectsWithNearDeadline.length,
      })
    }
    if (health.projectsWithoutNextAction.length > 0) {
      categories.push({
        identifier: 'crm-project-no-action',
        title: '⚡ Projetos sem próxima ação',
        body: `${health.projectsWithoutNextAction.length} projeto(s) sem próximo passo definido.`,
        count: health.projectsWithoutNextAction.length,
      })
    }
    if (prioritySubtasks.length > 0) {
      categories.push({
        identifier: 'crm-subtask-priority',
        title: '☑️ Subtarefas prioritárias pendentes',
        body: `${prioritySubtasks.length} subtarefa(s) de alta prioridade aguardando.`,
        count: prioritySubtasks.length,
      })
    }
    if (nearDeadlineSubtasks.length > 0) {
      categories.push({
        identifier: 'crm-subtask-deadline',
        title: '☑️ Subtarefas com prazo próximo',
        body: `${nearDeadlineSubtasks.length} subtarefa(s) com prazo da tarefa se aproximando.`,
        count: nearDeadlineSubtasks.length,
      })
    }
  }

  if (preferences.criticalPendenciesEnabled) {
    const criticalCount = buildPendencies({ leads, projects, followUps }).filter((i) => i.priority === 'CRITICO').length
    if (criticalCount > 0) {
      categories.push({
        identifier: 'crm-critical-pendencies',
        title: '🚨 Pendências críticas',
        body: `Você tem ${criticalCount} pendência(s) crítica(s) na Central de Pendências.`,
        count: criticalCount,
      })
    }
  }

  return categories
}