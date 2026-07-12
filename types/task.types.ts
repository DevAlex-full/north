/** Espelha o enum de status usado em `Task.status` (schema.prisma). */
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'

/**
 * Entidade Task (tarefa diária pessoal, distinta de ProjectTask). Tipo
 * novo — `services/task.service.ts` era usado sem tipagem (`any`) desde
 * fases anteriores; esta interface só formaliza o shape já retornado pela
 * API, sem alterar o service.
 */
export interface Task {
  id: string
  userId: string
  scheduleBlockId: string | null
  title: string
  description: string | null
  date: string
  status: TaskStatus
  priority: number
  isRecurring: boolean
  completedAt: string | null
  observation: string | null
  createdAt: string
  updatedAt: string
}