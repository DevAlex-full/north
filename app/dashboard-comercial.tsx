import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { useActivityStore } from '../stores/activity.store'
import { useProjectsFinance } from '../hooks/useProjectsFinance'
import { useFollowUps } from '../hooks/useFollowUps'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { ActivityTimeline } from '../components/ui/ActivityTimeline'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatCurrency } from '../utils/format'
import { formatDateShort } from '../utils/date'
import {
  getCommercialMetrics,
  groupFollowUpsByUrgency,
  getOperationalHealth,
  getPendingSubtasksSummary,
  getProjectsWithNextAction,
  getProjectTaskProgress,
  getUpcomingDeliveries,
} from '../utils/commercial'
import { buildPendencies, countPendenciesByPriority } from '../utils/notifications'
import type { Project } from '../types/project.types'

/** Janela padrão (dias) para follow-ups pendentes — mesmo padrão do backend. */
const FOLLOW_UP_WINDOW_DAYS = 7
/** Quantidade de atividades recentes exibidas no resumo. */
const RECENT_ACTIVITIES_LIMIT = 8
/** Quantidade de itens exibidos por lista dentro de "Prioridades do Dia" (glance curto — listas completas ficam nas seções detalhadas abaixo). */
const PRIORITY_LIST_LIMIT = 3
const PRIORITY_SUBTASKS_LIMIT = 5
const PRIORITY_PROJECTS_LIMIT = 5

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

  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    await Promise.all([fetchLeads(), fetchProjects('CLIENT'), fetchActivities()])
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const metrics = getCommercialMetrics(leads, projects, financeByProjectId)

  // Fase 4.5 — Dashboard Operacional: saúde da operação, prioridades do dia e próximas entregas.
  // Tudo calculado em utils/commercial.ts a partir de leads/projects já carregados — nenhuma
  // chamada nova, nenhum dado novo.
  const health = getOperationalHealth(leads, projects)
  const pendingSubtasks = getPendingSubtasksSummary(projects)
  const projectsWithNextAction = getProjectsWithNextAction(projects)
  const upcomingDeliveries = getUpcomingDeliveries(projects)

  // Fase 5.1 — Pendências consolidadas (mesmos dados já carregados acima; nenhuma chamada nova)
  const pendencies = buildPendencies({ leads, projects, followUps })
  const pendencyCounts = countPendenciesByPriority(pendencies)

  const closingRateLabel = `${metrics.closingRate.toFixed(0)}%`
  const conversionRateLabel = `${metrics.conversionRate.toFixed(0)}%`

  const getClientName = (p: Project) => leads.find((l) => l.id === p.clientId)?.name ?? null

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
        {/* Fase 4.5 — Visão Executiva: os 10 números que mais importam, de relance */}
        <Text style={styles.sectionTitle}>🎯 Visão Executiva</Text>
        <View style={styles.metricsGrid}>
          <MetricCard label="Receita Prevista" value={formatCurrency(metrics.expectedRevenue)} color={COLORS.primary} compact />
          <MetricCard label="Receita Recebida" value={formatCurrency(metrics.receivedRevenue)} color={COLORS.success} compact />
          <MetricCard label="Valor Pendente" value={formatCurrency(metrics.pendingRevenue)} color={COLORS.warning} compact />
          <MetricCard label="Custos" value={formatCurrency(metrics.totalSpent)} color={COLORS.danger} compact />
          <MetricCard
            label="Lucro Estimado"
            value={formatCurrency(metrics.estimatedProfit)}
            color={metrics.estimatedProfit >= 0 ? COLORS.success : COLORS.danger}
            compact
          />
          <MetricCard label="Clientes Ativos" value={String(metrics.activeClients)} color={COLORS.success} />
          <MetricCard label="Projetos Ativos" value={String(metrics.activeProjects)} color={COLORS.primary} />
          <MetricCard label="Leads em Aberto" value={String(metrics.openLeads)} />
          <MetricCard label="Follow-ups Vencidos" value={String(followUpGroups.overdue.length)} color={COLORS.danger} />
          <MetricCard label="Entregas Próximas" value={String(upcomingDeliveries.length)} color={COLORS.warning} />
        </View>

        {/* Fase 5.1 — Central de Pendências: card pequeno, resume por prioridade e leva à tela dedicada */}
        <Text style={styles.sectionTitle}>🔔 Pendências</Text>
        <TouchableOpacity onPress={() => router.push('/notificacoes')} activeOpacity={0.85}>
          <Card>
            <View style={styles.pendencySummaryRow}>
              <View style={styles.pendencySummaryItem}>
                <Text style={[styles.pendencySummaryValue, { color: COLORS.danger }]}>{pendencyCounts.CRITICO}</Text>
                <Text style={styles.pendencySummaryLabel}>Críticas</Text>
              </View>
              <View style={styles.pendencySummaryItem}>
                <Text style={[styles.pendencySummaryValue, { color: COLORS.warning }]}>{pendencyCounts.ALTO}</Text>
                <Text style={styles.pendencySummaryLabel}>Altas</Text>
              </View>
              <View style={styles.pendencySummaryItem}>
                <Text style={[styles.pendencySummaryValue, { color: COLORS.primary }]}>{pendencyCounts.MEDIO}</Text>
                <Text style={styles.pendencySummaryLabel}>Médias</Text>
              </View>
              <View style={styles.pendencySummaryItem}>
                <Text style={[styles.pendencySummaryValue, { color: COLORS.success }]}>{pendencyCounts.BAIXO}</Text>
                <Text style={styles.pendencySummaryLabel}>Baixas</Text>
              </View>
            </View>
            <Text style={styles.pendencyViewAll}>Ver Central de Pendências →</Text>
          </Card>
        </TouchableOpacity>

        {/* Fase 4.5 — Saúde da Operação: 6 indicadores de atenção, em glance */}
        <Text style={styles.sectionTitle}>🏥 Saúde da Operação</Text>
        <Card>
          <HealthIndicatorRow
            icon="⚡"
            label="Projetos sem próxima ação"
            count={health.projectsWithoutNextAction.length}
            tone="warning"
            examples={health.projectsWithoutNextAction.map((p) => p.name)}
          />
          <HealthIndicatorRow
            icon="📅"
            label="Clientes sem follow-up"
            count={health.clientsWithoutFollowUp.length}
            tone="danger"
            examples={health.clientsWithoutFollowUp.map((l) => l.name)}
          />
          <HealthIndicatorRow
            icon="⏳"
            label="Projetos com prazo próximo"
            count={health.projectsWithNearDeadline.length}
            tone="danger"
            examples={health.projectsWithNearDeadline.map((p) => p.name)}
          />
          <HealthIndicatorRow
            icon="🐌"
            label="Projetos parados (+14 dias)"
            count={health.stalledProjects.length}
            tone="danger"
            examples={health.stalledProjects.map((p) => p.name)}
          />
          <HealthIndicatorRow
            icon="📉"
            label="Leads sem retorno"
            count={health.staleLeads.length}
            tone="warning"
            examples={health.staleLeads.map((l) => l.name)}
          />
          <HealthIndicatorRow
            icon="☑️"
            label="Subtarefas pendentes"
            count={health.pendingSubtasksCount}
            tone="warning"
            last
          />
        </Card>

        {/* Fase 4.5 — Prioridades do Dia: o que precisa de atenção agora */}
        <Text style={styles.sectionTitle}>🔥 Prioridades do Dia</Text>
        <Card>
          <Text style={styles.prioritySubTitle}>🔴 Follow-ups atrasados</Text>
          {followUpGroups.overdue.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum follow-up atrasado. 🎉</Text>
          ) : (
            followUpGroups.overdue.slice(0, PRIORITY_LIST_LIMIT).map((lead) => (
              <View key={lead.id} style={styles.contactRow}>
                <Text style={styles.contactName}>{lead.name}</Text>
                <Text style={[styles.contactDate, { color: COLORS.danger }]}>
                  {lead.followUpAt ? formatDateShort(lead.followUpAt) : '-'}
                </Text>
              </View>
            ))
          )}

          <Text style={[styles.prioritySubTitle, { marginTop: SPACING.sm }]}>🟠 Follow-ups de hoje</Text>
          {followUpGroups.today.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum follow-up para hoje.</Text>
          ) : (
            followUpGroups.today.slice(0, PRIORITY_LIST_LIMIT).map((lead) => (
              <View key={lead.id} style={styles.contactRow}>
                <Text style={styles.contactName}>{lead.name}</Text>
                {lead.company && <Text style={styles.contactSub}>🏢 {lead.company}</Text>}
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: SPACING.sm }}>
          <Text style={styles.prioritySubTitle}>☑️ Subtarefas pendentes mais importantes</Text>
          {pendingSubtasks.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma subtarefa pendente. 🎉</Text>
          ) : (
            pendingSubtasks.slice(0, PRIORITY_SUBTASKS_LIMIT).map((item) => (
              <View key={item.subtaskId} style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{item.subtaskTitle}</Text>
                  <Text style={styles.contactSub}>{item.projectName} · {item.taskTitle}</Text>
                </View>
                <Text style={styles.priorityTag}>
                  {item.taskPriority === 1 ? '🔴 Alta' : item.taskPriority === 2 ? '🟡 Média' : '🟢 Baixa'}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: SPACING.sm }}>
          <Text style={styles.prioritySubTitle}>⚡ Projetos com próxima ação</Text>
          {projectsWithNextAction.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum projeto com próxima ação definida.</Text>
          ) : (
            projectsWithNextAction.slice(0, PRIORITY_PROJECTS_LIMIT).map((p) => (
              <View key={p.id} style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{p.name}</Text>
                  <Text style={styles.contactSub}>⚡ {p.nextAction}</Text>
                </View>
                {p.deadline && <Text style={styles.contactDate}>{formatDateShort(p.deadline)}</Text>}
              </View>
            ))
          )}
        </Card>

        <Card style={{ marginTop: SPACING.sm }}>
          <Text style={styles.prioritySubTitle}>🕐 Atividades recentes importantes</Text>
          <ActivityTimeline
            activities={activities}
            isLoading={activitiesLoading}
            limit={RECENT_ACTIVITIES_LIMIT}
            emptyLabel="Nenhuma atividade registrada ainda."
          />
        </Card>

        {/* Fase 4.5 — Próximas Entregas: projetos de cliente com prazo nos próximos 14 dias */}
        <Text style={styles.sectionTitle}>📦 Próximas Entregas</Text>
        <Card>
          {upcomingDeliveries.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma entrega prevista para os próximos 14 dias.</Text>
          ) : (
            upcomingDeliveries.map((p) => {
              const progress = getProjectTaskProgress(p)
              const pendingTasks = progress.total - progress.done
              return (
                <View key={p.id} style={styles.deliveryRow}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{p.name}</Text>
                      <Text style={styles.contactSub}>🏢 {getClientName(p) || '—'}</Text>
                    </View>
                    <Badge status={p.clientStatus || 'LEAD'} />
                  </View>
                  <Text style={styles.deliveryMeta}>📅 {formatDateShort(p.deadline as string)}</Text>
                  <Text style={styles.deliveryMeta}>
                    {progress.done}/{progress.total} tarefas ({progress.percent}%)
                    {pendingTasks > 0 ? ` · ${pendingTasks} pendente(s)` : ''}
                  </Text>
                  {p.nextAction && <Text style={[styles.deliveryMeta, { color: COLORS.warning }]}>⚡ {p.nextAction}</Text>}
                </View>
              )
            })
          )}
        </Card>

        {/* Indicadores de funil (antiga "Visão Geral" — Clientes Ativos já aparece na Visão Executiva) */}
        <Text style={styles.sectionTitle}>📈 Indicadores de Funil</Text>
        <View style={styles.metricsGrid}>
          <MetricCard label="Total de Leads" value={String(metrics.totalLeads)} />
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

        {/* Fase 4.4C — Resumo de Follow-ups em 3 baldes (detalhe completo, até 5 por balde) */}
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
      </ScrollView>
    </View>
  )
}

