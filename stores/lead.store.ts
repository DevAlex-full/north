import { create } from 'zustand'
import { leadService } from '../services/lead.service'
import type { Lead, CreateLeadInput, UpdateLeadInput } from '../types/lead.types'

interface LeadStore {
  leads: Lead[]
  /** Fase 4.3B — leads com followUpAt vencido ou próximo (GET /leads/follow-ups). */
  followUps: Lead[]
  isLoading: boolean
  error: string | null

  fetchLeads: (status?: string) => Promise<void>
  createLead: (data: CreateLeadInput) => Promise<Lead>
  updateLead: (id: string, data: UpdateLeadInput) => Promise<Lead>
  deleteLead: (id: string) => Promise<void>

  /** Fase 4.3B — Follow-ups */
  fetchFollowUps: (days?: number) => Promise<void>
}

export const useLeadStore = create<LeadStore>((set, get) => ({
  leads: [],
  followUps: [],
  isLoading: false,
  error: null,

  fetchLeads: async (status) => {
    set({ isLoading: true, error: null })
    try {
      const leads = await leadService.getAll(status)
      set({ leads, isLoading: false })
    } catch {
      set({ error: 'Não foi possível carregar os clientes', isLoading: false })
    }
  },

  createLead: async (data) => {
    const created = await leadService.create(data)
    set({ leads: [created, ...get().leads] })
    return created
  },

  updateLead: async (id, data) => {
    const updated = await leadService.update(id, data)
    set({ leads: get().leads.map((l) => (l.id === id ? updated : l)) })
    return updated
  },

  deleteLead: async (id) => {
    await leadService.delete(id)
    set({ leads: get().leads.filter((l) => l.id !== id) })
  },

  // --- Fase 4.3B: Follow-ups ---

  fetchFollowUps: async (days) => {
    set({ isLoading: true, error: null })
    try {
      const followUps = await leadService.getFollowUps(days)
      set({ followUps, isLoading: false })
    } catch {
      set({ error: 'Não foi possível carregar os follow-ups', isLoading: false })
    }
  },
}))