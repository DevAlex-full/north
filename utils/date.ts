import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const formatDate = (date: Date | string) =>
  format(new Date(date), "dd 'de' MMMM", { locale: ptBR })

export const formatDateShort = (date: Date | string) =>
  format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })

export const formatTime = (date: Date | string) =>
  format(new Date(date), 'HH:mm', { locale: ptBR })

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const formatPercent = (value: number) => `${Math.round(value)}%`

export const getTodayString = () => new Date().toISOString().split('T')[0]

export const getRelativeDay = (date: Date | string) => {
  const d = new Date(date)
  if (isToday(d)) return 'Hoje'
  if (isTomorrow(d)) return 'Amanhã'
  if (isYesterday(d)) return 'Ontem'
  return formatDate(d)
}

export const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export const getDayOfWeek = () => new Date().getDay()
