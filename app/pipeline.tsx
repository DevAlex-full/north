import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
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
import {
  buildPipelineColumns,
  getNextLeadStatus,
  groupFollowUpsByUrgency,
  PIPELINE_COLUMNS,
  type PipelineCardData,
  type PipelineColumnKey,
} from '../utils/commercial'
import type { Lead } from '../types/lead.types'

/** Janela padrão (dias) para follow-ups pendentes — mesmo padrão do backend. */
const FOLLOW_UP_WINDOW_DAYS = 7

/**
 * Fase 5.5 (correção) — Cor de destaque por etapa do funil, só para dar
 * uma leitura visual de progressão (neutro → quente → resolvido/perdido).
 * Reaproveita a paleta já existente em COLORS — nenhuma cor nova.
 */
const COLUMN_ACCENT: Record<PipelineColumnKey, string> = {
  NEW: COLORS.textMuted,
  CONTACT: COLORS.primary,
  PROPOSAL: COLORS.primary,
  NEGOTIATION: COLORS.warning,
  CLOSED: COLORS.success,
  ACTIVE_CLIENT: COLORS.success,
  LOST: COLORS.danger,
}

export default function PipelineScreen() {
  const router = useRouter()
  const { leads, isLoading: leadsLoading, fetchLeads, updateLead } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()
  const [refreshing, setRefreshing] = useState(false)

  // Fase 5.5 (correção) — mobile-first: uma etapa por vez, escolhida por
  // chip. Nada de Kanban com colunas lado a lado / scroll horizontal na
  // lista de leads — só os chips rolam horizontalmente.
  const [selectedKey, setSelectedKey] = useState<PipelineColumnKey>(PIPELINE_COLUMNS[0].key)

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

  // Reaproveita 100% o mesmo helper de agrupamento/valor por etapa já usado
  // antes — nenhuma regra de negócio nova ou duplicada, só a apresentação mudou.
  const columns = buildPipelineColumns(leads, projects)
  const selectedColumn = columns.find((c) => c.key === selectedKey) ?? columns[0]

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

  // Fase 5.5 — só decide "sem lead" depois que a store realmente carregou uma
  // vez. Antes disso mostrava o EmptyState por um instante mesmo quando havia
  // dados vindo (inclusive leads recém-chegados do North SDR).
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  useFocusEffect(useCallback(() => {
    if (!leadsLoading) setHasLoadedOnce(true)
  }, [leadsLoading]))

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

      {!hasLoadedOnce && leadsLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>Carregando pipeline...</Text>
        </View>
      ) : !hasAnyLead ? (
        <EmptyState icon="📊" title="Nenhum lead no pipeline" subtitle="Cadastre leads na tela de Clientes, ou aguarde a chegada de novos leads do North SDR" />
      ) : (
        <>
          {/* Seletor de etapas — chips compactos, único ponto com scroll horizontal da tela */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {columns.map((column) => {
              const isSelected = column.key === selectedKey
              const accent = COLUMN_ACCENT[column.key]
              return (
                <TouchableOpacity
                  key={column.key}
                  onPress={() => setSelectedKey(column.key)}
                  style={[
                    styles.chip,
                    { borderColor: isSelected ? accent : COLORS.border },
                    isSelected && { backgroundColor: accent + '22' },
                  ]}
                >
                  <Text style={[styles.chipText, isSelected && { color: accent }]}>{column.label}</Text>
                  <View style={[styles.chipCountBadge, { backgroundColor: isSelected ? accent + '33' : COLORS.surfaceLight }]}>
                    <Text style={[styles.chipCountText, isSelected && { color: accent }]}>{column.count}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Cabeçalho da etapa selecionada */}
          <View style={[styles.stageHeader, { borderLeftColor: COLUMN_ACCENT[selectedColumn.key] }]}>
            <View>
              <Text style={styles.stageTitle}>
                {selectedColumn.label} — {selectedColumn.count} lead{selectedColumn.count !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.stageTotal}>{formatCurrency(selectedColumn.totalValue)}</Text>
            </View>
          </View>

          {/* Lista vertical — largura 100%, sem scroll horizontal, sem largura/altura fixa */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          >
            {selectedColumn.cards.length === 0 ? (
              <Text style={styles.stageEmpty}>Nenhum lead nesta etapa.</Text>
            ) : (
              selectedColumn.cards.map((cardData: PipelineCardData) => {
                const { lead, linkedProject, combinedValue } = cardData
                const next = getNextLeadStatus(lead.status)
                const showActions = lead.status !== 'ACTIVE_CLIENT' && lead.status !== 'LOST'
                const isOverdue = overdueLeadIds.has(lead.id)
                const isToday = todayLeadIds.has(lead.id)
                const isFromSdr = lead.origin === 'north_sdr'
                // Fase 5.5 — "prioridade visual": tarja lateral colorida no card, reforçando o mesmo sinal do badge de follow-up.
                const priorityColor = isOverdue ? COLORS.danger : isToday ? COLORS.warning : 'transparent'

                return (
                  <Card key={lead.id} style={[styles.pipelineCard, { borderLeftWidth: 3, borderLeftColor: priorityColor }]}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{lead.name}</Text>
                      {isFromSdr && (
                        <View style={styles.sdrBadge}>
                          <Text style={styles.sdrBadgeText}>🤖 SDR</Text>
                        </View>
                      )}
                    </View>
                    {lead.company && <Text style={styles.cardLine}>🏢 {lead.company}</Text>}
                    {(lead.phone || lead.whatsapp) && <Text style={styles.cardLine}>📞 {lead.whatsapp || lead.phone}</Text>}
                    {lead.followUpAt && (
                      <View style={styles.followUpDateRow}>
                        <Text style={styles.cardLine}>📅 {new Date(lead.followUpAt).toLocaleDateString('pt-BR')}</Text>
                        {isOverdue && (
                          <View style={[styles.followUpCardBadge, styles.followUpCardBadgeDanger]}>
                            <Text style={styles.followUpCardBadgeText}>🔴 Atrasado</Text>
                          </View>
                        )}
                        {isToday && (
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
                          <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(lead)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Text style={styles.advanceText}>Avançar →</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.lostBtn} onPress={() => markLost(lead)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Text style={styles.lostText}>Perdido</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                )
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  loadingText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
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
  // Fase 5.5 (correção) — chips de etapa: único elemento com scroll horizontal na tela
  chipsScroll: { flexGrow: 0, marginBottom: SPACING.sm },
  chipsContent: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, backgroundColor: COLORS.surface },
  chipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  chipCountBadge: { minWidth: 22, paddingHorizontal: 6, borderRadius: RADIUS.full, alignItems: 'center' },
  chipCountText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '800' },
  // Fase 5.5 (correção) — cabeçalho da etapa selecionada
  stageHeader: { marginHorizontal: SPACING.md, marginBottom: SPACING.sm, paddingLeft: SPACING.md, borderLeftWidth: 3 },
  stageTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '800' },
  stageTotal: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  // Fase 5.5 (correção) — lista vertical: sem largura fixa, sem maxHeight, só padding lateral da tela
  listContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  stageEmpty: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: SPACING.xxl },
  pipelineCard: { marginBottom: SPACING.sm },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.xs, marginBottom: 4 },
  cardName: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  sdrBadge: { backgroundColor: COLORS.primary + '22', borderColor: COLORS.primary + '55', borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1 },
  sdrBadgeText: { color: COLORS.primary, fontSize: 9, fontWeight: '800' },
  cardLine: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  advanceBtn: { flex: 1, backgroundColor: COLORS.primary + '22', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary + '44', paddingVertical: 10, alignItems: 'center' },
  advanceText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  lostBtn: { backgroundColor: COLORS.danger + '22', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.danger + '44', paddingVertical: 10, paddingHorizontal: SPACING.md, alignItems: 'center' },
  lostText: { color: COLORS.danger, fontSize: FONT_SIZE.sm, fontWeight: '700' },
})