import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Fuso horário oficial do North. Toda decisão sobre "qual é o dia atual"
 * deve passar por este módulo — nunca usar `new Date().toISOString()` para
 * extrair uma data de calendário (isso sempre retorna o dia em UTC, que
 * diverge de São Paulo a partir das 21h, causando o app mostrar o dia
 * seguinte antes da meia-noite local) e nunca depender do fuso configurado
 * no dispositivo que está rodando o app.
 */
export const TIME_ZONE = 'America/Sao_Paulo'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** `true` se `d` for uma instância de Date com um valor de tempo válido (não NaN). */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime())
}

/**
 * Converte uma entrada potencialmente inválida (null, undefined, string
 * malformada, Date inválida) em um Date válido, ou `null` se não for
 * possível. Todo ponto de entrada deste módulo que recebe dados externos
 * (ex: campo `date` de uma transação vinda da API) passa por aqui antes de
 * qualquer chamada a `toLocaleDateString`/`Intl.DateTimeFormat` — essas
 * APIs lançam `RangeError: Date value out of bounds` quando recebem uma
 * Date inválida, e isso não pode derrubar a tela.
 */
function parseToDate(input: Date | string | null | undefined): Date | null {
  if (input == null) return null
  if (input instanceof Date) return isValidDate(input) ? input : null
  if (typeof input === 'string') {
    const d = new Date(input)
    return isValidDate(d) ? d : null
  }
  return null
}

/**
 * Extrai os componentes de calendário (ano, mês, dia, hora, minuto, segundo)
 * de um instante, sempre segundo o fuso de São Paulo — independentemente do
 * fuso configurado no dispositivo que está rodando o app.
 */
function getPartsInSP(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value

  return {
    year: Number(map.year),
    month: Number(map.month), // 1-12
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/**
 * Offset (em minutos) do fuso de São Paulo em relação ao UTC, no instante
 * informado. Calculado inteiramente a partir de `Intl.DateTimeFormat`
 * (via `getPartsInSP`), sem depender de `toLocaleString` + `new Date(string)`
 * — esse round-trip por string formatada é frágil e tem comportamento não
 * totalmente garantido entre engines de JS (V8 vs Hermes), podendo produzir
 * `Invalid Date` silenciosamente em alguns ambientes. Não assume um valor
 * fixo (-180) para continuar correto mesmo se o Brasil voltar a adotar
 * horário de verão no futuro.
 */
function getSPOffsetMinutes(instant: Date): number {
  const sp = getPartsInSP(instant)
  const spAsUTC = Date.UTC(sp.year, sp.month - 1, sp.day, sp.hour, sp.minute, sp.second)
  return (spAsUTC - instant.getTime()) / 60000
}

/** `true` se `dayString` estiver no formato "YYYY-MM-DD" com data de calendário válida. */
function isValidDayString(dayString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayString)) return false
  const [y, m, d] = dayString.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return isValidDate(anchor) && anchor.getUTCFullYear() === y && anchor.getUTCMonth() === m - 1 && anchor.getUTCDate() === d
}

/**
 * Garante uma string "YYYY-MM-DD" válida: se `dayString` for inválida ou
 * malformada, retorna o dia de hoje em São Paulo como fallback seguro.
 */
function safeDayString(dayString: string): string {
  return isValidDayString(dayString) ? dayString : getTodayString()
}

/**
 * Converte uma string de dia "YYYY-MM-DD" (sempre tratada como um dia de
 * calendário em São Paulo, nunca como um instante UTC) no instante exato
 * que representa 00:00:00 desse dia em São Paulo.
 */
export function startOfDaySP(dayString: string): Date {
  const [y, m, d] = safeDayString(dayString).split('-').map(Number)
  const naiveUTCMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const offsetMinutes = getSPOffsetMinutes(naiveUTCMidnight)
  return new Date(naiveUTCMidnight.getTime() - offsetMinutes * 60000)
}

/** Instante exato de 23:59:59.999 do dia "YYYY-MM-DD" em São Paulo. */
export function endOfDaySP(dayString: string): Date {
  const start = startOfDaySP(dayString)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

/**
 * Retorna "YYYY-MM-DD" representando o dia de um instante (Date ou string
 * ISO com horário) segundo o calendário de São Paulo. Strings de dia puro
 * ("YYYY-MM-DD", sem componente de horário) são retornadas como estão, pois
 * já representam um dia de calendário — reinterpretá-las como instante UTC
 * reintroduziria o próprio bug que este utilitário existe para corrigir.
 * Entradas inválidas (null/undefined/string malformada) caem no fallback
 * seguro: o dia de hoje em São Paulo.
 */
export function toDateStringSP(input: Date | string | null | undefined): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input
  }
  const instant = parseToDate(input)
  if (!instant) return getTodayString()
  const { year, month, day } = getPartsInSP(instant)
  return `${year}-${pad(month)}-${pad(day)}`
}

