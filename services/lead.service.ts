import api from './api'
import type { Lead, CreateLeadInput, UpdateLeadInput } from '../types/lead.types'

export const leadService = {
  async getAll(status?: string): Promise<Lead[]> {
    const r = await api.get<Lead[]>('/leads', { params: { status } })
    return r.data
  },
  async getOne(id: string): Promise<Lead> {
    const r = await api.get<Lead>(`/leads/${id}`)
    return r.data
  },
  async create(data: CreateLeadInput): Promise<Lead> {
    const r = await api.post<Lead>('/leads', data)
    return r.data
  },
  async update(id: string, data: UpdateLeadInput): Promise<Lead> {
    const r = await api.put<Lead>(`/leads/${id}`, data)
    return r.data
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/leads/${id}`)
  },

  /**
   * Fase 4.3B — Follow-ups: leads cujo `followUpAt` está vencido ou vence
   * dentro da janela de `days` dias (padrão do backend: 7). Consome
   * GET /leads/follow-ups (src/routes/lead.routes.ts).
   */
  async getFollowUps(days?: number): Promise<Lead[]> {
    const r = await api.get<Lead[]>('/leads/follow-ups', { params: { days } })
    return r.data
  },
}