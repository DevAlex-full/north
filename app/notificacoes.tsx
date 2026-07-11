import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { useFollowUps } from '../hooks/useFollowUps'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatDateShort } from '../utils/date'
import {
  buildPendencies,
  groupPendenciesByPriority,
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

  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    await Promise.all([fetchLeads(), fetchProjects()])
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const pendencies = buildPendencies({ leads, projects, followUps })
  const grouped = groupPendenciesByPriority(pendencies)

  const onRefresh = () => { setRefreshing(true); load(); reloadFollowUps() }

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
                    <PendencyRow key={item.id} item={item} last={index === items.length - 1} />
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

function PendencyRow({ item, last }: { item: PendencyItem; last?: boolean }) {
  return (
    <View style={[styles.pendencyRow, !last && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pendencyTitle}>{PENDENCY_ICONS[item.type]} {item.title}</Text>
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