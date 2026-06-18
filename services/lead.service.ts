import api from './api'
export const leadService = {
  async getAll(status?: string) { const r = await api.get('/leads', { params: { status } }); return r.data },
  async create(data: any) { const r = await api.post('/leads', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/leads/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/leads/${id}`) },
}
