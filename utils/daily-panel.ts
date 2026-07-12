import type { Lead } from '../types/lead.types'
import type { Project } from '../types/project.types'
import type { Task } from '../types/task.types'
import type { ScheduleBlock } from '../types/schedule.types'
import { getTodayString, toDateStringSP, getCurrentTimeSP } from './date'
import {
  groupFollowUpsByUrgency,
  getOperationalHealth,
  getOverdueProjects,
  getPendingSubtasksSummary,
  getUpcomingDeliveries,
  getProjectTaskProgress,
  type FollowUpGroups,
  type ProjectTaskProgress,
} from './commercial'
import { buildPendencies } from './notifications'

/** Fase 5.3 — mesma escala de 4 níveis já usada em `utils/notifications.ts`, para manter a linguagem consistente entre Central de Pendências e Painel Diário. */
export type DailyPriority = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO'

export interface DailySummaryCounts {
  tasksToday: number
  tasksDone: number
  tasksPending: number
  followUpsToday: number
  followUpsOverdue: number
  pendingSubtasks: number
  upcomingDeliveries: number
  criticalPendencies: number
}

export type PriorityTaskOrigin = 'TASK' | 'PROJECT_TASK' | 'PROJECT_SUBTASK'

/** Fase 5.3 — Seção 3 (Tarefas prioritárias): item unificado, qualquer que seja a origem. */
export interface PriorityTaskItem {
  id: string
  origin: PriorityTaskOrigin
  title: string
  project: string | null
  deadline: string | null
  priority: DailyPriority
  status: string
  suggestedAction: string
}

export type ScheduleBlockStatus = 'AGORA' | 'CONCLUIDO' | 'EM_BREVE'

/** Fase 5.3 — Seção 2 (Agenda de hoje): bloco + status derivado (sem campo `status` no model) + tarefas vinculadas. */
export interface TodayScheduleItem {
  id: string
  title: string
  category: string | null
  startTime: string
  endTime: string
  status: ScheduleBlockStatus
  relatedTasks: { id: string; title: string; status: string }[]
}

/** Fase 5.3 — Seção 5 (Projetos em foco). */
export interface ProjectInFocus {
  id: string
  name: string
  client: string | null
  progress: ProjectTaskProgress
  deadline: string | null
  nextAction: string | null
  pendingCount: number
  reason: string
}

export interface DailyPanelData {
  summary: DailySummaryCounts
  scheduleToday: TodayScheduleItem[]
  priorityTasks: PriorityTaskItem[]
  followUps: FollowUpGroups
  projectsInFocus: ProjectInFocus[]
}

export interface BuildDailyPanelInput {
  leads: Lead[]
  projects: Project[]
  /** Resultado de `useFollowUps()`. */
  followUps: Lead[]
  tasks: Task[]
  scheduleBlocks: ScheduleBlock[]
}

const PRIORITY_RANK: Record<DailyPriority, number> = { CRITICO: 0, ALTO: 1, MEDIO: 2, BAIXO: 3 }

function getClientName(project: Project, leads: Lead[]): string | null {
  return leads.find((l) => l.id === project.clientId)?.name ?? null
}

/**
 * Fase 5.3 — Status derivado de um bloco de agenda (não existe campo
 * `status` em `ScheduleBlock`): compara o horário atual (São Paulo) com
 * `startTime`/`endTime` do próprio bloco.
 */
function getBlockStatus(block: ScheduleBlock, nowMinutes: number): ScheduleBlockStatus {
  const [startH, startM] = block.startTime.split(':').map(Number)
  const [endH, endM] = block.endTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM
  if (nowMinutes < startMinutes) return 'EM_BREVE'
  if (nowMinutes > endMinutes) return 'CONCLUIDO'
  return 'AGORA'
}

/** Seção 2 — Agenda de hoje: não duplica a lógica da tela de Agenda (que lista Task por data); aqui é só leitura de ScheduleBlock + suas Task vinculadas (`Task.scheduleBlockId`). */
function buildTodaySchedule(blocks: ScheduleBlock[], tasks: Task[]): TodayScheduleItem[] {
  const { hour, minute } = getCurrentTimeSP()
  const nowMinutes = hour * 60 + minute

  return [...blocks]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((block) => ({
      id: block.id,
      title: block.title,
      category: block.category,
      startTime: block.startTime,
      endTime: block.endTime,
      status: getBlockStatus(block, nowMinutes),
      relatedTasks: tasks
        .filter((t) => t.scheduleBlockId === block.id)
        .map((t) => ({ id: t.id, title: t.title, status: t.status })),
    }))
}

