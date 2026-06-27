import { create } from 'zustand'
import { updateService } from '../services/update.service'

export type ManualCheckResult = 'updated' | 'available' | 'error'

interface UpdateStore {
  /** Controla a exibição do modal "Nova versão disponível". */
  isModalVisible: boolean
  /** Indica que uma verificação manual (tela de Configurações) está em andamento. */
  isCheckingManually: boolean

  /**
   * Verificação silenciosa: chamada automaticamente ao abrir o app e ao
   * voltar do background. Baixa em segundo plano e só altera a UI
   * (exibindo o modal) quando o download termina com sucesso.
   */
  checkOnLaunchOrResume: () => Promise<void>

  /**
   * Verificação manual, disparada pelo botão "Verificar atualizações" nas
   * Configurações. Retorna o resultado para a tela decidir qual mensagem
   * mostrar ao usuário.
   */
  checkManually: () => Promise<ManualCheckResult>

  /** Aplica a atualização baixada (botão "Atualizar agora"). */
  applyUpdate: () => Promise<void>

  /** Fecha o modal sem aplicar (botão "Depois"). */
  dismissModal: () => void
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  isModalVisible: false,
  isCheckingManually: false,

  checkOnLaunchOrResume: async () => {
    try {
      const ready = await updateService.checkAndDownload()
      if (ready) set({ isModalVisible: true })
    } catch {
      // Verificação silenciosa: falhas (sem internet, etc.) nunca devem
      // interromper ou avisar o usuário — apenas não há atualização agora.
    }
  },

  checkManually: async () => {
    if (get().isCheckingManually) return 'error'
    set({ isCheckingManually: true })
    try {
      const hasUpdate = await updateService.checkForUpdate()
      if (!hasUpdate) return 'updated'

      const downloaded = await updateService.downloadUpdate()
      if (downloaded) {
        set({ isModalVisible: true })
        return 'available'
      }
      return 'error'
    } catch {
      return 'error'
    } finally {
      set({ isCheckingManually: false })
    }
  },

  applyUpdate: async () => {
    set({ isModalVisible: false })
    await updateService.reloadApp()
  },

  dismissModal: () => set({ isModalVisible: false }),
}))