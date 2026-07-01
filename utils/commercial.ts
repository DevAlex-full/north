import type { Lead, LeadStatus } from '../types/lead.types'
import type { Project, ProjectFinance } from '../types/project.types'

/** As 7 colunas do Pipeline pedidas na Fase 4.2A, nesta ordem fixa. */
export type PipelineColumnKey =
  | 'NEW'
  | 'CONTACT'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED'
  | 'ACTIVE_CLIENT'
  | 'LOST'

export const PIPELINE_COLUMNS: { key: PipelineColumnKey; label: string }[] = [
  { key: 'NEW', label: 'Novo' },
  { key: 'CONTACT', label: 'Contato' },
  { key: 'PROPOSAL', label: 'Proposta' },
  { key: 'NEGOTIATION', label: 'Negociação' },
  { key: 'CLOSED', label: 'Fechado' },
  { key: 'ACTIVE_CLIENT', label: 'Cliente Ativo' },
  { key: 'LOST', label: 'Perdido' },
]

/**
 * Mapeia o status real do Lead (vindo do funil existente, Fase 3/4.1)
 * para a coluna do Pipeline em que ele deve aparecer. CONTACTED e REPLIED
 * compartilham a coluna "Contato" — ambos representam um lead já em
 * conversa, antes de uma proposta formal ser enviada.
 */
export function getPipelineColumn(status: LeadStatus): PipelineColumnKey {
  switch (status) {
    case 'NEW': return 'NEW'
    case 'CONTACTED':
    case 'REPLIED': return 'CONTACT'
    case 'PROPOSAL_SENT': return 'PROPOSAL'
    case 'NEGOTIATION': return 'NEGOTIATION'
    case 'CLOSED': return 'CLOSED'
    case 'ACTIVE_CLIENT': return 'ACTIVE_CLIENT'
    case 'LOST': return 'LOST'
    default: return 'NEW'
  }
}

/**
 * Próximo status sugerido no funil ao avançar um card de coluna, seguindo
 * exatamente o mesmo fluxo de ações rápidas já usado em
 * app/(tabs)/leads.tsx (quickStatus). `null` quando não há próxima etapa
 * natural (ex: a partir de "Cliente Ativo" ou "Perdido").
 */
export function getNextLeadStatus(status: LeadStatus): LeadStatus | null {
  switch (status) {
    case 'NEW': return 'CONTACTED'
    case 'CONTACTED': return 'REPLIED'
    case 'REPLIED': return 'PROPOSAL_SENT'
    case 'PROPOSAL_SENT': return 'NEGOTIATION'
    case 'NEGOTIATION': return 'CLOSED'
    case 'CLOSED': return 'ACTIVE_CLIENT'
    default: return null
  }
}

export interface PipelineCardData {
  lead: Lead
  linkedProject: Project | null
  /** Valor combinado a exibir: do projeto vinculado quando existir, senão o valor estimado do lead. */
  combinedValue: number | null
}

export interface PipelineColumnData {
  key: PipelineColumnKey
  label: string
  count: number
  totalValue: number
  cards: PipelineCardData[]
}

/**
 * Agrupa os leads nas 7 colunas do Pipeline, calculando quantidade e valor
 * total por coluna. `projects` é usado apenas para localizar o projeto de
 * cliente vinculado a cada lead (kind=CLIENT, clientId=lead.id) — nenhum
 * dado é duplicado, apenas relacionado.
 */
export function buildPipelineColumns(leads: Lead[], projects: Project[]): PipelineColumnData[] {
  const clientProjects = projects.filter((p) => p.kind === 'CLIENT')

  return PIPELINE_COLUMNS.map(({ key, label }) => {
    const columnLeads = leads.filter((lead) => getPipelineColumn(lead.status) === key)

    const cards: PipelineCardData[] = columnLeads.map((lead) => {
      const linkedProject = clientProjects.find((p) => p.clientId === lead.id) || null
      const combinedValue = linkedProject?.agreedValue ?? lead.estimatedValue ?? null
      return { lead, linkedProject, combinedValue }
    })

    const totalValue = cards.reduce((sum, c) => sum + (c.combinedValue || 0), 0)

    return { key, label, count: cards.length, totalValue, cards }
  })
}

/** Métricas do Dashboard Comercial (Fase 4.2B). */
export interface CommercialMetrics {
  totalLeads: number
  activeClients: number
  commercialProjects: number
  valueInNegotiation: number
  valueClosed: number
  expectedRevenue: number
  receivedRevenue: number
  pendingRevenue: number
  conversionRate: number
  closingRate: number
  upcomingContacts: Lead[]
  staleClients: Lead[]
}

const NEGOTIATION_COLUMNS: PipelineColumnKey[] = ['PROPOSAL', 'NEGOTIATION']
const CLOSED_COLUMNS: PipelineColumnKey[] = ['CLOSED', 'ACTIVE_CLIENT']

/**
 * Calcula as métricas do Dashboard Comercial inteiramente a partir de
 * Lead[], Project[] (kind=CLIENT) e do mapa de financeiro por projeto já
 * obtido via projectService.getFinance — sem nenhuma fonte de dado nova.
 *
 * `financeByProjectId` é opcional: quando ausente (ex: tela ainda
 * carregando o financeiro), receivedRevenue/pendingRevenue ficam em 0
 * sem quebrar o restante do cálculo.
 */
