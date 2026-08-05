import type { Project, ProjectTask } from '../types/project.types'

/**
 * Fase 6.1.7 — Fonte única de verdade para as regras de conclusão e
 * progresso de `ProjectTask`/`Project`. Módulo puro: sem React, Zustand,
 * Axios, API ou navegação — só depende dos tipos de domínio. Qualquer tela
 * ou util que precise saber se uma etapa está concluída, parcialmente
 * concluída, ou qual o progresso de um projeto, deve importar daqui em vez
 * de reimplementar a regra localmente.
 */

export interface ProjectTaskSubtaskProgress {
  done: number
  total: number
  percent: number
  isDone: boolean
  isPartial: boolean
}

export interface ProjectProgress {
  done: number
  total: number
  percent: number
}

/**
 * Uma etapa com subtarefas só é considerada concluída quando todas as
 * subtarefas estão DONE — o `task.status` persistido não é confiável
 * sozinho nesse caso (é o backend quem o recalcula, mas o frontend nunca
 * deve assumir que já está sincronizado sem checar as subtarefas). Sem
 * subtarefas, o único sinal de conclusão é o próprio `task.status`.
 */
export function isProjectTaskDone(task: ProjectTask): boolean {
  if (task.subtasks.length > 0) {
    return task.subtasks.every((s) => s.status === 'DONE')
  }
  return task.status === 'DONE'
}

/**
 * Verdadeiro somente quando a etapa tem subtarefas e elas estão num
 * estado misto — pelo menos uma DONE e pelo menos uma não-DONE. Uma etapa
 * sem subtarefas nunca é "parcial".
 */
export function isProjectTaskPartiallyDone(task: ProjectTask): boolean {
  if (task.subtasks.length === 0) return false
  const doneCount = task.subtasks.filter((s) => s.status === 'DONE').length
  return doneCount > 0 && doneCount < task.subtasks.length
}

/**
 * Progresso de uma única etapa. Sem subtarefas, a etapa inteira vale uma
 * unidade (0 ou 1, conforme `isProjectTaskDone`). Com subtarefas, o
 * progresso é calculado sobre elas.
 */
export function getProjectTaskSubtaskProgress(task: ProjectTask): ProjectTaskSubtaskProgress {
  if (task.subtasks.length === 0) {
    const isDone = isProjectTaskDone(task)
    return {
      total: 1,
      done: isDone ? 1 : 0,
      percent: isDone ? 100 : 0,
      isDone,
      isPartial: false,
    }
  }

  const total = task.subtasks.length
  const done = task.subtasks.filter((s) => s.status === 'DONE').length

  return {
    total,
    done,
    percent: Math.round((done / total) * 100),
    isDone: done === total,
    isPartial: done > 0 && done < total,
  }
}

/**
 * Progresso do projeto: cada `ProjectTask` vale uma unidade no
 * denominador, independente de quantas subtarefas tenha — as subtarefas
 * só decidem se aquela etapa conta como concluída ou não.
 */
export function getProjectProgress(project: Project): ProjectProgress {
  const total = project.projectTasks.length
  const done = project.projectTasks.filter((task) => isProjectTaskDone(task)).length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  return { done, total, percent }
}

/** Etapas do projeto ainda não concluídas, pela regra derivada (nunca por `task.status` direto). */
export function getPendingProjectTasks(project: Project): ProjectTask[] {
  return project.projectTasks.filter((task) => !isProjectTaskDone(task))
}