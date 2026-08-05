import api from './api'
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

  // --- Fase 4.3B: Subtarefas (Fase 6.1.7: contratos alinhados ao backend consolidado) ---

  /**
   * O backend (Fase 6.1.6) retorna a `ProjectTask` completa e consolidada
   * — incluindo `subtasks` — nesta operação, não mais apenas a subtarefa
   * criada.
   */
  async createSubTask(
    projectId: string,
    taskId: string,
    data: CreateSubTaskInput
  ): Promise<ProjectTask> {
    const r = await api.post<ProjectTask>(
      `/projects/${projectId}/tasks/${taskId}/subtasks`,
      data
    )
    return r.data
  },
  /**
   * O backend (Fase 6.1.6) retorna a `ProjectTask` completa e consolidada
   * nesta operação, não mais apenas a subtarefa atualizada.
   */
  async updateSubTask(
    projectId: string,
    taskId: string,
    subId: string,
    data: UpdateSubTaskInput
  ): Promise<ProjectTask> {
    const r = await api.put<ProjectTask>(
      `/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`,
      data
    )
    return r.data
  },
  /**
   * O backend (Fase 6.1.6) alterou este endpoint de `204 No Content` para
   * `200 OK` com a `ProjectTask` consolidada após a exclusão e o
   * recálculo de status.
   */
  async deleteSubTask(projectId: string, taskId: string, subId: string): Promise<ProjectTask> {
    const r = await api.delete<ProjectTask>(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`)
    return r.data
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