/** Seção 3 — Tarefas prioritárias: consolida Task pessoal + ProjectTask + ProjectSubTask, ordenado por urgência. */
function buildPriorityTasks(tasks: Task[], projects: Project[]): PriorityTaskItem[] {
  const today = getTodayString()
  const items: PriorityTaskItem[] = []

  // 1) Tarefas pessoais (Task): hoje, atrasadas, ou de alta prioridade — ainda não concluídas/puladas.
  tasks
    .filter((t) => t.status !== 'DONE' && t.status !== 'SKIPPED')
    .filter((t) => toDateStringSP(t.date) <= today || t.priority === 1)
    .forEach((t) => {
      const day = toDateStringSP(t.date)
      const priority: DailyPriority = day < today ? 'CRITICO' : t.priority === 1 ? 'ALTO' : 'MEDIO'
      items.push({
        id: `task-${t.id}`,
        origin: 'TASK',
        title: t.title,
        project: null,
        deadline: t.date,
        priority,
        status: t.status,
        suggestedAction: day < today ? 'Concluir ou reagendar a tarefa atrasada' : 'Concluir a tarefa hoje',
      })
    })

  // 2) ProjectTask prioritárias (priority=1, não concluídas), de qualquer projeto — pessoal ou de cliente.
  projects.forEach((p) => {
    ;(p.projectTasks ?? [])
      .filter((pt) => pt.priority === 1 && pt.status !== 'DONE')
      .forEach((pt) => {
        const overdue = !!pt.dueDate && toDateStringSP(pt.dueDate) < today
        items.push({
          id: `project-task-${pt.id}`,
          origin: 'PROJECT_TASK',
          title: pt.title,
          project: p.name,
          deadline: pt.dueDate,
          priority: overdue ? 'CRITICO' : 'ALTO',
          status: pt.status,
          suggestedAction: `Avançar a tarefa prioritária de "${p.name}"`,
        })
      })
  })

  // 3) ProjectSubTask pendentes prioritárias — reaproveita getPendingSubtasksSummary (já filtra status PENDING).
  getPendingSubtasksSummary(projects)
    .filter((s) => s.taskPriority === 1)
    .forEach((s) => {
      const overdue = !!s.taskDueDate && toDateStringSP(s.taskDueDate) < today
      items.push({
        id: `subtask-${s.subtaskId}`,
        origin: 'PROJECT_SUBTASK',
        title: s.subtaskTitle,
        project: s.projectName,
        deadline: s.taskDueDate,
        priority: overdue ? 'CRITICO' : 'ALTO',
        status: 'PENDING',
        suggestedAction: `Concluir subtarefa de "${s.taskTitle}"`,
      })
    })

  return items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
}

/** Seção 5 — Projetos em foco: reaproveita getOperationalHealth/getOverdueProjects/getPendingSubtasksSummary (nenhum cálculo novo de saúde do projeto). */
function buildProjectsInFocus(leads: Lead[], projects: Project[]): ProjectInFocus[] {
  const health = getOperationalHealth(leads, projects)
  const overdueProjects = getOverdueProjects(projects)
  const nearDeadlineIds = new Set(health.projectsWithNearDeadline.map((p) => p.id))
  const noActionIds = new Set(health.projectsWithoutNextAction.map((p) => p.id))
  const overdueIds = new Set(overdueProjects.map((p) => p.id))
  const prioritySubtaskProjectIds = new Set(
    getPendingSubtasksSummary(projects)
      .filter((s) => s.taskPriority === 1)
      .map((s) => s.projectId)
  )

  const relevant = projects.filter(
    (p) =>
      overdueIds.has(p.id) ||
      nearDeadlineIds.has(p.id) ||
      noActionIds.has(p.id) ||
      prioritySubtaskProjectIds.has(p.id) ||
      p.clientStatus === 'DEVELOPMENT'
  )

  return relevant
    .map((p) => {
      const progress = getProjectTaskProgress(p)
      const reasons: string[] = []
      if (overdueIds.has(p.id)) reasons.push('prazo vencido')
      if (nearDeadlineIds.has(p.id)) reasons.push('prazo próximo')
      if (noActionIds.has(p.id)) reasons.push('sem próxima ação')
      if (prioritySubtaskProjectIds.has(p.id)) reasons.push('subtarefas prioritárias pendentes')
      if (reasons.length === 0 && p.clientStatus === 'DEVELOPMENT') reasons.push('em desenvolvimento')

      return {
        id: p.id,
        name: p.name,
        client: getClientName(p, leads),
        progress,
        deadline: p.deadline,
        nextAction: p.nextAction,
        pendingCount: progress.total - progress.done,
        reason: reasons.join(' · ') || 'em acompanhamento',
      }
    })
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    })
}

/**
 * Fase 5.3B/5.3C — Monta o Painel Diário inteiro a partir de dados já
 * carregados pelas stores/hooks existentes (`leads`, `projects`,
 * `followUps` de `useFollowUps()`, `tasks`, `scheduleBlocks`). Função pura:
 * nenhuma chamada HTTP, nenhuma persistência, sempre o mesmo resultado
 * para a mesma entrada. Reaproveita integralmente `utils/commercial.ts`
 * (saúde da operação, entregas, subtarefas, progresso) e
 * `utils/notifications.ts` (`buildPendencies`, para a contagem de
 * pendências críticas) — nenhum cálculo de negócio é reescrito aqui.
 */
export function buildDailyPanel({ leads, projects, followUps, tasks, scheduleBlocks }: BuildDailyPanelInput): DailyPanelData {
  const today = getTodayString()

  const todayTasks = tasks.filter((t) => toDateStringSP(t.date) === today)
  const tasksDone = todayTasks.filter((t) => t.status === 'DONE').length
  const tasksPending = todayTasks.filter((t) => t.status !== 'DONE' && t.status !== 'SKIPPED').length

  const followUpGroups = groupFollowUpsByUrgency(followUps)
  const pendingSubtasks = getPendingSubtasksSummary(projects)
  const upcomingDeliveries = getUpcomingDeliveries(projects)
  const criticalPendencies = buildPendencies({ leads, projects, followUps }).filter((i) => i.priority === 'CRITICO').length

  const summary: DailySummaryCounts = {
    tasksToday: todayTasks.length,
    tasksDone,
    tasksPending,
    followUpsToday: followUpGroups.today.length,
    followUpsOverdue: followUpGroups.overdue.length,
    pendingSubtasks: pendingSubtasks.length,
    upcomingDeliveries: upcomingDeliveries.length,
    criticalPendencies,
  }

  return {
    summary,
    scheduleToday: buildTodaySchedule(scheduleBlocks, tasks),
    priorityTasks: buildPriorityTasks(tasks, projects),
    followUps: followUpGroups,
    projectsInFocus: buildProjectsInFocus(leads, projects),
  }
}