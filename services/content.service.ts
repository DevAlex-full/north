import api from './api'
export const contentService = {
  async getAll(platform?: string) { const r = await api.get('/content', { params: { platform } }); return r.data },
  async create(data: any) { const r = await api.post('/content', data); return r.data },
  async update(id: string, data: any) { const r = await api.put(`/content/${id}`, data); return r.data },
  async delete(id: string) { await api.delete(`/content/${id}`) },
}
