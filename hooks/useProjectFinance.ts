import { useState, useEffect, useCallback } from 'react'
import { projectService } from '../services/project.service'
import type { ProjectFinance } from '../types/project.types'

interface UseProjectFinanceResult {
  finance: ProjectFinance | null
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Busca o resumo financeiro de um projeto (GET /projects/:id/finance) de
 * forma reativa. Passe `null` quando ainda não houver projeto selecionado
 * — o hook não dispara nenhuma requisição nesse caso.
 */
export function useProjectFinance(projectId: string | null): UseProjectFinanceResult {
  const [finance, setFinance] = useState<ProjectFinance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!projectId) {
      setFinance(null)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await projectService.getFinance(projectId)
      setFinance(data)
    } catch {
      setError('Não foi possível carregar o financeiro do projeto')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    reload()
  }, [reload])

  return { finance, isLoading, error, reload }
}