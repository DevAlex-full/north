import type { Lead, LeadStatus } from '../types/lead.types'
import type { Project, ProjectFinance, ProjectTask } from '../types/project.types'
import { startOfDaySP, endOfDaySP, getTodayString } from './date'

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
  /** Fase 4.4D — soma de `ProjectFinance.spent` de todos os projetos de cliente. */
  totalSpent: number
  /**
   * Fase 4.4D — lucro estimado com base no valor total combinado dos
   * projetos de cliente menos os custos já incorridos
   * (`expectedRevenue - totalSpent`). É uma projeção "se tudo for pago",
   * diferente do lucro já realizado por projeto (`ProjectFinance.profit`,
   * que é `received - spent`) — as duas leituras coexistem de propósito:
   * uma é o retrato de hoje, a outra é a expectativa do contrato inteiro.
   */
  estimatedProfit: number
  conversionRate: number
  closingRate: number
  upcomingContacts: Lead[]
  staleClients: Lead[]
  /** Fase 4.5 — leads ainda "em jogo" no funil (não fechados, não cliente, não perdidos). */
  openLeads: number
  /** Fase 4.5 — projetos de cliente fora dos status terminais (DELIVERED/CANCELLED). */
  activeProjects: number
}

const NEGOTIATION_COLUMNS: PipelineColumnKey[] = ['PROPOSAL', 'NEGOTIATION']
const CLOSED_COLUMNS: PipelineColumnKey[] = ['CLOSED', 'ACTIVE_CLIENT']

/**
 * Fase 4.5 — status de lead considerados "fora do funil ativo": já
 * fechado, já virou cliente, ou perdido. Extraído para constante
 * compartilhada porque tanto `staleClients` (dentro de
 * getCommercialMetrics) quanto `openLeads` (novo nesta fase) e
 * `getOperationalHealth` precisam exatamente do mesmo critério — evita
 * duas definições divergentes do "mesmo" conceito.
 */
const CLOSED_LEAD_STATUSES: LeadStatus[] = ['CLOSED', 'ACTIVE_CLIENT', 'LOST']

/**
 * Fase 4.5 — Leads ainda no funil (não fechados/cliente/perdidos) sem
 * contato registrado nos últimos 7 dias, ou nunca contatados. Extraído de
 * dentro de `getCommercialMetrics` para função própria porque
 * `getOperationalHealth` (Fase 4.5) também precisa exatamente do mesmo
 * cálculo — uma função, dois usos, sem recalcular a regra duas vezes.
 */
