import api from './api'
export const dashboardService = {
  async get() { const r = await api.get('/dashboard'); return r.data },
}
