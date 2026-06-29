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
} from '../types/project.types'

interface ProjectStore {
  projects: Project[]
  isLoading: boolean
  error: string | null

  fetchProjects: (kind?: string) => Promise<void>
  createProject: (data: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, data: UpdateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>

  createTask: (projectId: string, data: CreateProjectTaskInput) => Promise<ProjectTask>
  updateTask: (projectId: string, taskId: string, data: UpdateProjectTaskInput) => Promise<ProjectTask>
  deleteTask: (projectId: string, taskId: string) => Promise<void>

  getFinance: (projectId: string) => Promise<ProjectFinance>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

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
    set({ projects: [created, ...get().projects] })
    return created
  },

  updateProject: async (id, data) => {
    const updated = await projectService.update(id, data)
    set({ projects: get().projects.map((p) => (p.id === id ? updated : p)) })
    return updated
  },

  deleteProject: async (id) => {
    await projectService.delete(id)
    set({ projects: get().projects.filter((p) => p.id !== id) })
  },

  createTask: async (projectId, data) => {
    const task = await projectService.createTask(projectId, data)
    set({
      projects: get().projects.map((p) =>
        p.id === projectId ? { ...p, projectTasks: [...p.projectTasks, task] } : p
      ),
    })
    return task
  },

  updateTask: async (projectId, taskId, data) => {
    const task = await projectService.updateTask(projectId, taskId, data)
    set({
      projects: get().projects.map((p) =>
        p.id === projectId
          ? { ...p, projectTasks: p.projectTasks.map((t) => (t.id === taskId ? task : t)) }
          : p
      ),
    })
    return task
  },

  deleteTask: async (projectId, taskId) => {
    await projectService.deleteTask(projectId, taskId)
    set({
      projects: get().projects.map((p) =>
        p.id === projectId
          ? { ...p, projectTasks: p.projectTasks.filter((t) => t.id !== taskId) }
          : p
      ),
    })
  },

  getFinance: async (projectId) => {
    return projectService.getFinance(projectId)
  },
}))