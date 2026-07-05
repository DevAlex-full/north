import { useState, useEffect, useCallback } from 'react'
import { leadService } from '../services/lead.service'
import type { Lead } from '../types/lead.types'

interface UseFollowUpsResult {
  followUps: Lead[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Busca os leads com follow-up vencido ou próximo (GET /leads/follow-ups)
 * de forma reativa. `days` define a janela em dias a partir de agora
 * (padrão do backend: 7 — ver src/controllers/lead.controller.ts).
 *
 * Segue exatamente o mesmo padrão de useProjectFinance/useProjectsFinance:
 * chamada direta ao service, estado local (isLoading/error) e `reload`
 * exposto para refetch manual — sem HTTP direto na tela.
 */
export function useFollowUps(days?: number): UseFollowUpsResult {
  const [followUps, setFollowUps] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await leadService.getFollowUps(days)
      setFollowUps(data)
    } catch {
      setError('Não foi possível carregar os follow-ups')
    } finally {
      setIsLoading(false)
    }
  }, [days])

  useEffect(() => {
    reload()
  }, [reload])

  return { followUps, isLoading, error, reload }
}