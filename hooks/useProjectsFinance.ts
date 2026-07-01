import { useState, useEffect, useCallback } from 'react'
import { projectService } from '../services/project.service'
import type { ProjectFinance } from '../types/project.types'

interface UseProjectsFinanceResult {
  financeByProjectId: Record<string, ProjectFinance>
  isLoading: boolean
  reload: () => Promise<void>
}

/**
 * Busca o financeiro (GET /projects/:id/finance) de vários projetos de
 * uma vez, em paralelo, retornando um mapa `projectId -> ProjectFinance`.
 * Reaproveita exclusivamente `projectService.getFinance` — o mesmo método
 * já usado por `useProjectFinance` (Fase 4.1C) — sem nenhuma chamada HTTP
 * paralela nova.
 */
export function useProjectsFinance(projectIds: string[]): UseProjectsFinanceResult {
  const [financeByProjectId, setFinanceByProjectId] = useState<Record<string, ProjectFinance>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Usado como dependência estável do useCallback abaixo, evitando refetch
  // a cada novo array (mesmo conteúdo) recebido em cada render da tela.
  const idsKey = projectIds.join(',')

  const reload = useCallback(async () => {
    if (projectIds.length === 0) {
      setFinanceByProjectId({})
      return
    }
    setIsLoading(true)
    try {
      const results = await Promise.all(
        projectIds.map((id) => projectService.getFinance(id).catch(() => null))
      )
      const map: Record<string, ProjectFinance> = {}
      projectIds.forEach((id, i) => {
        const result = results[i]
        if (result) map[id] = result
      })
      setFinanceByProjectId(map)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  useEffect(() => {
    reload()
  }, [reload])

  return { financeByProjectId, isLoading, reload }
}