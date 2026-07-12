import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../stores/auth.store'
import { useUpdateStore } from '../stores/update.store'
import { syncNotifications, NotificationSettings } from '../hooks/useNotifications'
import { usePendencyNotifications } from '../hooks/usePendencyNotifications'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatCurrency } from '../utils/format'

const DEFAULT_TIMES = {
  morningTime: '09:00',
  prospectTime: '13:00',
  indriveTime: '15:00',
  closingTime: '21:00',
}

const APP_VERSION = Constants.expoConfig?.version || '1.0.0'

export default function ConfiguracoesScreen() {
  const router = useRouter()
  const { user, logout, updateUser } = useAuthStore()
  const checkManually = useUpdateStore(s => s.checkManually)
  const isCheckingUpdate = useUpdateStore(s => s.isCheckingManually)

  const [name, setName] = useState(user?.name || '')
  const [dailyGoal, setDailyGoal] = useState('150')
  const [weeklyGoal, setWeeklyGoal] = useState('900')
  const [monthlyGoal, setMonthlyGoal] = useState('3600')

  const [notifEnabled, setNotifEnabled] = useState(true)
  const [notifMorning, setNotifMorning] = useState(true)
  const [notifProspect, setNotifProspect] = useState(true)
  const [notifIndrive, setNotifIndrive] = useState(true)
  const [notifClosing, setNotifClosing] = useState(true)
  const [times, setTimes] = useState(DEFAULT_TIMES)

  // Fase 5.2D — Pendências Comerciais (preferências locais, ver usePendencyNotifications)
  const { loadPreferences, updatePreferences } = usePendencyNotifications()
  const [crmFollowUps, setCrmFollowUps] = useState(true)
  const [crmProjects, setCrmProjects] = useState(true)
  const [crmCritical, setCrmCritical] = useState(true)
  const [crmDailyReminder, setCrmDailyReminder] = useState(false)
  const [crmDailyReminderTime, setCrmDailyReminderTime] = useState('08:00')
  const [savingCrmNotif, setSavingCrmNotif] = useState(false)

  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)

  const buildNotificationSettings = (overrides: Partial<{
    morningEnabled: boolean
    prospectEnabled: boolean
    indriveEnabled: boolean
    closingEnabled: boolean
  }> = {}): NotificationSettings => ({
    morningEnabled: overrides.morningEnabled ?? notifMorning,
    morningTime: times.morningTime,
    prospectEnabled: overrides.prospectEnabled ?? notifProspect,
    prospectTime: times.prospectTime,
    indriveEnabled: overrides.indriveEnabled ?? notifIndrive,
    indriveTime: times.indriveTime,
    closingEnabled: overrides.closingEnabled ?? notifClosing,
    closingTime: times.closingTime,
  })

  const load = async () => {
    try {
      const me = await authService.getMe()
      setName(me.name || '')
      if (me.settings) {
        setDailyGoal(String(me.settings.dailyGoalAmount || 150))
        setWeeklyGoal(String(me.settings.weeklyGoal || 900))
        setMonthlyGoal(String(me.settings.monthlyGoal || 3600))
      }
      if (me.notificationSettings) {
        const ns = me.notificationSettings
        setNotifEnabled(ns.enabled ?? true)
        setNotifMorning(ns.morningEnabled ?? true)
        setNotifProspect(ns.prospectEnabled ?? true)
        setNotifIndrive(ns.indriveEnabled ?? true)
        setNotifClosing(ns.closingEnabled ?? true)
        setTimes({
          morningTime: ns.morningTime || DEFAULT_TIMES.morningTime,
          prospectTime: ns.prospectTime || DEFAULT_TIMES.prospectTime,
          indriveTime: ns.indriveTime || DEFAULT_TIMES.indriveTime,
          closingTime: ns.closingTime || DEFAULT_TIMES.closingTime,
        })

        // Resincroniza silenciosamente os agendamentos locais com o que está
        // salvo no backend. Importante após reinstalar o app ou trocar de
        // dispositivo, quando os agendamentos locais não existem mais.
        if (ns.enabled) {
          syncNotifications(true, {
            morningEnabled: ns.morningEnabled ?? true,
            morningTime: ns.morningTime || DEFAULT_TIMES.morningTime,
            prospectEnabled: ns.prospectEnabled ?? true,
            prospectTime: ns.prospectTime || DEFAULT_TIMES.prospectTime,
            indriveEnabled: ns.indriveEnabled ?? true,
            indriveTime: ns.indriveTime || DEFAULT_TIMES.indriveTime,
            closingEnabled: ns.closingEnabled ?? true,
            closingTime: ns.closingTime || DEFAULT_TIMES.closingTime,
          }).catch(() => {})
        }
      }
    } catch {}

    // Fase 5.2D — Pendências Comerciais: preferências locais (não vêm do /auth/me)
    const crmPrefs = await loadPreferences()
    setCrmFollowUps(crmPrefs.followUpsEnabled)
    setCrmProjects(crmPrefs.projectsEnabled)
    setCrmCritical(crmPrefs.criticalPendenciesEnabled)
    setCrmDailyReminder(crmPrefs.dailyReminderEnabled)
    setCrmDailyReminderTime(crmPrefs.dailyReminderTime)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const saveProfile = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Nome não pode ser vazio'); return }
    setSavingProfile(true)
    try {
      await updateUser({ name: name.trim() })
      Alert.alert('✅', 'Perfil atualizado!')
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSavingProfile(false) }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      await authService.updateSettings({
        dailyGoalAmount: parseFloat(dailyGoal) || 150,
        weeklyGoal: parseFloat(weeklyGoal) || 900,
        monthlyGoal: parseFloat(monthlyGoal) || 3600,
      })
      Alert.alert('✅', 'Metas atualizadas!')
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSavingSettings(false) }
  }

  const saveNotifications = async () => {
    setSavingNotif(true)
    try {
      // 1. Persiste a preferência no backend
      await authService.updateNotifications({
        enabled: notifEnabled,
        morningEnabled: notifMorning,
        morningTime: times.morningTime,
        prospectEnabled: notifProspect,
        prospectTime: times.prospectTime,
        indriveEnabled: notifIndrive,
        indriveTime: times.indriveTime,
        closingEnabled: notifClosing,
        closingTime: times.closingTime,
      })

      // 2. Sincroniza de fato no dispositivo: pede permissão, agenda ou cancela
      const { granted } = await syncNotifications(notifEnabled, buildNotificationSettings())

      if (notifEnabled && !granted) {
        Alert.alert(
          'Permissão necessária',
          'As notificações foram salvas, mas você precisa autorizar notificações para o North nas configurações do sistema Android para recebê-las.'
        )
      } else if (notifEnabled) {
        Alert.alert('✅', 'Notificações agendadas: 09h, 13h, 15h e 21h (conforme ativadas).')
      } else {
        Alert.alert('🔕', 'Notificações desativadas e canceladas.')
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as notificações')
    } finally {
      setSavingNotif(false)
    }
  }

  /**
   * Fase 5.2D — Salva as preferências de Pendências Comerciais. Diferente
   * de `saveNotifications` (que persiste no backend via
   * authService.updateNotifications), estas 4 preferências ficam só
   * localmente (ver comentário em CrmNotificationPreferences) —
   * `updatePreferences` já cuida de persistir e, se o lembrete diário
   * estiver ativo, agendá-lo/atualizá-lo.
   */
  const saveCrmNotifications = async () => {
    setSavingCrmNotif(true)
    try {
      await updatePreferences({
        followUpsEnabled: crmFollowUps,
        projectsEnabled: crmProjects,
        criticalPendenciesEnabled: crmCritical,
        dailyReminderEnabled: crmDailyReminder,
        dailyReminderTime: crmDailyReminderTime,
      })
      Alert.alert('✅', 'Preferências de pendências salvas neste dispositivo.')
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as preferências de pendências')
    } finally {
      setSavingCrmNotif(false)
    }
  }

  const handleCheckUpdates = async () => {
    const result = await checkManually()
    if (result === 'updated') {
      Alert.alert('✅ Tudo certo', 'Você já está utilizando a versão mais recente.')
    } else if (result === 'error') {
      Alert.alert('Erro', 'Não foi possível verificar atualizações agora. Tente novamente mais tarde.')
    }
    // 'available' → o modal de atualização já é exibido automaticamente
    // pela store, nada a fazer aqui.
  }

  const confirmLogout = async () => {
    setShowLogoutModal(false)
    await logout()
  }

  const SectionTitle = ({ label }: { label: string }) => (
    <Text style={styles.sectionTitle}>{label}</Text>
  )

  const SettingRow = ({ label, value, onValueChange, disabled }: { label: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) => (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, disabled && { color: COLORS.textMuted }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: COLORS.surfaceLight, true: COLORS.primary + '88' }}
        thumbColor={value ? COLORS.primary : COLORS.textMuted}
      />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚙️ Configurações</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }}>

        {/* Perfil */}
        <SectionTitle label="👤 Perfil" />
        <Card>
          <Input label="Seu nome" value={name} onChangeText={setName} placeholder="Como quer ser chamado?" />
          <Text style={styles.emailLabel}>{user?.email}</Text>
          <Button
            title={savingProfile ? 'Salvando...' : 'Salvar nome'}
            onPress={saveProfile}
            loading={savingProfile}
            size="md"
          />
        </Card>

        {/* Metas financeiras */}
        <SectionTitle label="🎯 Metas Financeiras" />
        <Card>
          <Input
            label="Meta diária Indrive (R$)"
            value={dailyGoal}
            onChangeText={setDailyGoal}
            placeholder="150"
            keyboardType="decimal-pad"
          />
          <Input
            label="Meta semanal (R$)"
            value={weeklyGoal}
            onChangeText={setWeeklyGoal}
            placeholder="900"
            keyboardType="decimal-pad"
          />
          <Input
            label="Meta mensal (R$)"
            value={monthlyGoal}
            onChangeText={setMonthlyGoal}
            placeholder="3600"
            keyboardType="decimal-pad"
          />
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Dia</Text>
            <Text style={styles.previewValue}>{formatCurrency(parseFloat(dailyGoal) || 0)}</Text>
            <Text style={styles.previewLabel}>Semana</Text>
            <Text style={styles.previewValue}>{formatCurrency(parseFloat(weeklyGoal) || 0)}</Text>
            <Text style={styles.previewLabel}>Mês</Text>
            <Text style={styles.previewValue}>{formatCurrency(parseFloat(monthlyGoal) || 0)}</Text>
          </View>
          <Button
            title={savingSettings ? 'Salvando...' : 'Salvar metas'}
            onPress={saveSettings}
            loading={savingSettings}
            size="md"
          />
        </Card>

        {/* Notificações */}
        <SectionTitle label="🔔 Notificações" />
        <Card>
          <SettingRow label="Ativar notificações" value={notifEnabled} onValueChange={setNotifEnabled} />
          <View style={styles.divider} />
          <SettingRow label={`${times.morningTime} — Hora de programar`} value={notifMorning} onValueChange={setNotifMorning} disabled={!notifEnabled} />
          <SettingRow label={`${times.prospectTime} — Hora de prospectar`} value={notifProspect} onValueChange={setNotifProspect} disabled={!notifEnabled} />
          <SettingRow label={`${times.indriveTime} — Hora do Indrive`} value={notifIndrive} onValueChange={setNotifIndrive} disabled={!notifEnabled} />
          <SettingRow label={`${times.closingTime} — Feche o caixa`} value={notifClosing} onValueChange={setNotifClosing} disabled={!notifEnabled} />
          <View style={{ marginTop: SPACING.md }}>
            <Button
              title={savingNotif ? 'Salvando...' : 'Salvar notificações'}
              onPress={saveNotifications}
              loading={savingNotif}
              size="md"
            />
          </View>
        </Card>

        {/* Fase 5.2D — Pendências Comerciais (preferências locais, ver usePendencyNotifications) */}
        <SectionTitle label="🔔 Pendências Comerciais" />
        <Card>
          <Text style={styles.crmHint}>
            Alertas derivados da Central de Pendências (follow-ups, prazos, subtarefas). Salvos apenas
            neste aparelho.
          </Text>
          <SettingRow label="Follow-ups (atrasados, hoje, próximos)" value={crmFollowUps} onValueChange={setCrmFollowUps} />
          <SettingRow label="Projetos e entregas" value={crmProjects} onValueChange={setCrmProjects} />
          <SettingRow label="Pendências críticas" value={crmCritical} onValueChange={setCrmCritical} />
          <View style={styles.divider} />
          <SettingRow label="Lembrete diário" value={crmDailyReminder} onValueChange={setCrmDailyReminder} />
          {crmDailyReminder && (
            <Input
              label="Horário do lembrete"
              value={crmDailyReminderTime}
              onChangeText={setCrmDailyReminderTime}
              placeholder="08:00"
            />
          )}
          <View style={{ marginTop: SPACING.md }}>
            <Button
              title={savingCrmNotif ? 'Salvando...' : 'Salvar preferências de pendências'}
              onPress={saveCrmNotifications}
              loading={savingCrmNotif}
              size="md"
            />
          </View>
        </Card>

        {/* Atualizações */}
        <SectionTitle label="🔄 Atualizações" />
        <Card>
          <Text style={styles.updateHint}>
            O North é atualizado automaticamente em segundo plano. Toque no botão abaixo para verificar agora.
          </Text>
          <Button
            title={isCheckingUpdate ? 'Verificando...' : 'Verificar atualizações'}
            onPress={handleCheckUpdates}
            loading={isCheckingUpdate}
            size="md"
            variant="secondary"
          />
        </Card>

        {/* Sobre */}
        <SectionTitle label="ℹ️ Sobre" />
        <Card>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Aplicativo</Text>
            <Text style={styles.aboutValue}>North</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Versão</Text>
            <Text style={styles.aboutValue}>{APP_VERSION}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Usuário</Text>
            <Text style={styles.aboutValue}>{user?.email}</Text>
          </View>
        </Card>

        {/* Sair */}
        <SectionTitle label="🚪 Sessão" />
        <Button
          title="Sair da conta"
          onPress={() => setShowLogoutModal(true)}
          variant="danger"
          size="lg"
          style={{ marginBottom: SPACING.xxl }}
        />
      </ScrollView>

      <Modal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Sair da conta">
        <Text style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.md, marginBottom: SPACING.xl, textAlign: 'center' }}>
          Tem certeza que deseja sair?
        </Text>
        <Button title="Confirmar saída" onPress={confirmLogout} variant="danger" size="lg" />
        <Button title="Cancelar" onPress={() => setShowLogoutModal(false)} variant="ghost" size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xl + 8,
  },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  emailLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  switchLabel: { color: COLORS.text, fontSize: FONT_SIZE.md, flex: 1 },
  crmHint: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: SPACING.sm, lineHeight: 17 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  previewLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  previewValue: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '800' },
  updateHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.md,
    lineHeight: 19,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  aboutLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  aboutValue: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' },
})