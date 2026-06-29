import api from './api'
import type {
  FinancialCategory,
  FinancialTransaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionFilters,
  FinancialSummary,
  CreateCategoryInput,
  UpdateCategoryInput,
  DailyGoal,
  UpdateDailyGoalInput,
  FinancialSuggestion,
  Period,
} from '../types/financial.types'

export const financialService = {
  async getCategories(): Promise<FinancialCategory[]> {
    const r = await api.get<FinancialCategory[]>('/financial/categories')
    return r.data
  },
  async createCategory(data: CreateCategoryInput): Promise<FinancialCategory> {
    const r = await api.post<FinancialCategory>('/financial/categories', data)
    return r.data
  },
  async updateCategory(id: string, data: UpdateCategoryInput): Promise<FinancialCategory> {
    const r = await api.put<FinancialCategory>(`/financial/categories/${id}`, data)
    return r.data
  },
  async deleteCategory(id: string): Promise<void> {
    await api.delete(`/financial/categories/${id}`)
  },

  async getTransactions(filters?: TransactionFilters): Promise<FinancialTransaction[]> {
    const r = await api.get<FinancialTransaction[]>('/financial/transactions', { params: filters })
    return r.data
  },
  async createTransaction(data: CreateTransactionInput): Promise<FinancialTransaction> {
    const r = await api.post<FinancialTransaction>('/financial/transactions', data)
    return r.data
  },
  async updateTransaction(id: string, data: UpdateTransactionInput): Promise<FinancialTransaction> {
    const r = await api.put<FinancialTransaction>(`/financial/transactions/${id}`, data)
    return r.data
  },
  async deleteTransaction(id: string): Promise<void> {
    await api.delete(`/financial/transactions/${id}`)
  },

  async getSummary(period: Period): Promise<FinancialSummary> {
    const r = await api.get<FinancialSummary>('/financial/summary', { params: { period } })
    return r.data
  },

  async getDailyGoal(date?: string): Promise<DailyGoal | null> {
    const r = await api.get<DailyGoal | null>('/financial/daily-goal', { params: { date } })
    return r.data
  },
  async updateDailyGoal(data: UpdateDailyGoalInput, date?: string): Promise<DailyGoal> {
    const r = await api.put<DailyGoal>('/financial/daily-goal', data, { params: { date } })
    return r.data
  },
  async getDailyGoalHistory(startDate: string, endDate: string): Promise<DailyGoal[]> {
    const r = await api.get<DailyGoal[]>('/financial/daily-goal/history', { params: { startDate, endDate } })
    return r.data
  },

  async getSuggestion(amount: number): Promise<FinancialSuggestion> {
    const r = await api.get<FinancialSuggestion>('/financial/suggestion', { params: { amount } })
    return r.data
  },
}