export function getCommercialMetrics(
  leads: Lead[],
  projects: Project[],
  financeByProjectId: Record<string, ProjectFinance> = {}
): CommercialMetrics {
  const clientProjects = projects.filter((p) => p.kind === 'CLIENT')
  const totalLeads = leads.length
  const activeClients = leads.filter((l) => l.status === 'ACTIVE_CLIENT').length

  const valueInNegotiation = leads
    .filter((l) => NEGOTIATION_COLUMNS.includes(getPipelineColumn(l.status)))
    .reduce((sum, l) => {
      const linked = clientProjects.find((p) => p.clientId === l.id)
      return sum + (linked?.agreedValue ?? l.estimatedValue ?? 0)
    }, 0)

  const valueClosed = leads
    .filter((l) => CLOSED_COLUMNS.includes(getPipelineColumn(l.status)))
    .reduce((sum, l) => {
      const linked = clientProjects.find((p) => p.clientId === l.id)
      return sum + (linked?.agreedValue ?? l.estimatedValue ?? 0)
    }, 0)

  const expectedRevenue = clientProjects.reduce((sum, p) => sum + (p.agreedValue || 0), 0)

  const receivedRevenue = clientProjects.reduce(
    (sum, p) => sum + (financeByProjectId[p.id]?.received ?? 0),
    0
  )
  const pendingRevenue = clientProjects.reduce(
    (sum, p) => sum + (financeByProjectId[p.id]?.pending ?? 0),
    0
  )

  const conversionRate = totalLeads > 0 ? (activeClients / totalLeads) * 100 : 0
  const closedOrActiveCount = leads.filter((l) => CLOSED_COLUMNS.includes(getPipelineColumn(l.status))).length
  const closingRate = totalLeads > 0 ? (closedOrActiveCount / totalLeads) * 100 : 0

  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcomingContacts = leads
    .filter((l) => l.followUpAt && new Date(l.followUpAt) >= now && new Date(l.followUpAt) <= in7Days)
    .sort((a, b) => new Date(a.followUpAt as string).getTime() - new Date(b.followUpAt as string).getTime())

  // "Sem retorno": leads ainda ativos no funil (não fechados, não cliente,
  // não perdidos) sem nenhum contato registrado há mais de 7 dias — ou
  // nunca contatados.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const inactiveStatuses: LeadStatus[] = ['CLOSED', 'ACTIVE_CLIENT', 'LOST']
  const staleClients = leads.filter((l) => {
    if (inactiveStatuses.includes(l.status)) return false
    if (!l.lastContactAt) return true
    return new Date(l.lastContactAt) < sevenDaysAgo
  })

  return {
    totalLeads,
    activeClients,
    commercialProjects: clientProjects.length,
    valueInNegotiation,
    valueClosed,
    expectedRevenue,
    receivedRevenue,
    pendingRevenue,
    conversionRate,
    closingRate,
    upcomingContacts,
    staleClients,
  }
}

/** Métricas exibidas no card de um cliente ativo (Fase 4.2D). */
export interface ClientMetrics {
  activeProjects: number
  completedProjects: number
  totalReceived: number
  totalPending: number
}

const ACTIVE_CLIENT_PROJECT_STATUSES = ['LEAD', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'DEVELOPMENT', 'SUPPORT']
const COMPLETED_CLIENT_PROJECT_STATUSES = ['DELIVERED', 'CANCELLED']

/**
 * Calcula as métricas de um cliente (lead com status ACTIVE_CLIENT) a
 * partir dos projetos vinculados a ele e do financeiro já obtido para
 * cada um (mesmo mapa usado no Dashboard Comercial).
 */
export function getClientMetrics(
  linkedProjects: Project[],
  financeByProjectId: Record<string, ProjectFinance> = {}
): ClientMetrics {
  const activeProjects = linkedProjects.filter(
    (p) => p.clientStatus && ACTIVE_CLIENT_PROJECT_STATUSES.includes(p.clientStatus)
  ).length

  const completedProjects = linkedProjects.filter(
    (p) => p.clientStatus && COMPLETED_CLIENT_PROJECT_STATUSES.includes(p.clientStatus)
  ).length

  const totalReceived = linkedProjects.reduce(
    (sum, p) => sum + (financeByProjectId[p.id]?.received ?? 0),
    0
  )
  const totalPending = linkedProjects.reduce(
    (sum, p) => sum + (financeByProjectId[p.id]?.pending ?? 0),
    0
  )

  return { activeProjects, completedProjects, totalReceived, totalPending }
}

/** Um evento na linha do tempo derivada de um projeto comercial. */
export interface TimelineEvent {
  id: string
  date: string
  icon: string
  label: string
}

/**
 * Deriva uma linha do tempo do projeto a partir dos próprios campos já
 * existentes (createdAt, tarefas concluídas, atualização mais recente) —
 * sem nenhuma tabela de histórico nova, conforme exigido na Fase 4.2C.
 */
export function buildProjectTimeline(project: Project): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { id: `${project.id}-created`, date: project.createdAt, icon: '🆕', label: 'Projeto criado' },
  ]

  project.projectTasks
    .filter((t) => t.status === 'DONE' && t.completedAt)
    .forEach((t) => {
      events.push({
        id: `task-${t.id}`,
        date: t.completedAt as string,
        icon: '✅',
        label: `Tarefa concluída: ${t.title}`,
      })
    })

  if (project.updatedAt !== project.createdAt) {
    events.push({ id: `${project.id}-updated`, date: project.updatedAt, icon: '🔄', label: 'Última atualização' })
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}