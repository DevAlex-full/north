import api from './api'
export const jobService = {
  async getAll() { const r = await api.get('/jobs'); return r.data },
  async create(data: any) { const r = await api.post('/jobs', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/jobs/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/jobs/${id}`) },
}
