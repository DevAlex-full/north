import api from './api'
export const workanaService = {
  async getAll() { const r = await api.get('/workana'); return r.data },
  async getWeekCount() { const r = await api.get('/workana/week-count'); return r.data },
  async create(data: any) { const r = await api.post('/workana', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/workana/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/workana/${id}`) },
}
