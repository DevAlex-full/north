import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { useFollowUps } from '../hooks/useFollowUps'
import { usePendencyNotifications } from '../hooks/usePendencyNotifications'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatDateShort } from '../utils/date'
import {
  buildPendencies,
  groupPendenciesByPriority,
  isPendencyNotifiable,
  PRIORITY_ORDER,
  type PendencyItem,
  type PendencyType,
  type PendencyPriority,
} from '../utils/notifications'

/** Janela padrão (dias) para follow-ups — mesmo padrão usado no Pipeline e no Dashboard Operacional. */
const FOLLOW_UP_WINDOW_DAYS = 7

const PENDENCY_ICONS: Record<PendencyType, string> = {
  FOLLOW_UP_OVERDUE: '📅',
  FOLLOW_UP_TODAY: '📅',
  PROJECT_NO_NEXT_ACTION: '⚡',
  PROJECT_NEAR_DEADLINE: '⏳',
  PROJECT_OVERDUE: '🚨',
  PENDING_SUBTASK: '☑️',
  LEAD_STALE: '📉',
  UPCOMING_DELIVERY: '📦',
}

const PRIORITY_SECTIONS: Record<PendencyPriority, { label: string; icon: string; color: string }> = {
  CRITICO: { label: 'Crítico', icon: '🔴', color: COLORS.danger },
  ALTO: { label: 'Alto', icon: '🟠', color: COLORS.warning },
  MEDIO: { label: 'Médio', icon: '🟡', color: COLORS.primary },
  BAIXO: { label: 'Baixo', icon: '🟢', color: COLORS.success },
}

export default function NotificacoesScreen() {
  const router = useRouter()
  const { leads, fetchLeads } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()
  const { followUps, reload: reloadFollowUps } = useFollowUps(FOLLOW_UP_WINDOW_DAYS)
  const { preferences, loadPreferences, sync, isSyncing } = usePendencyNotifications()

  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    await Promise.all([fetchLeads(), fetchProjects(), loadPreferences()])
    setRefreshing(false)
  }

  // Fase 5.2 — Recalcula pendências e sincroniza alertas locais sempre que
  // a tela ganha foco. Não é "spam a cada abertura do app": esta é uma
  // visita deliberada à Central de Pendências, e o próprio `sync` só
  // agenda/atualiza categorias cujo estado realmente mudou (ver regra
  // 5.2C em usePendencyNotifications).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      ;(async () => {
        await load()
        if (cancelled) return
        const pendencyInput = { leads, projects, followUps }
        sync(pendencyInput).catch(() => {})
      })()
      return () => { cancelled = true }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

  const pendencies = buildPendencies({ leads, projects, followUps })
  const grouped = groupPendenciesByPriority(pendencies)

  const onRefresh = () => { setRefreshing(true); load(); reloadFollowUps() }

  const onUpdateAlerts = async () => {
    const result = await sync({ leads, projects, followUps })
    if (result.expoGo) {
      Alert.alert('Expo Go', 'Notificações locais não funcionam no Expo Go. Instale o APK para recebê-las.')
    } else if (!result.granted) {
      Alert.alert(
        'Permissão necessária',
        'Autorize notificações para o North nas configurações do sistema Android para receber os alertas.'
      )
    } else {
      Alert.alert('✅', 'Alertas atualizados com base nas suas pendências atuais.')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>🔔 Central de Pendências</Text>
          <Text style={styles.subtitle}>{pendencies.length} pendência{pendencies.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Button
          title={isSyncing ? 'Atualizando...' : '🔄 Atualizar alertas'}
          onPress={onUpdateAlerts}
          loading={isSyncing}
          variant="secondary"
          size="md"
          style={{ marginBottom: SPACING.md }}
        />

        {pendencies.length === 0 ? (
          <EmptyState icon="🎉" title="Tudo em dia!" subtitle="Nenhuma pendência no momento." />
        ) : (
          PRIORITY_ORDER.map((priority) => {
            const items = grouped[priority]
            if (items.length === 0) return null
            const section = PRIORITY_SECTIONS[priority]
            return (
              <View key={priority}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{section.icon} {section.label}</Text>
                  <View style={[styles.sectionCountBadge, { backgroundColor: section.color + '22', borderColor: section.color + '55' }]}>
                    <Text style={[styles.sectionCountText, { color: section.color }]}>{items.length}</Text>
                  </View>
                </View>
                <Card>
                  {items.map((item, index) => (
                    <PendencyRow
                      key={item.id}
                      item={item}
                      notifiable={isPendencyNotifiable(item, preferences)}
                      last={index === items.length - 1}
                    />
                  ))}
                </Card>
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

function PendencyRow({
  item,
  notifiable,
  last,
}: {
  item: PendencyItem
  notifiable: boolean
  last?: boolean
}) {
  return (
    <View style={[styles.pendencyRow, !last && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pendencyTitle}>
          {PENDENCY_ICONS[item.type]} {item.title}{notifiable ? ' 🔔' : ''}
        </Text>
        {(item.project || item.client) && (
          <Text style={styles.pendencySub}>
            {item.project ? `🏗️ ${item.project}` : ''}
            {item.project && item.client ? '  ·  ' : ''}
            {item.client ? `🏢 ${item.client}` : ''}
          </Text>
        )}
        <Text style={styles.pendencyAction}>➡️ {item.suggestedAction}</Text>
      </View>
      {item.deadline && <Text style={styles.pendencyDeadline}>{formatDateShort(item.deadline)}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '800' },
  sectionCountBadge: { minWidth: 32, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, alignItems: 'center' },
  sectionCountText: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  pendencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: SPACING.sm },
  pendencyTitle: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  pendencySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  pendencyAction: { color: COLORS.primary, fontSize: FONT_SIZE.xs, marginTop: 4, fontWeight: '600' },
  pendencyDeadline: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', marginTop: 2 },
})