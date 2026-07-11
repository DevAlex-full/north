import type { Lead } from '../types/lead.types'
import type { Project } from '../types/project.types'
import {
  groupFollowUpsByUrgency,
  getOperationalHealth,
  getPendingSubtasksSummary,
  getUpcomingDeliveries,
} from './commercial'

/** Fase 5.1 — Tipo de pendência consolidada na Central de Pendências. */
export type PendencyType =
  | 'FOLLOW_UP_OVERDUE'
  | 'FOLLOW_UP_TODAY'
  | 'PROJECT_NO_NEXT_ACTION'
  | 'PROJECT_NEAR_DEADLINE'
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