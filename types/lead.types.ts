/**
 * Status de um Lead/Cliente. ACTIVE_CLIENT foi adicionado na Fase 4 para
 * representar um lead que se tornou cliente ativo (pós-fechamento).
 */
export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'REPLIED'
  | 'PROPOSAL_SENT'
  | 'NEGOTIATION'
  | 'CLOSED'
  | 'LOST'
  | 'ACTIVE_CLIENT'

/**
 * Entidade Lead retornada pela API. Continua representando tanto
 * prospects (funil de vendas) quanto clientes ativos (status=ACTIVE_CLIENT) —
 * não existe uma entidade "Client" separada, por decisão arquitetural da
 * Fase 4 (evitar duplicação entre Lead e Client).
 */
export interface Lead {
  id: string
  userId: string
  name: string
  company: string | null
  niche: string | null
  phone: string | null
  email: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  origin: string | null
  serviceInterest: string | null
  estimatedValue: number | null
  status: LeadStatus
  lastContactAt: string | null
  nextAction: string | null
  observations: string | null
  followUpAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Payload de criação de um Lead. `status` é mantido como `string` (e não
 * `LeadStatus`) propositalmente: a tela app/(tabs)/leads.tsx já guarda esse
 * valor em `useState('NEW')`, que o TypeScript infere como `string` — não
 * `LeadStatus`. Estreitar este campo quebraria a tipagem daquela tela sem
 * tocar nela, o que está fora do escopo desta etapa.
 */
export interface CreateLeadInput {
  name: string
  company?: string
  niche?: string
  phone?: string
  email?: string
  whatsapp?: string
  website?: string
  instagram?: string
  origin?: string
  serviceInterest?: string
  estimatedValue?: number
  status?: string
  nextAction?: string
  observations?: string
  lastContactAt?: string
  followUpAt?: string
}

export type UpdateLeadInput = Partial<CreateLeadInput>