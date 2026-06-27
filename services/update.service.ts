import * as Updates from 'expo-updates'

/**
 * Serviço central de atualizações OTA (Over-The-Air) via EAS Update.
 *
 * Todo o fluxo passa por aqui — não existem soluções paralelas de
 * verificação/download/aplicação de atualização em nenhuma outra parte
 * do app.
 */
export const updateService = {
  /**
   * Indica se o módulo de updates está ativo neste build. É `false` no
   * Expo Go, no Dev Client sem canal configurado, e em `expo start`
   * (desenvolvimento local) — nunca deve ser usado em produção EAS.
   */
  isAvailable(): boolean {
    return Updates.isEnabled && !__DEV__
  },

  /** Verifica no canal do EAS Update se existe uma atualização publicada. */
  async checkForUpdate(): Promise<boolean> {
    if (!this.isAvailable()) return false
    try {
      const result = await Updates.checkForUpdateAsync()
      return result.isAvailable
    } catch {
      return false
    }
  },

  /** Baixa a atualização disponível. Retorna `true` se uma nova versão foi de fato baixada. */
  async downloadUpdate(): Promise<boolean> {
    if (!this.isAvailable()) return false
    try {
      const result = await Updates.fetchUpdateAsync()
      return result.isNew
    } catch {
      return false
    }
  },

  /**
   * Verifica e baixa em sequência, em silêncio (sem UI). Retorna `true`
   * somente quando uma atualização nova foi baixada com sucesso e está
   * pronta para ser aplicada — momento em que a UI deve avisar o usuário.
   */
  async checkAndDownload(): Promise<boolean> {
    const hasUpdate = await this.checkForUpdate()
    if (!hasUpdate) return false
    return await this.downloadUpdate()
  },

  /** Reinicia o app aplicando a atualização já baixada. */
  async reloadApp(): Promise<void> {
    if (!this.isAvailable()) return
    try {
      await Updates.reloadAsync()
    } catch {
      // Se o reload falhar por qualquer motivo, o app continua funcionando
      // normalmente na versão atual — a atualização será reaplicada na
      // próxima verificação.
    }
  },
}