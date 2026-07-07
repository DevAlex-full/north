import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { useFollowUps } from '../hooks/useFollowUps'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatCurrency } from '../utils/format'
import { formatDateShort } from '../utils/date'
import { buildPipelineColumns, getNextLeadStatus, groupFollowUpsByUrgency, type PipelineCardData } from '../utils/commercial'
import type { Lead } from '../types/lead.types'

/** Janela padrão (dias) para follow-ups pendentes — mesmo padrão do backend. */
const FOLLOW_UP_WINDOW_DAYS = 7

export default function PipelineScreen() {
  const router = useRouter()
  const { leads, fetchLeads, updateLead } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()
  const [refreshing, setRefreshing] = useState(false)

  // Fase 4.4C — Follow-ups agrupados em 3 baldes (atrasado/hoje/próximos dias), consumindo exclusivamente useFollowUps()
  const { followUps, isLoading: followUpsLoading, reload: reloadFollowUps } = useFollowUps(FOLLOW_UP_WINDOW_DAYS)
  const followUpGroups = groupFollowUpsByUrgency(followUps)
  const overdueLeadIds = new Set(followUpGroups.overdue.map((l) => l.id))
  const todayLeadIds = new Set(followUpGroups.today.map((l) => l.id))

  const load = async () => {
    await Promise.all([fetchLeads(), fetchProjects('CLIENT')])
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const columns = buildPipelineColumns(leads, projects)

  const advance = async (lead: Lead) => {
    const next = getNextLeadStatus(lead.status)
    if (!next) return
    try { await updateLead(lead.id, { status: next }); await load() }
    catch { Alert.alert('Erro', 'Não foi possível avançar o lead') }
  }

  const markLost = (lead: Lead) => {
    Alert.alert('Marcar como perdido', `Marcar "${lead.name}" como perdido?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          try { await updateLead(lead.id, { status: 'LOST' }); await load() }
          catch { Alert.alert('Erro', 'Não foi possível atualizar o lead') }
        },
      },
    ])
  }

  const hasAnyLead = leads.length > 0
  const hasFollowUpAlerts = followUpGroups.overdue.length > 0 || followUpGroups.today.length > 0 || followUpGroups.upcoming.length > 0

  const onRefresh = () => { setRefreshing(true); load(); reloadFollowUps() }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>📊 Pipeline</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Fase 4.4C — Alertas de follow-up em 3 baldes (useFollowUps + groupFollowUpsByUrgency) */}
      {!followUpsLoading && hasFollowUpAlerts && (
        <View style={styles.followUpBanner}>
          {followUpGroups.overdue.length > 0 && (
            <View style={[styles.followUpAlert, styles.followUpAlertDanger]}>
              <Text style={styles.followUpAlertTitle}>
                🔴 Atrasados ({followUpGroups.overdue.length})
              </Text>
              {followUpGroups.overdue.slice(0, 3).map((lead) => (
                <Text key={lead.id} style={styles.followUpAlertLine}>
                  • {lead.name}{lead.followUpAt ? ` — ${formatDateShort(lead.followUpAt)}` : ''}
                </Text>
              ))}
              {followUpGroups.overdue.length > 3 && (
                <Text style={styles.followUpAlertMore}>+{followUpGroups.overdue.length - 3} outro(s)</Text>
              )}
            </View>
          )}
          {followUpGroups.today.length > 0 && (
            <View style={[styles.followUpAlert, styles.followUpAlertToday]}>
              <Text style={styles.followUpAlertTitle}>
                🟠 Hoje ({followUpGroups.today.length})
              </Text>
              {followUpGroups.today.slice(0, 3).map((lead) => (
                <Text key={lead.id} style={styles.followUpAlertLine}>• {lead.name}</Text>
              ))}
              {followUpGroups.today.length > 3 && (
                <Text style={styles.followUpAlertMore}>+{followUpGroups.today.length - 3} outro(s)</Text>
              )}
            </View>
          )}
          {followUpGroups.upcoming.length > 0 && (
            <View style={[styles.followUpAlert, styles.followUpAlertWarning]}>
              <Text style={styles.followUpAlertTitle}>
                🟡 Próximos dias ({followUpGroups.upcoming.length})
              </Text>
              {followUpGroups.upcoming.slice(0, 3).map((lead) => (
                <Text key={lead.id} style={styles.followUpAlertLine}>
                  • {lead.name}{lead.followUpAt ? ` — ${formatDateShort(lead.followUpAt)}` : ''}
                </Text>
              ))}
              {followUpGroups.upcoming.length > 3 && (
                <Text style={styles.followUpAlertMore}>+{followUpGroups.upcoming.length - 3} outro(s)</Text>
              )}
            </View>
          )}
        </View>
      )}

      {!hasAnyLead ? (
        <EmptyState icon="📊" title="Nenhum lead no pipeline" subtitle="Cadastre leads na tela de Clientes para vê-los aqui" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {columns.map((column) => (
            <View key={column.key} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>{column.label}</Text>
                <View style={styles.columnCountBadge}>
                  <Text style={styles.columnCountText}>{column.count}</Text>
                </View>
              </View>
              <Text style={styles.columnTotal}>{formatCurrency(column.totalValue)}</Text>

              <ScrollView style={styles.columnBody} showsVerticalScrollIndicator={false}>
                {column.cards.length === 0
                  ? <Text style={styles.columnEmpty}>Nenhum card aqui</Text>
                  : column.cards.map((cardData: PipelineCardData) => {
                    const { lead, linkedProject, combinedValue } = cardData
                    const next = getNextLeadStatus(lead.status)
                    const showActions = lead.status !== 'ACTIVE_CLIENT' && lead.status !== 'LOST'

                    return (
                      <Card key={lead.id} style={styles.pipelineCard}>
                        <Text style={styles.cardName}>{lead.name}</Text>
                        {lead.company && <Text style={styles.cardLine}>🏢 {lead.company}</Text>}
                        {(lead.phone || lead.whatsapp) && <Text style={styles.cardLine}>📞 {lead.whatsapp || lead.phone}</Text>}
                        {lead.followUpAt && (
                          <View style={styles.followUpDateRow}>
                            <Text style={styles.cardLine}>📅 {new Date(lead.followUpAt).toLocaleDateString('pt-BR')}</Text>
                            {overdueLeadIds.has(lead.id) && (
                              <View style={[styles.followUpCardBadge, styles.followUpCardBadgeDanger]}>
                                <Text style={styles.followUpCardBadgeText}>🔴 Atrasado</Text>
                              </View>
                            )}
                            {todayLeadIds.has(lead.id) && (
                              <View style={[styles.followUpCardBadge, styles.followUpCardBadgeToday]}>
                                <Text style={styles.followUpCardBadgeText}>🟠 Hoje</Text>
                              </View>
                            )}
                          </View>
                        )}
                        {combinedValue != null && (
                          <Text style={[styles.cardLine, { color: COLORS.success, fontWeight: '700' }]}>💰 {formatCurrency(combinedValue)}</Text>
                        )}
                        {linkedProject && (
                          <Text style={styles.cardLine}>🏗️ {linkedProject.name}</Text>
                        )}
                        <View style={{ marginTop: SPACING.xs }}>
                          <Badge status={lead.status} />
                        </View>

                        {showActions && (
                          <View style={styles.cardActions}>
                            {next && (
                              <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(lead)}>
                                <Text style={styles.advanceText}>Avançar →</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.lostBtn} onPress={() => markLost(lead)}>
                              <Text style={styles.lostText}>Perdido</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </Card>
                    )
                  })
                }
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const COLUMN_WIDTH = 260

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  followUpBanner: { paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.xs },
  followUpAlert: { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm },
  followUpAlertDanger: { backgroundColor: COLORS.danger + '15', borderColor: COLORS.danger + '44' },
  followUpAlertToday: { backgroundColor: COLORS.warning + '22', borderColor: COLORS.warning + '55' },
  followUpAlertWarning: { backgroundColor: COLORS.warning + '15', borderColor: COLORS.warning + '44' },
  followUpAlertTitle: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '800', marginBottom: 4 },
  followUpAlertLine: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginBottom: 2 },
  followUpAlertMore: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontStyle: 'italic' },
  followUpDateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  followUpCardBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.full, borderWidth: 1 },
  followUpCardBadgeDanger: { backgroundColor: COLORS.danger + '22', borderColor: COLORS.danger + '55' },
  followUpCardBadgeToday: { backgroundColor: COLORS.warning + '22', borderColor: COLORS.warning + '55' },
  followUpCardBadgeText: { color: COLORS.text, fontSize: 10, fontWeight: '800' },
  column: { width: COLUMN_WIDTH },
  columnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  columnTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '800' },
  columnCountBadge: { backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  columnCountText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  columnTotal: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm },
  columnBody: { maxHeight: 560 },
  columnEmpty: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: SPACING.lg },
  pipelineCard: { marginBottom: SPACING.sm },
  cardName: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '700', marginBottom: 4 },
  cardLine: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 2 },
  cardActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  advanceBtn: { flex: 1, backgroundColor: COLORS.primary + '22', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary + '44', paddingVertical: 6, alignItems: 'center' },
  advanceText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  lostBtn: { backgroundColor: COLORS.danger + '22', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.danger + '44', paddingVertical: 6, paddingHorizontal: SPACING.sm, alignItems: 'center' },
  lostText: { color: COLORS.danger, fontSize: FONT_SIZE.xs, fontWeight: '700' },
})