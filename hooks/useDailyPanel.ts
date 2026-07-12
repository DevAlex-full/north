import { useState, useCallback } from 'react'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { useFollowUps } from './useFollowUps'
import { taskService } from '../services/task.service'
import { scheduleService } from '../services/schedule.service'
import { buildDailyPanel, type DailyPanelData } from '../utils/daily-panel'
import { getDayOfWeek } from '../utils/date'
import type { Task } from '../types/task.types'
import type { ScheduleBlock } from '../types/schedule.types'

/** Mesma janela usada em Pipeline/Dashboard Operacional/Central de Pendências. */
const FOLLOW_UP_WINDOW_DAYS = 7

/**
 * Fase 5.3 — Hook de orquestração do Painel Diário. Reaproveita
 * integralmente `useLeadStore`/`useProjectStore`/`useFollowUps` (mesmas
 * stores/hook já usadas em Pipeline, Dashboard Operacional e Central de
 * Pendências) e busca `Task`/`ScheduleBlock` diretamente pelos services
 * já existentes — não há store dedicada para esses dois domínios no
 * projeto (nem esta fase cria uma; mantém o mesmo padrão já usado pela
 * própria tela de Agenda, que também chama `taskService` diretamente).
 * Toda a derivação/priorização é delegada a `utils/daily-panel.ts`
 * (função pura) — este hook só busca dados e junta o resultado.
 */
export function useDailyPanel() {
  const { leads, fetchLeads } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()
  const { followUps, reload: reloadFollowUps } = useFollowUps(FOLLOW_UP_WINDOW_DAYS)

  const [tasks, setTasks] = useState<Task[]>([])
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [taskList, blockList] = await Promise.all([
        taskService.getAll() as Promise<Task[]>,
        scheduleService.getAll(getDayOfWeek()) as Promise<ScheduleBlock[]>,
      ])
      await Promise.all([fetchLeads(), fetchProjects(), reloadFollowUps()])
      setTasks(taskList)
      setScheduleBlocks(blockList)
    } catch {
      setError('Não foi possível carregar o painel diário')
    } finally {
      setIsLoading(false)
    }
  }, [fetchLeads, fetchProjects, reloadFollowUps])

  const data: DailyPanelData = buildDailyPanel({ leads, projects, followUps, tasks, scheduleBlocks })

  return { data, isLoading, error, reload }
}