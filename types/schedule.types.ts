/**
 * Entidade ScheduleBlock (bloco recorrente de agenda, ex: "Prospecção" das
 * 13h às 15h). Tipo novo — `services/schedule.service.ts` era usado sem
 * tipagem (`any`) e sem nenhum consumidor no frontend até agora; esta
 * interface só formaliza o shape já retornado pela API.
 */
export interface ScheduleBlock {
  id: string
  userId: string
  routineId: string | null
  title: string
  description: string | null
  /** Formato "HH:MM". */
  startTime: string
  /** Formato "HH:MM". */
  endTime: string
  /** 0=domingo .. 6=sábado. */
  dayOfWeek: number[]
  category: string | null
  isRecurring: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}