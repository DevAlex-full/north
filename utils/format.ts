export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const getStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    DONE: '#10B981', COMPLETED: '#10B981', REACHED: '#10B981', PUBLISHED: '#10B981', CLOSED: '#10B981', APPROVED: '#10B981',
    IN_PROGRESS: '#6366F1', CREATING: '#6366F1', NEGOTIATION: '#6366F1', INTERVIEW: '#6366F1',
    PENDING: '#64748B', IDEA: '#64748B', NEW: '#64748B', FOUND: '#64748B',
    SKIPPED: '#94A3B8', LOST: '#EF4444', REJECTED: '#EF4444',
    ALMOST: '#F59E0B', BELOW: '#EF4444',
    CONTACTED: '#3B82F6', REPLIED: '#3B82F6', SENT: '#3B82F6', PROPOSAL_SENT: '#3B82F6', VIEWED: '#3B82F6', APPLIED: '#3B82F6',
  }
  return map[status] || '#64748B'
}

export const getStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    DONE: 'Concluída', COMPLETED: 'Concluída', REACHED: '🎯 Meta batida!', PUBLISHED: 'Publicado', CLOSED: 'Fechado', APPROVED: 'Aprovado',
    IN_PROGRESS: 'Em andamento', CREATING: 'Criando', NEGOTIATION: 'Negociação', INTERVIEW: 'Entrevista',
    PENDING: 'Pendente', IDEA: 'Ideia', NEW: 'Novo', FOUND: 'Encontrado',
    SKIPPED: 'Pulada', LOST: 'Perdido', REJECTED: 'Recusado',
    ALMOST: '⚡ Quase lá', BELOW: 'Abaixo da meta',
    CONTACTED: 'Contatado', REPLIED: 'Respondeu', SENT: 'Enviado', PROPOSAL_SENT: 'Proposta enviada', VIEWED: 'Visualizado', APPLIED: 'Aplicado',
    PAUSED: 'Pausado', REUSE: 'Reaproveitar', TECHNICAL_TEST: 'Teste técnico',
  }
  return map[status] || status
}

export const getPriorityLabel = (p: number) => ['', '🔴 Alta', '🟡 Média', '🟢 Baixa'][p] || 'Normal'
