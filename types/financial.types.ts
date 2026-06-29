export type FinancialTransactionType = 'INCOME' | 'EXPENSE'

export type Period = 'day' | 'week' | 'month'

export interface FinancialCategory {
  id: string
  userId: string
  name: string
  type: FinancialTransactionType
  color: string | null
  icon: string | null
  createdAt: string
}

/**
 * Entidade FinancialTransaction retornada pela API. `projectId` (Fase 4)
 * vincula opcionalmente a transação a um projeto de cliente; `category`
 * vem populada quando o backend faz o include (todos os endpoints atuais
 * de transação já incluem a categoria).
 */
export interface FinancialTransaction {
  id: string
  userId: string
  categoryId: string
  projectId: string | null
  type: FinancialTransactionType
  amount: number
  description: string | null
  date: string
  paymentMethod: string | null
  source: string | null
  createdAt: string
  updatedAt: string
  category?: FinancialCategory
}

/**
 * `type` mantido como `string` (e não `FinancialTransactionType`) pela
 * mesma razão dos demais módulos: app/(tabs)/financeiro.tsx guarda esse
 * valor em useState('INCOME'), inferido como `string`. `projectId` é
 * totalmente novo na Fase 4 e não tem nenhum ponto de chamada existente,
 * por isso é tipado normalmente.
 */
export interface CreateTransactionInput {
  type: string
  categoryId: string
  projectId?: string
  amount: number
  description?: string
  date?: string
  paymentMethod?: string
  source?: string
}

export interface UpdateTransactionInput {
  type?: string
  categoryId?: string
  /** `null` remove o vínculo com o projeto. */
  projectId?: string | null
  amount?: number
  description?: string
  date?: string
  paymentMethod?: string
  source?: string
}

export interface TransactionFilters {
  startDate?: string
  endDate?: string
  type?: string
  projectId?: string
}

export interface FinancialSummary {
  income: number
  expense: number
  profit: number
}

export interface CreateCategoryInput {
  name: string
  type: string
  color?: string
  icon?: string
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>

export interface DailyGoal {
  id: string
  userId: string
  date: string
  targetAmount: number
  earnedAmount: number
  gasAmount: number
  status: 'BELOW' | 'ALMOST' | 'REACHED'
  createdAt: string
  updatedAt: string
}

export interface UpdateDailyGoalInput {
  earnedAmount?: number
  gasAmount?: number
  targetAmount?: number
}

export interface FinancialSuggestion {
  amount: number
  despesas: number
  reserva: number
  investimento: number
}