import { create } from 'zustand'
import { activityService } from '../services/activity.service'
import type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityQueryFilters,
} from '../types/activity.types'

interface ActivityStore {
  activities: Activity[]
  isLoading: boolean
  error: string | null

  fetchActivities: (filters?: ActivityQueryFilters) => Promise<void>
  createActivity: (data: CreateActivityInput) => Promise<Activity>
  updateActivity: (id: string, data: UpdateActivityInput) => Promise<Activity>
  deleteActivity: (id: string) => Promise<void>
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  isLoading: false,
  error: null,

  fetchActivities: async (filters) => {
    set({ isLoading: true, error: null })
    try {
      const activities = await activityService.getAll(filters)
      set({ activities, isLoading: false })
    } catch {
      set({ error: 'Não foi possível carregar as atividades', isLoading: false })
    }
  },

  createActivity: async (data) => {
    const created = await activityService.create(data)
    set({ activities: [created, ...get().activities] })
    return created
  },

  updateActivity: async (id, data) => {
    const updated = await activityService.update(id, data)
    set({ activities: get().activities.map((a) => (a.id === id ? updated : a)) })
    return updated
  },

  deleteActivity: async (id) => {
    await activityService.delete(id)
    set({ activities: get().activities.filter((a) => a.id !== id) })
  },
}))