function MetricCard({ label, value, color = COLORS.text, compact = false }: { label: string; value: string; color?: string; compact?: boolean }) {
  return (
    <View style={styles.metricCard}>
      <Text
        style={[compact ? styles.metricValueCompact : styles.metricValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
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

/**
 * Fase 4.5 — Uma linha de indicador de saúde da operação: ícone + rótulo
 * + até 3 exemplos (nomes) + contador destacado. `count === 0` sempre
 * aparece em verde (tudo certo), independente do `tone` configurado —
 * é o "destaque visual" pedido para os indicadores de atenção.
 */
function HealthIndicatorRow({
  icon,
  label,
  count,
  tone,
  examples,
  last,
}: {
  icon: string
  label: string
  count: number
  tone: 'warning' | 'danger'
  examples?: string[]
  last?: boolean
}) {
  const color = count === 0 ? COLORS.success : tone === 'danger' ? COLORS.danger : COLORS.warning
  return (
    <View style={[styles.healthRow, !last && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.healthLabel}>{icon} {label}</Text>
        {count > 0 && examples && examples.length > 0 && (
          <Text style={styles.healthExamples} numberOfLines={1}>{examples.slice(0, 3).join(' · ')}</Text>
        )}
      </View>
      <View style={[styles.healthCountBadge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
        <Text style={[styles.healthCountText, { color }]}>{count}</Text>
      </View>
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
  metricValueCompact: { fontSize: FONT_SIZE.lg, fontWeight: '900', marginBottom: 4 },
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
  // Fase 4.5 — Saúde da Operação
  healthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  healthLabel: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  healthExamples: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  healthCountBadge: { minWidth: 32, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, alignItems: 'center' },
  healthCountText: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  // Fase 4.5 — Prioridades do Dia
  prioritySubTitle: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '800', marginBottom: SPACING.xs },
  priorityTag: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  // Fase 4.5 — Próximas Entregas
  deliveryRow: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  deliveryMeta: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  // Fase 5.1 — card de Pendências
  pendencySummaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: SPACING.sm, marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pendencySummaryItem: { alignItems: 'center' },
  pendencySummaryValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900' },
  pendencySummaryLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  pendencyViewAll: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700', textAlign: 'center' },
})