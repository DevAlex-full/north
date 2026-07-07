import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { useActivityStore } from '../stores/activity.store'
import { useProjectsFinance } from '../hooks/useProjectsFinance'
import { useFollowUps } from '../hooks/useFollowUps'
import { Card } from '../components/ui/Card'
import { ActivityTimeline } from '../components/ui/ActivityTimeline'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatCurrency } from '../utils/format'
import { formatDateShort } from '../utils/date'
import { getCommercialMetrics, groupFollowUpsByUrgency } from '../utils/commercial'

/** Janela padrão (dias) para follow-ups pendentes — mesmo padrão do backend. */
const FOLLOW_UP_WINDOW_DAYS = 7
/** Quantidade de atividades recentes exibidas no resumo. */
const RECENT_ACTIVITIES_LIMIT = 8

export default function DashboardComercialScreen() {
  const router = useRouter()
  const { leads, fetchLeads } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()
  const { activities, isLoading: activitiesLoading, fetchActivities } = useActivityStore()

  const clientProjects = projects.filter((p) => p.kind === 'CLIENT')
  const projectIds = clientProjects.map((p) => p.id)
  const { financeByProjectId, reload: reloadFinance } = useProjectsFinance(projectIds)

  // Fase 4.4C — Resumo de Follow-ups em 3 baldes, consumindo exclusivamente useFollowUps()
  const { followUps, isLoading: followUpsLoading, reload: reloadFollowUps } = useFollowUps(FOLLOW_UP_WINDOW_DAYS)
  const followUpGroups = groupFollowUpsByUrgency(followUps)

  const load = async () => {
    await Promise.all([fetchLeads(), fetchProjects('CLIENT'), fetchActivities()])
    setRefreshing(false)
  }

  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => { load() }, []))

  const metrics = getCommercialMetrics(leads, projects, financeByProjectId)

  const closingRateLabel = `${metrics.closingRate.toFixed(0)}%`
  const conversionRateLabel = `${metrics.conversionRate.toFixed(0)}%`

  const onRefresh = () => { setRefreshing(true); load(); reloadFinance(); reloadFollowUps() }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📈 Dashboard Comercial</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Visão geral */}
        <Text style={styles.sectionTitle}>🎯 Visão Geral</Text>
        <View style={styles.metricsGrid}>
          <MetricCard label="Total de Leads" value={String(metrics.totalLeads)} />
          <MetricCard label="Clientes Ativos" value={String(metrics.activeClients)} color={COLORS.success} />
          <MetricCard label="Projetos Comerciais" value={String(metrics.commercialProjects)} color={COLORS.primary} />
          <MetricCard label="Taxa de Fechamento" value={closingRateLabel} color={COLORS.warning} />
          <MetricCard label="Taxa de Conversão" value={conversionRateLabel} />
        </View>

        {/* Financeiro */}
        <Text style={styles.sectionTitle}>💰 Financeiro</Text>
        <Card>
          <FinancialRow label="Em negociação" value={metrics.valueInNegotiation} color={COLORS.warning} />
          <FinancialRow label="Valor fechado" value={metrics.valueClosed} color={COLORS.success} />
          <FinancialRow label="Receita prevista" value={metrics.expectedRevenue} color={COLORS.primary} />
          <FinancialRow label="Receita recebida" value={metrics.receivedRevenue} color={COLORS.success} />
          <FinancialRow label="Pendente" value={metrics.pendingRevenue} color={COLORS.warning} />
          <FinancialRow label="Custos" value={metrics.totalSpent} color={COLORS.danger} />
          <FinancialRow
            label="Lucro estimado"
            value={metrics.estimatedProfit}
            color={metrics.estimatedProfit >= 0 ? COLORS.success : COLORS.danger}
            last
          />
        </Card>

        {/* Fase 4.4C — Resumo de Follow-ups em 3 baldes (useFollowUps + groupFollowUpsByUrgency) */}
        <Text style={styles.sectionTitle}>📅 Resumo de Follow-ups</Text>
        <Card>
          <View style={styles.followUpSummaryRow}>
            <View style={styles.followUpSummaryItem}>
              <Text style={[styles.followUpSummaryValue, { color: COLORS.danger }]}>{followUpsLoading ? '—' : followUpGroups.overdue.length}</Text>
              <Text style={styles.followUpSummaryLabel}>Atrasados</Text>
            </View>
            <View style={styles.followUpSummaryItem}>
              <Text style={[styles.followUpSummaryValue, { color: COLORS.warning }]}>{followUpsLoading ? '—' : followUpGroups.today.length}</Text>
              <Text style={styles.followUpSummaryLabel}>Hoje</Text>
            </View>
            <View style={styles.followUpSummaryItem}>
              <Text style={[styles.followUpSummaryValue, { color: COLORS.primary }]}>{followUpsLoading ? '—' : followUpGroups.upcoming.length}</Text>
              <Text style={styles.followUpSummaryLabel}>Próximos dias</Text>
            </View>
          </View>

          {!followUpsLoading && followUpGroups.overdue.length === 0 && followUpGroups.today.length === 0 && followUpGroups.upcoming.length === 0 && (
            <Text style={styles.emptyText}>Nenhum follow-up pendente ou vencido. 🎉</Text>
          )}

          {/* Destaque visual para atrasados — sempre no topo da lista */}
          {followUpGroups.overdue.slice(0, 5).map((lead) => (
            <View key={lead.id} style={[styles.contactRow, styles.contactRowOverdue]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>🔴 {lead.name}</Text>
                {lead.company && <Text style={styles.contactSub}>🏢 {lead.company}</Text>}
              </View>
              <Text style={[styles.contactDate, { color: COLORS.danger }]}>
                {lead.followUpAt ? formatDateShort(lead.followUpAt) : '-'}
              </Text>
            </View>
          ))}
          {followUpGroups.today.slice(0, 5).map((lead) => (
            <View key={lead.id} style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>🟠 {lead.name}</Text>
                {lead.company && <Text style={styles.contactSub}>🏢 {lead.company}</Text>}
              </View>
              <Text style={[styles.contactDate, { color: COLORS.warning }]}>Hoje</Text>
            </View>
          ))}
          {followUpGroups.upcoming.slice(0, 5).map((lead) => (
            <View key={lead.id} style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>🟡 {lead.name}</Text>
                {lead.company && <Text style={styles.contactSub}>🏢 {lead.company}</Text>}
              </View>
              <Text style={[styles.contactDate, { color: COLORS.primary }]}>
                {lead.followUpAt ? formatDateShort(lead.followUpAt) : '-'}
              </Text>
            </View>
          ))}
        </Card>

        {/* Próximos contatos */}
        <Text style={styles.sectionTitle}>📅 Próximos Contatos (7 dias)</Text>
        <Card>
          {metrics.upcomingContacts.length === 0
            ? <Text style={styles.emptyText}>Nenhum contato agendado para os próximos 7 dias.</Text>
            : metrics.upcomingContacts.map((lead) => (
              <View key={lead.id} style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{lead.name}</Text>
                  {lead.company && <Text style={styles.contactSub}>🏢 {lead.company}</Text>}
                </View>
                <Text style={[styles.contactDate, { color: COLORS.warning }]}>
                  {lead.followUpAt ? formatDateShort(lead.followUpAt) : '-'}
                </Text>
              </View>
            ))
          }
        </Card>

        {/* Clientes sem retorno */}
        <Text style={styles.sectionTitle}>⚠️ Leads Sem Retorno (+7 dias)</Text>
        <Card>
          {metrics.staleClients.length === 0
            ? <Text style={styles.emptyText}>Todos os leads tiveram contato recente. 🎉</Text>
            : metrics.staleClients.map((lead) => (
              <View key={lead.id} style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{lead.name}</Text>
                  {lead.company && <Text style={styles.contactSub}>🏢 {lead.company}</Text>}
                </View>
                <Text style={[styles.contactDate, { color: COLORS.danger }]}>
                  {lead.lastContactAt ? formatDateShort(lead.lastContactAt) : 'Nunca contatado'}
                </Text>
              </View>
            ))
          }
        </Card>

        {/* Fase 4.3C — Últimas atividades (ActivityStore) */}
        <Text style={styles.sectionTitle}>🕐 Últimas Atividades</Text>
        <Card>
          <ActivityTimeline
            activities={activities}
            isLoading={activitiesLoading}
            limit={RECENT_ACTIVITIES_LIMIT}
            emptyLabel="Nenhuma atividade registrada ainda."
          />
        </Card>
      </ScrollView>
    </View>
  )
}

function MetricCard({ label, value, color = COLORS.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

function FinancialRow({ label, value, color, last }: { label: string; value: number; color: string; last?: boolean }) {
  return (
    <View style={[styles.finRow, !last && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
      <Text style={styles.finLabel}>{label}</Text>
      <Text style={[styles.finValue, { color }]}>{formatCurrency(value)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  sectionTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  metricValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center' },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  finLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  finValue: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  followUpSummaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: SPACING.sm, marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  followUpSummaryItem: { alignItems: 'center' },
  followUpSummaryValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900' },
  followUpSummaryLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contactRowOverdue: { backgroundColor: COLORS.danger + '10', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.sm },
  contactName: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  contactSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  contactDate: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', padding: SPACING.md },
})