function computeStaleLeads(leads: Lead[]): Lead[] {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return leads.filter((l) => {
    if (CLOSED_LEAD_STATUSES.includes(l.status)) return false
    if (!l.lastContactAt) return true
    return new Date(l.lastContactAt) < sevenDaysAgo
  })
}

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

  // Fase 4.4D — Custos e lucro estimado, mesma fonte (financeByProjectId,
  // já derivado de FinancialTransaction) e mesmo padrão de soma usado acima.
  const totalSpent = clientProjects.reduce(
    (sum, p) => sum + (financeByProjectId[p.id]?.spent ?? 0),
    0
  )
  const estimatedProfit = expectedRevenue - totalSpent

  const conversionRate = totalLeads > 0 ? (activeClients / totalLeads) * 100 : 0
  const closedOrActiveCount = leads.filter((l) => CLOSED_COLUMNS.includes(getPipelineColumn(l.status))).length
  const closingRate = totalLeads > 0 ? (closedOrActiveCount / totalLeads) * 100 : 0

  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const upcomingContacts = leads
    .filter((l) => l.followUpAt && new Date(l.followUpAt) >= now && new Date(l.followUpAt) <= in7Days)
    .sort((a, b) => new Date(a.followUpAt as string).getTime() - new Date(b.followUpAt as string).getTime())

  const staleClients = computeStaleLeads(leads)

  // Fase 4.5 — Leads em aberto (ainda no funil) e projetos comerciais ativos.
  const openLeads = leads.filter((l) => !CLOSED_LEAD_STATUSES.includes(l.status)).length
  const activeProjects = clientProjects.filter(
    (p) => !COMPLETED_CLIENT_PROJECT_STATUSES.includes(p.clientStatus ?? '')
  ).length

  return {
    totalLeads,
    activeClients,
    commercialProjects: clientProjects.length,
    valueInNegotiation,
    valueClosed,
    expectedRevenue,
    receivedRevenue,
    pendingRevenue,
    totalSpent,
    estimatedProfit,
    conversionRate,
    closingRate,
    upcomingContacts,
    staleClients,
    openLeads,
    activeProjects,
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

/** Follow-ups agrupados por urgência (Fase 4.4C). */
export interface FollowUpGroups {
  overdue: Lead[]
  today: Lead[]
  upcoming: Lead[]
}

/**
 * Fase 4.4C — Agrupa os leads retornados por `useFollowUps()` em 3 baldes
 * visuais: atrasados, hoje e próximos dias. A comparação sempre passa pelo
 * calendário de São Paulo (`startOfDaySP`/`endOfDaySP`/`getTodayString`,
 * já usados no resto do app) — nunca pelo fuso do dispositivo nem por um
 * corte bruto de timestamp, que classificaria erradamente um follow-up
 * "hoje às 23h" como atrasado perto da meia-noite em alguns fusos.
 * Cada balde vem ordenado por data crescente (mais urgente primeiro).
 */
export function groupFollowUpsByUrgency(leads: Lead[]): FollowUpGroups {
  const todayStart = startOfDaySP(getTodayString()).getTime()
  const todayEnd = endOfDaySP(getTodayString()).getTime()

  const withFollowUp = leads.filter((l) => !!l.followUpAt)
  const byDateAsc = (a: Lead, b: Lead) =>
    new Date(a.followUpAt as string).getTime() - new Date(b.followUpAt as string).getTime()

  const overdue = withFollowUp
    .filter((l) => new Date(l.followUpAt as string).getTime() < todayStart)
    .sort(byDateAsc)
  const today = withFollowUp
    .filter((l) => {
      const t = new Date(l.followUpAt as string).getTime()
      return t >= todayStart && t <= todayEnd
    })
    .sort(byDateAsc)
  const upcoming = withFollowUp
    .filter((l) => new Date(l.followUpAt as string).getTime() > todayEnd)
    .sort(byDateAsc)

  return { overdue, today, upcoming }
}

/** Status de projeto considerados "concluídos"/terminais (Fase 4.2D, reaproveitado na 4.5). */
const TERMINAL_PROJECT_STATUSES = COMPLETED_CLIENT_PROJECT_STATUSES

const DEADLINE_WARNING_DAYS = 7
const STALLED_DAYS_THRESHOLD = 14
/** Fase 4.5 — horizonte da lista/contador de "Entregas próximas" (mais largo que o alerta de "prazo próximo" da Saúde da Operação). */
const UPCOMING_DELIVERY_DAYS = 14

/** Indicadores de saúde da operação (Fase 4.5 — Dashboard Operacional). */
export interface OperationalHealth {
  /** Projetos de cliente ativos sem `nextAction` preenchido. */
  projectsWithoutNextAction: Project[]
  /** Clientes ativos (`status === 'ACTIVE_CLIENT'`) sem `followUpAt` agendado. */
  clientsWithoutFollowUp: Lead[]
  /** Projetos ativos com `deadline` dentro dos próximos `DEADLINE_WARNING_DAYS` dias. */
  projectsWithNearDeadline: Project[]
  /** Projetos ativos sem nenhuma atualização (`updatedAt`) há mais de `STALLED_DAYS_THRESHOLD` dias. */
  stalledProjects: Project[]
  /** Leads sem retorno — mesmo critério de `staleClients` em getCommercialMetrics. */
  staleLeads: Lead[]
  /** Total de subtarefas pendentes em todos os projetos (pessoais + cliente). */
  pendingSubtasksCount: number
}

/**
 * Fase 4.5 — Calcula os 6 indicadores de "saúde da operação" pedidos,
 * inteiramente a partir de Lead[]/Project[] já carregados pelas stores —
 * nenhuma chamada nova, nenhum dado novo. `projectsWithNearDeadline` e
 * `stalledProjects` só consideram projetos de cliente fora de status
 * terminais (DELIVERED/CANCELLED): um projeto já entregue não é "atrasado"
 * nem "parado", é só um projeto encerrado.
 */
export function getOperationalHealth(leads: Lead[], projects: Project[]): OperationalHealth {
  const now = new Date()
  const deadlineLimit = new Date(now.getTime() + DEADLINE_WARNING_DAYS * 24 * 60 * 60 * 1000)
  const stalledLimit = new Date(now.getTime() - STALLED_DAYS_THRESHOLD * 24 * 60 * 60 * 1000)

  const activeClientProjects = projects.filter(
    (p) => p.kind === 'CLIENT' && !TERMINAL_PROJECT_STATUSES.includes(p.clientStatus ?? '')
  )

  const projectsWithoutNextAction = activeClientProjects.filter((p) => !p.nextAction)

  const clientsWithoutFollowUp = leads.filter((l) => l.status === 'ACTIVE_CLIENT' && !l.followUpAt)

  const projectsWithNearDeadline = activeClientProjects
    .filter((p) => p.deadline && new Date(p.deadline) >= now && new Date(p.deadline) <= deadlineLimit)
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())

  const stalledProjects = activeClientProjects
    .filter((p) => new Date(p.updatedAt) < stalledLimit)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())

  const staleLeads = computeStaleLeads(leads)

  const pendingSubtasksCount = getPendingSubtasksSummary(projects).length

  return {
    projectsWithoutNextAction,
    clientsWithoutFollowUp,
    projectsWithNearDeadline,
    stalledProjects,
    staleLeads,
    pendingSubtasksCount,
  }
}

