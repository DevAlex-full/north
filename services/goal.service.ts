import api from './api'
export const goalService = {
  async getAll() { const r = await api.get('/goals'); return r.data },
  async create(data: any) { const r = await api.post('/goals', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/goals/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/goals/${id}`) },
}
