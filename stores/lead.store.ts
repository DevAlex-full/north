import { create } from 'zustand'
import { leadService } from '../services/lead.service'
import type { Lead, CreateLeadInput, UpdateLeadInput } from '../types/lead.types'

interface LeadStore {
  leads: Lead[]
  isLoading: boolean
  error: string | null

  fetchLeads: (status?: string) => Promise<void>
  createLead: (data: CreateLeadInput) => Promise<Lead>
  updateLead: (id: string, data: UpdateLeadInput) => Promise<Lead>
  deleteLead: (id: string) => Promise<void>
}

export const useLeadStore = create<LeadStore>((set, get) => ({
  leads: [],
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
}))