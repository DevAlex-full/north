/** Ciclo de vida de um projeto pessoal. Não é usado por projetos de cliente. */
export type ProjectStatus = 'IDEA' | 'IN_PROGRESS' | 'PAUSED' | 'DONE'

/** Tipo de projeto: pessoal (sem cliente) ou de cliente (comercial). */
export type ProjectKind = 'PERSONAL' | 'CLIENT'

/**
 * Pipeline comercial de um projeto de cliente (kind=CLIENT). Separado de
 * `status` propositalmente, para não colidir com o ciclo de vida dos
 * projetos pessoais existentes (BarberFlow, LocaMed etc.).
 */
export type ProjectClientStatus =
  | 'LEAD'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED'
  | 'DEVELOPMENT'
  | 'DELIVERED'
  | 'SUPPORT'
  | 'PAUSED_CLIENT'
  | 'CANCELLED'

export type ProjectTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE'

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  description: string | null
  status: ProjectTaskStatus
  priority: number
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Entidade Project retornada pela API, já com os campos da Fase 4. */
export interface Project {
  id: string
  userId: string
  name: string
  description: string | null
  status: ProjectStatus
  priority: number
  deadline: string | null
  observations: string | null
  kind: ProjectKind
  clientId: string | null
  clientStatus: ProjectClientStatus | null
  agreedValue: number | null
  nextAction: string | null
  createdAt: string
  updatedAt: string
  projectTasks: ProjectTask[]
}

/**
 * Resumo financeiro de um projeto (GET /projects/:id/finance). Sempre
 * calculado pelo backend a partir do ledger de FinancialTransaction —
 * nenhum desses valores é persistido como tal no banco (exceto
 * agreedValue, que é o único informado pelo usuário).
 */
export interface ProjectFinance {
  agreedValue: number
  received: number
  pending: number
  spent: number
  profit: number
}

/**
 * Payload de criação de projeto. `status` é mantido como `string` pela
 * mesma razão do Lead (app/projetos.tsx guarda esse valor em
 * useState('IN_PROGRESS')). Os campos da Fase 4 (kind, clientId,
 * clientStatus, agreedValue, nextAction) são tipados estritamente: nenhuma
 * tela existente os utiliza ainda, então não há risco de quebra.
 */
export interface CreateProjectInput {
  name: string
  description?: string
  status?: string
  priority?: number
  deadline?: string
  observations?: string
  kind?: ProjectKind
  clientId?: string
  clientStatus?: ProjectClientStatus
  agreedValue?: number
  nextAction?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: string
  priority?: number
  deadline?: string
  observations?: string
  kind?: ProjectKind
  /** `null` remove o vínculo com o cliente. */
  clientId?: string | null
  clientStatus?: ProjectClientStatus | null
  agreedValue?: number | null
  nextAction?: string | null
}

/**
 * `status` mantido como `string` — app/projetos.tsx guarda esse valor em
 * useState('PENDING') tanto na criação quanto na edição de tarefa.
 */
export interface CreateProjectTaskInput {
  title: string
  description?: string
  status?: string
  priority?: number
  dueDate?: string
}

export type UpdateProjectTaskInput = Partial<CreateProjectTaskInput>