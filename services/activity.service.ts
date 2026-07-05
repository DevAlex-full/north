import api from './api'
import type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityQueryFilters,
} from '../types/activity.types'

export const activityService = {
  async getAll(filters?: ActivityQueryFilters): Promise<Activity[]> {
    const r = await api.get<Activity[]>('/activities', { params: filters })
    return r.data
  },
  async create(data: CreateActivityInput): Promise<Activity> {
    const r = await api.post<Activity>('/activities', data)
    return r.data
  },
  async update(id: string, data: UpdateActivityInput): Promise<Activity> {
    const r = await api.put<Activity>(`/activities/${id}`, data)
    return r.data
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/activities/${id}`)
  },
}