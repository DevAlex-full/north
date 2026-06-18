import api from './api'
export const scheduleService = {
  async getAll(dayOfWeek?: number) { const r = await api.get('/schedule', { params: { dayOfWeek } }); return r.data },
  async create(data: any) { const r = await api.post('/schedule', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/schedule/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/schedule/${id}`) },
}
