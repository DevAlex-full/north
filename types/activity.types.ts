/**
 * Tipos de evento registrados na linha do tempo comercial (ActivityLog).
 * Espelha exatamente o enum `activityTypeEnum` do backend
 * (src/validators/activity.validator.ts).
 */
export type ActivityType =
  | 'CONTACT_MADE'
  | 'REPLY_RECEIVED'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATION_STARTED'
  | 'DEAL_CLOSED'
  | 'PROJECT_STARTED'
  | 'PAYMENT_RECEIVED'
  | 'DELIVERY_MADE'
  | 'SUPPORT_STARTED'
  | 'NOTE'

/** Origem do registro: criado manualmente pelo usuário ou gerado pelo sistema. */
export type ActivitySource = 'MANUAL' | 'AUTO'

/**
 * Entidade ActivityLog retornada pela API. Sempre vinculada a um usuário e,
 * opcionalmente, a um Lead e/ou a um Projeto — é o registro genérico de
 * linha do tempo usado tanto pelo pipeline comercial quanto pelo
 * acompanhamento de projetos de cliente.
 */
export interface Activity {
  id: string
  userId: string
  leadId: string | null
  projectId: string | null
  type: ActivityType
  title: string
  description: string | null
  source: ActivitySource
  metadata: Record<string, unknown> | null
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateActivityInput {
  leadId?: string
  projectId?: string
  type: ActivityType
  title: string
  description?: string
  source?: ActivitySource
  metadata?: Record<string, unknown>
  occurredAt?: string
}

/**
 * `leadId`/`projectId`/`type`/`source` não são editáveis após a criação —
 * mesma regra aplicada pelo backend (updateActivitySchema não os inclui).
 */
export interface UpdateActivityInput {
  title?: string
  description?: string
  metadata?: Record<string, unknown>
  occurredAt?: string
}

/** Filtros aceitos por GET /activities. */
export interface ActivityQueryFilters {
  leadId?: string
  projectId?: string
}