/** Uma subtarefa pendente, achatada com o contexto da tarefa/projeto (Fase 4.5). */
export interface PendingSubtaskItem {
  subtaskId: string
  subtaskTitle: string
  taskTitle: string
  taskPriority: number
  projectId: string
  projectName: string
}

/**
 * Fase 4.5 — Lista achatada de todas as subtarefas pendentes (em
 * projetos pessoais e de cliente), ordenada por prioridade da tarefa-mãe
 * (1 = alta primeiro). Usada tanto para o contador de "Saúde da Operação"
 * (`pendingSubtasksCount`) quanto para a lista de "Prioridades do Dia" —
 * uma função só, para não percorrer `projectTasks`/`subtasks` duas vezes
 * com regras potencialmente divergentes.
 */
export function getPendingSubtasksSummary(projects: Project[]): PendingSubtaskItem[] {
  const items: PendingSubtaskItem[] = []
  projects.forEach((p) => {
    ;(p.projectTasks ?? []).forEach((t: ProjectTask) => {
      ;(t.subtasks ?? [])
        .filter((s) => s.status === 'PENDING')
        .forEach((s) => {
          items.push({
            subtaskId: s.id,
            subtaskTitle: s.title,
            taskTitle: t.title,
            taskPriority: t.priority,
            projectId: p.id,
            projectName: p.name,
          })
        })
    })
  })
  return items.sort((a, b) => a.taskPriority - b.taskPriority)
}

/**
 * Fase 4.5 — Projetos de cliente ativos que já têm uma `nextAction`
 * definida, ordenados por prazo (sem prazo vai por último). Base da seção
 * "Projetos com próxima ação" em Prioridades do Dia.
 */
export function getProjectsWithNextAction(projects: Project[]): Project[] {
  return projects
    .filter(
      (p) => p.kind === 'CLIENT' && !TERMINAL_PROJECT_STATUSES.includes(p.clientStatus ?? '') && !!p.nextAction
    )
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })
}

/** Progresso de tarefas de um projeto (Fase 4.5). */
export interface ProjectTaskProgress {
  done: number
  total: number
  percent: number
}

/**
 * Fase 4.5 — Progresso de um projeto pelo mesmo critério já usado em
 * app/projetos.tsx (`isTaskDone`): uma tarefa com subtarefas é
 * considerada concluída quando todas as subtarefas estão DONE; sem
 * subtarefas, usa o `task.status` da própria tarefa. Replicado aqui (em
 * vez de importado de projetos.tsx, que não exporta essa função) para não
 * precisar tocar num arquivo já validado nas Fases 4.3/4.4 só por causa
 * de um refactor de baixo risco.
 */
export function getProjectTaskProgress(project: Project): ProjectTaskProgress {
  const tasks = project.projectTasks ?? []
  const isDone = (t: ProjectTask) => {
    const subtasks = t.subtasks ?? []
    return subtasks.length > 0 ? subtasks.every((s) => s.status === 'DONE') : t.status === 'DONE'
  }
  const done = tasks.filter(isDone).length
  const total = tasks.length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return { done, total, percent }
}

/**
 * Fase 4.5 — Projetos de cliente ativos com `deadline` dentro dos
 * próximos `days` dias (padrão: 14). Base tanto do card "Entregas
 * próximas" (visão executiva) quanto da seção "Próximas Entregas"
 * (listagem detalhada) — mesma função, dois usos.
 */
export function getUpcomingDeliveries(projects: Project[], days: number = UPCOMING_DELIVERY_DAYS): Project[] {
  const now = new Date()
  const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  return projects
    .filter((p) => p.kind === 'CLIENT' && !TERMINAL_PROJECT_STATUSES.includes(p.clientStatus ?? ''))
    .filter((p) => p.deadline && new Date(p.deadline) >= now && new Date(p.deadline) <= limit)
    .sort((a, b) => new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime())
}