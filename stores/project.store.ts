import { create } from 'zustand'
import { projectService } from '../services/project.service'
import type {
  Project,
  ProjectTask,
  ProjectFinance,
  CreateProjectInput,
  UpdateProjectInput,
  CreateProjectTaskInput,
  UpdateProjectTaskInput,
  CreateSubTaskInput,
  UpdateSubTaskInput,
} from '../types/project.types'

/**
 * Fase 6.1.7 — Substitui, dentro da lista de projetos, a `ProjectTask`
 * completa retornada por uma mutação consolidada do backend. Único ponto
 * que sabe "onde" uma tarefa mora dentro de `Project[]` — nenhuma action
 * deve reimplementar essa busca/substituição.
 *
 * - Localiza somente o projeto com `id === projectId`.
 * - Dentro dele, localiza somente a tarefa com `id === task.id`.
 * - Substitui a tarefa inteira (incluindo `task.subtasks`, já vindo
 *   consolidado do backend) — nunca reconstrói subtarefas manualmente.
 * - Todos os demais projetos e tarefas são preservados por referência.
 */
function replaceTaskInProjects(projects: Project[], projectId: string, task: ProjectTask): Project[] {
  return projects.map((p) => {
    if (p.id !== projectId) return p
    return {
      ...p,
      projectTasks: p.projectTasks.map((t) => (t.id === task.id ? task : t)),
    }
  })
}

interface ProjectStore {
  projects: Project[]
  isLoading: boolean
  error: string | null

  /** Fase 6.1.7 — loading granular: mutação em andamento para uma ProjectTask específica (por `taskId`). */
  mutatingTaskIds: Record<string, boolean>
  /** Fase 6.1.7 — loading granular: mutação em andamento para uma ProjectSubTask específica (por `subId`). */
  mutatingSubTaskIds: Record<string, boolean>

  fetchProjects: (kind?: string) => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, data: UpdateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>

  createTask: (projectId: string, data: CreateProjectTaskInput) => Promise<ProjectTask>
  updateTask: (projectId: string, taskId: string, data: UpdateProjectTaskInput) => Promise<ProjectTask>
  deleteTask: (projectId: string, taskId: string) => Promise<void>

  // --- Fase 4.3B: Subtarefas (Fase 6.1.7: retorno consolidado + serialização por taskId) ---
  createSubTask: (
    projectId: string,
    taskId: string,
    data: CreateSubTaskInput
  ) => Promise<ProjectTask>
  updateSubTask: (
    projectId: string,
    taskId: string,
    subId: string,
    data: UpdateSubTaskInput
  ) => Promise<ProjectTask>
  deleteSubTask: (projectId: string, taskId: string, subId: string) => Promise<ProjectTask>

  getFinance: (projectId: string) => Promise<ProjectFinance>
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  /** Fase 6.1.7 — marca/desmarca uma ProjectTask como "em mutação". */
  const setTaskMutating = (taskId: string, mutating: boolean) => {
    set((state) => {
      const mutatingTaskIds = { ...state.mutatingTaskIds }
      if (mutating) {
        mutatingTaskIds[taskId] = true
      } else {
        delete mutatingTaskIds[taskId]
      }
      return { mutatingTaskIds }
    })
  }

  /** Fase 6.1.7 — marca/desmarca uma ProjectSubTask como "em mutação". */
  const setSubTaskMutating = (subId: string, mutating: boolean) => {
    set((state) => {
      const mutatingSubTaskIds = { ...state.mutatingSubTaskIds }
      if (mutating) {
        mutatingSubTaskIds[subId] = true
      } else {
        delete mutatingSubTaskIds[subId]
      }
      return { mutatingSubTaskIds }
    })
  }

  /**
   * Fase 6.1.7 — Uma ProjectTask é a unidade de serialização: enquanto
   * `mutatingTaskIds[taskId]` for `true`, nenhuma nova mutação da mesma
   * tarefa (nem de suas subtarefas) pode iniciar, para não deixar
   * respostas HTTP fora de ordem corromperem o estado local.
   */
  const assertTaskNotMutating = (taskId: string) => {
    if (get().mutatingTaskIds[taskId]) {
      throw new Error('Esta etapa já está sendo atualizada')
    }
  }

  return {
    projects: [],
    isLoading: false,
    error: null,
    mutatingTaskIds: {},
    mutatingSubTaskIds: {},

    fetchProjects: async (kind) => {
      set({ isLoading: true, error: null })
      try {
        const projects = await projectService.getAll(kind)
        set({ projects, isLoading: false })
      } catch {
        set({ error: 'Não foi possível carregar os projetos', isLoading: false })
      }
    },

    createProject: async (data) => {
      const created = await projectService.create(data)
      set((state) => ({ projects: [created, ...state.projects] }))
      return created
    },

    updateProject: async (id, data) => {
      const updated = await projectService.update(id, data)
      set((state) => ({ projects: state.projects.map((p) => (p.id === id ? updated : p)) }))
      return updated
    },

    deleteProject: async (id) => {
      await projectService.delete(id)
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
    },

    createTask: async (projectId, data) => {
      // A tarefa ainda não existe (não há taskId prévio), então não há
      // concorrência a bloquear aqui — o backend já retorna `subtasks: []`.
      const task = await projectService.createTask(projectId, data)
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, projectTasks: [...p.projectTasks, task] } : p
        ),
      }))
      return task
    },

    updateTask: async (projectId, taskId, data) => {
      assertTaskNotMutating(taskId)
      setTaskMutating(taskId, true)
      try {
        const task = await projectService.updateTask(projectId, taskId, data)
        set((state) => ({ projects: replaceTaskInProjects(state.projects, projectId, task) }))
        return task
      } finally {
        setTaskMutating(taskId, false)
      }
    },

    deleteTask: async (projectId, taskId) => {
      assertTaskNotMutating(taskId)
      setTaskMutating(taskId, true)
      try {
        await projectService.deleteTask(projectId, taskId)
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, projectTasks: p.projectTasks.filter((t) => t.id !== taskId) }
              : p
          ),
        }))
      } finally {
        setTaskMutating(taskId, false)
      }
    },

    // --- Fase 4.3B: Subtarefas (Fase 6.1.7) ---

    createSubTask: async (projectId, taskId, data) => {
      assertTaskNotMutating(taskId)
      setTaskMutating(taskId, true)
      try {
        const task = await projectService.createSubTask(projectId, taskId, data)
        set((state) => ({ projects: replaceTaskInProjects(state.projects, projectId, task) }))
        return task
      } finally {
        setTaskMutating(taskId, false)
      }
    },

    updateSubTask: async (projectId, taskId, subId, data) => {
      assertTaskNotMutating(taskId)
      setTaskMutating(taskId, true)
      setSubTaskMutating(subId, true)
      try {
        const task = await projectService.updateSubTask(projectId, taskId, subId, data)
        set((state) => ({ projects: replaceTaskInProjects(state.projects, projectId, task) }))
        return task
      } finally {
        setTaskMutating(taskId, false)
        setSubTaskMutating(subId, false)
      }
    },

    deleteSubTask: async (projectId, taskId, subId) => {
      assertTaskNotMutating(taskId)
      setTaskMutating(taskId, true)
      setSubTaskMutating(subId, true)
      try {
        const task = await projectService.deleteSubTask(projectId, taskId, subId)
        set((state) => ({ projects: replaceTaskInProjects(state.projects, projectId, task) }))
        return task
      } finally {
        setTaskMutating(taskId, false)
        setSubTaskMutating(subId, false)
      }
    },

    getFinance: async (projectId) => {
      return projectService.getFinance(projectId)
    },
  }
})