/** "YYYY-MM-DD" do exato momento atual, segundo o calendário de São Paulo. */
export function getTodayString(): string {
  const { year, month, day } = getPartsInSP(new Date())
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Dia da semana (0=domingo .. 6=sábado) de uma data, segundo o calendário
 * de São Paulo. Aceita um instante (Date), uma string ISO com horário, ou
 * uma string de dia puro "YYYY-MM-DD". Padrão: hoje em São Paulo.
 */
export function getDayOfWeekSP(input: Date | string = new Date()): number {
  const dayString = safeDayString(toDateStringSP(input))
  const [y, m, d] = dayString.split('-').map(Number)
  // Ponto fixo ao meio-dia em UTC: evita qualquer ambiguidade de fuso ao
  // extrair o dia da semana de um Y-M-D já resolvido.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
}

/**
 * As 7 datas ("YYYY-MM-DD", domingo a sábado) da semana que contém
 * `dayString` (por padrão, hoje em São Paulo).
 */
export function getWeekDatesSP(dayString: string = getTodayString()): string[] {
  const safe = safeDayString(dayString)
  const dow = getDayOfWeekSP(safe)
  const [y, m, d] = safe.split('-').map(Number)
  const sunday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  sunday.setUTCDate(sunday.getUTCDate() - dow)

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday)
    day.setUTCDate(sunday.getUTCDate() + i)
    return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`
  })
}

/** Início e fim (instantes reais) da semana de São Paulo que contém `dayString`. */
export function getWeekRangeSP(dayString: string = getTodayString()): { start: Date; end: Date } {
  const week = getWeekDatesSP(dayString)
  return { start: startOfDaySP(week[0]), end: endOfDaySP(week[6]) }
}

/** Início e fim (instantes reais) do mês de São Paulo que contém `dayString`. */
export function getMonthRangeSP(dayString: string = getTodayString()): { start: Date; end: Date } {
  const [y, m] = safeDayString(dayString).split('-').map(Number)
  const firstDayStr = `${y}-${pad(m)}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate() // último dia do mês m (1-indexado)
  const lastDayStr = `${y}-${pad(m)}-${pad(lastDay)}`
  return { start: startOfDaySP(firstDayStr), end: endOfDaySP(lastDayStr) }
}

/** Abreviação do dia da semana (ex: "qui") de uma data "YYYY-MM-DD", em São Paulo. */
export function formatWeekdayShortSP(dayString: string): string {
  const [y, m, d] = safeDayString(dayString).split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: TIME_ZONE }).format(anchor)
  return label.replace('.', '')
}

/** Dia do mês (número) extraído de uma string "YYYY-MM-DD". */
export function getDayNumber(dayString: string): number {
  return Number(safeDayString(dayString).split('-')[2])
}

/**
 * Formata um instante como "dd de MMMM" (ex: "25 de junho"), em português.
 * Retorna '-' se a data for inválida, nula ou indefinida.
 */
export function formatDate(date: Date | string | null | undefined): string {
  const instant = parseToDate(date)
  if (!instant) return '-'
  return format(instant, "dd 'de' MMMM", { locale: ptBR })
}

/**
 * Formata um instante como "dd/MM/yyyy", segundo o calendário de São Paulo.
 * Retorna '-' se a data for inválida, nula ou indefinida.
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  const instant = parseToDate(date)
  if (!instant) return '-'
  return instant.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })
}

/**
 * Formata um instante como "HH:mm", segundo o horário de São Paulo.
 * Retorna '-' se a data for inválida, nula ou indefinida.
 */
export function formatTime(date: Date | string | null | undefined): string {
  const instant = parseToDate(date)
  if (!instant) return '-'
  return instant.toLocaleTimeString('pt-BR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
}

/**
 * Formata um instante como "Quinta-feira, 25 de junho", segundo São Paulo.
 * Em caso de data inválida, usa o momento atual como fallback (esta função
 * é usada para exibir o cabeçalho do dia, que nunca deve ficar em branco).
 */
export function formatLongDate(date: Date | string | null | undefined = new Date()): string {
  const instant = parseToDate(date) || new Date()
  const text = instant.toLocaleDateString('pt-BR', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const formatPercent = (value: number) => `${Math.round(value)}%`

/**
 * Retorna "Hoje" / "Amanhã" / "Ontem" / data formatada, comparando sempre
 * pelo calendário de São Paulo (não pelo fuso do dispositivo). Retorna '-'
 * se a data for inválida, nula ou indefinida.
 */
export function getRelativeDay(date: Date | string | null | undefined): string {
  const instant = parseToDate(date)
  if (!instant) return '-'

  const target = toDateStringSP(instant)
  const today = getTodayString()
  if (target === today) return 'Hoje'

  const todayStart = startOfDaySP(today)
  const tomorrow = toDateStringSP(new Date(todayStart.getTime() + 24 * 60 * 60 * 1000))
  const yesterday = toDateStringSP(new Date(todayStart.getTime() - 24 * 60 * 60 * 1000))

  if (target === tomorrow) return 'Amanhã'
  if (target === yesterday) return 'Ontem'
  return formatDate(instant)
}

/** Saudação ("Bom dia"/"Boa tarde"/"Boa noite") segundo a hora em São Paulo. */
export function getGreeting(): string {
  const { hour } = getPartsInSP(new Date())
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Dia da semana atual (0=domingo..6=sábado), segundo o calendário de São Paulo. */
export function getDayOfWeek(): number {
  return getDayOfWeekSP()
}