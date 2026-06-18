import api from './api'
export const financialService = {
  async getCategories() { const r = await api.get('/financial/categories'); return r.data },
  async createCategory(data: any) { const r = await api.post('/financial/categories', data); return r.data },
  async deleteCategory(id: string) { await api.delete(`/financial/categories/${id}`) },
  async getTransactions(filters?: any) { const r = await api.get('/financial/transactions', { params: filters }); return r.data },
  async createTransaction(data: any) { const r = await api.post('/financial/transactions', data); return r.data },
  async updateTransaction(id: string, data: any) { const r = await api.put(`/financial/transactions/${id}`, data); return r.data },
  async deleteTransaction(id: string) { await api.delete(`/financial/transactions/${id}`) },
  async getSummary(period: 'day' | 'week' | 'month') { const r = await api.get('/financial/summary', { params: { period } }); return r.data },
  async getDailyGoal(date?: string) { const r = await api.get('/financial/daily-goal', { params: { date } }); return r.data },
  async updateDailyGoal(data: any, date?: string) { const r = await api.put('/financial/daily-goal', data, { params: { date } }); return r.data },
  async getDailyGoalHistory(startDate: string, endDate: string) { const r = await api.get('/financial/daily-goal/history', { params: { startDate, endDate } }); return r.data },
  async getSuggestion(amount: number) { const r = await api.get('/financial/suggestion', { params: { amount } }); return r.data },
}
