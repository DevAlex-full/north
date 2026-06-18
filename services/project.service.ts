import api from './api'
export const projectService = {
  async getAll() { const r = await api.get('/projects'); return r.data },
  async create(data: any) { const r = await api.post('/projects', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/projects/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/projects/${id}`) },
  async createTask(projectId: string, data: any) { const r = await api.post(`/projects/${projectId}/tasks`, data); return r.data },
  async updateTask(projectId: string, taskId: string, data: any) { const r = await api.put(`/projects/${projectId}/tasks/${taskId}`, data); return r.data },
  async deleteTask(projectId: string, taskId: string) { await api.delete(`/projects/${projectId}/tasks/${taskId}`) },
}
