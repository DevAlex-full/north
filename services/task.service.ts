import api from './api'
export const taskService = {
  async getAll(date?: string, status?: string) {
    const r = await api.get('/tasks', { params: { date, status } }); return r.data
  },
  async getProgress(date?: string) {
    const r = await api.get('/tasks/progress', { params: { date } }); return r.data
  },
  async create(data: any) { const r = await api.post('/tasks', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/tasks/${id}`, data); return r.data },
  async markDone(id: string) { return taskService.update(id, { status: 'DONE' }) },
  async delete(id: string) { await api.delete(`/tasks/${id}`) },
}
