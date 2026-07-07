import { useState, useEffect, useCallback } from 'react'
import { financialService } from '../services/financial.service'
import type { FinancialTransaction } from '../types/financial.types'

interface UseProjectTransactionsResult {
  transactions: FinancialTransaction[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Fase 4.4D — Lista os lançamentos financeiros (pagamentos e despesas) de
 * um projeto, para exibir o histórico no modal de detalhe do projeto
 * comercial. Consome exclusivamente `financialService.getTransactions({
 * projectId })`, que já existe e já suporta esse filtro (GET
 * /financial/transactions?projectId=...) — nenhum endpoint novo.
 *
 * Segue exatamente o mesmo padrão de useProjectFinance/useProjectsFinance:
 * chamada direta ao service, estado local (isLoading/error) e `reload`
 * exposto para refetch manual — sem HTTP direto na tela.
 */
export function useProjectTransactions(projectId: string | null): UseProjectTransactionsResult {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!projectId) { setTransactions([]); return }
    setIsLoading(true)
    setError(null)
    try {
      const data = await financialService.getTransactions({ projectId })
      setTransactions(data)
    } catch {
      setError('Não foi possível carregar o histórico financeiro')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  return { transactions, isLoading, error, reload }
}