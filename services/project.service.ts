import api from './api'
import type {
  Project,
  ProjectTask,
  ProjectFinance,
  ProjectSubTask,
  CreateProjectInput,
  UpdateProjectInput,
  CreateProjectTaskInput,
  UpdateProjectTaskInput,
  CreateSubTaskInput,
  UpdateSubTaskInput,
} from '../types/project.types'

export const projectService = {
  async getAll(kind?: string): Promise<Project[]> {
    const r = await api.get<Project[]>('/projects', { params: { kind } })
    return r.data
  },
  async getOne(id: string): Promise<Project> {
    const r = await api.get<Project>(`/projects/${id}`)
    return r.data
  },
  async create(data: CreateProjectInput): Promise<Project> {
    const r = await api.post<Project>('/projects', data)
    return r.data
  },
  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    const r = await api.put<Project>(`/projects/${id}`, data)
    return r.data
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/projects/${id}`)
  },
  async createTask(projectId: string, data: CreateProjectTaskInput): Promise<ProjectTask> {
    const r = await api.post<ProjectTask>(`/projects/${projectId}/tasks`, data)
    return r.data
  },
  async updateTask(projectId: string, taskId: string, data: UpdateProjectTaskInput): Promise<ProjectTask> {
    const r = await api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data)
    return r.data
  },
  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/tasks/${taskId}`)
  },

  // --- Fase 4.3B: Subtarefas ---

  async createSubTask(
    projectId: string,
    taskId: string,
    data: CreateSubTaskInput
  ): Promise<ProjectSubTask> {
    const r = await api.post<ProjectSubTask>(
      `/projects/${projectId}/tasks/${taskId}/subtasks`,
      data
    )
    return r.data
  },
  async updateSubTask(
    projectId: string,
    taskId: string,
    subId: string,
    data: UpdateSubTaskInput
  ): Promise<ProjectSubTask> {
    const r = await api.put<ProjectSubTask>(
      `/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`,
      data
    )
    return r.data
  },
  async deleteSubTask(projectId: string, taskId: string, subId: string): Promise<void> {
    await api.delete(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`)
  },

  /** Resumo financeiro do projeto (Fase 4: Financeiro do Projeto). */
  async getFinance(projectId: string): Promise<ProjectFinance> {
    const r = await api.get<ProjectFinance>(`/projects/${projectId}/finance`)
    return r.data
  },

  /**
   * Projetos de cliente vinculados a um Lead específico (relação
   * Cliente⇄Projeto). O backend ainda não expõe um filtro de query por
   * `clientId` (apenas `kind`) — por isso o filtro é aplicado aqui, sobre
   * a lista de projetos de cliente já retornada pelo endpoint existente.
   */
  async getByClient(clientId: string): Promise<Project[]> {
    const r = await api.get<Project[]>('/projects', { params: { kind: 'CLIENT' } })
    return r.data.filter((p) => p.clientId === clientId)
  },
}