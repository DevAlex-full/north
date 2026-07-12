import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useDailyPanel } from '../hooks/useDailyPanel'
import { taskService } from '../services/task.service'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Checkbox } from '../components/ui/Checkbox'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatDateShort, formatLongDate, getGreeting } from '../utils/date'
import type { PriorityTaskItem, TodayScheduleItem, ProjectInFocus, DailyPriority } from '../utils/daily-panel'

const PRIORITY_COLORS: Record<DailyPriority, string> = {
  CRITICO: COLORS.danger,
  ALTO: COLORS.warning,
  MEDIO: COLORS.primary,
  BAIXO: COLORS.success,
}

const PRIORITY_LABELS: Record<DailyPriority, string> = {
  CRITICO: '🔴 Crítico',
  ALTO: '🟠 Alto',
  MEDIO: '🟡 Médio',
  BAIXO: '🟢 Baixo',
}

const ORIGIN_LABELS: Record<string, string> = {
  TASK: '📋 Tarefa',
  PROJECT_TASK: '🏗️ Tarefa de projeto',
  PROJECT_SUBTASK: '☑️ Subtarefa',
}

const SCHEDULE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AGORA: { label: 'Agora', color: COLORS.success },
  CONCLUIDO: { label: 'Concluído', color: COLORS.textMuted },
  EM_BREVE: { label: 'Em breve', color: COLORS.warning },
}

/** Quantos itens mostrar por lista antes de resumir em "+N outros" — mantém o painel enxuto (é uma visão do dia, não uma listagem completa). */
const LIST_LIMIT = 6

export default function PainelDiarioScreen() {
  const router = useRouter()
  const { data, isLoading, reload } = useDailyPanel()
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => { reload() }, []))

  const onRefresh = () => { setRefreshing(true); reload().finally(() => setRefreshing(false)) }

  const toggleTask = async (item: PriorityTaskItem) => {
    if (item.origin !== 'TASK') return
    const taskId = item.id.replace('task-', '')
    const nextStatus = item.status === 'DONE' ? 'PENDING' : 'DONE'
    try {
      await taskService.update(taskId, { status: nextStatus })
      await reload()
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a tarefa')
    }
  }

  const { summary, scheduleToday, priorityTasks, followUps, projectsInFocus } = data

  const nothingNeedsAttention =
    !isLoading &&
    scheduleToday.length === 0 &&
    priorityTasks.length === 0 &&
    followUps.overdue.length === 0 &&
    followUps.today.length === 0 &&
    followUps.upcoming.length === 0 &&
    projectsInFocus.length === 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>🧭 Painel Diário</Text>
          <Text style={styles.subtitle}>{getGreeting()} — {formatLongDate()}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Seção 1 — Resumo do dia */}
        <Text style={styles.sectionTitle}>📊 Resumo do Dia</Text>
        <View style={styles.summaryGrid}>
          <SummaryCard label="Tarefas hoje" value={summary.tasksToday} />
          <SummaryCard label="Concluídas" value={summary.tasksDone} color={COLORS.success} />
          <SummaryCard label="Pendentes" value={summary.tasksPending} color={COLORS.warning} />
          <SummaryCard label="Follow-ups hoje" value={summary.followUpsToday} color={COLORS.primary} />
          <SummaryCard label="Follow-ups atrasados" value={summary.followUpsOverdue} color={COLORS.danger} />
          <SummaryCard label="Subtarefas pendentes" value={summary.pendingSubtasks} />
          <SummaryCard label="Entregas próximas" value={summary.upcomingDeliveries} color={COLORS.warning} />
          <SummaryCard label="Pendências críticas" value={summary.criticalPendencies} color={COLORS.danger} />
        </View>

        {nothingNeedsAttention ? (
          <EmptyState icon="🎉" title="Sua operação está em dia" subtitle="Nada precisa de atenção imediata agora." />
        ) : (
          <>
            {/* Seção 2 — Agenda de hoje */}
            <Text style={styles.sectionTitle}>🗓️ Agenda de Hoje</Text>
            <Card>
              {scheduleToday.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum bloco de agenda para hoje.</Text>
              ) : (
                scheduleToday.map((block, index) => (
                  <ScheduleRow key={block.id} block={block} last={index === scheduleToday.length - 1} />
                ))
              )}
            </Card>

            {/* Seção 3 — Tarefas prioritárias */}
            <Text style={styles.sectionTitle}>🎯 Tarefas Prioritárias</Text>
            <Card>
              {priorityTasks.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma tarefa prioritária pendente. 🎉</Text>
              ) : (
                priorityTasks.slice(0, LIST_LIMIT).map((item, index) => (
                  <PriorityTaskRow
                    key={item.id}
                    item={item}
                    onToggle={item.origin === 'TASK' ? () => toggleTask(item) : undefined}
                    last={index === Math.min(priorityTasks.length, LIST_LIMIT) - 1}
                  />
                ))
              )}
              {priorityTasks.length > LIST_LIMIT && (
                <Text style={styles.moreText}>+{priorityTasks.length - LIST_LIMIT} outra(s) — veja Projetos ou Agenda</Text>
              )}
            </Card>

            {/* Seção 4 — Follow-ups */}
            <Text style={styles.sectionTitle}>📅 Follow-ups</Text>
            <Card>
              <FollowUpGroup label="🔴 Atrasados" leads={followUps.overdue} color={COLORS.danger} />
              <FollowUpGroup label="🟠 Hoje" leads={followUps.today} color={COLORS.warning} />
              <FollowUpGroup label="🟡 Próximos" leads={followUps.upcoming} color={COLORS.primary} last />
              {followUps.overdue.length === 0 && followUps.today.length === 0 && followUps.upcoming.length === 0 && (
                <Text style={styles.emptyText}>Nenhum follow-up pendente.</Text>
              )}
            </Card>

            {/* Seção 5 — Projetos em foco */}
            <Text style={styles.sectionTitle}>🏗️ Projetos em Foco</Text>
            <Card>
              {projectsInFocus.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum projeto precisando de atenção agora.</Text>
              ) : (
                projectsInFocus.slice(0, LIST_LIMIT).map((project, index) => (
                  <ProjectFocusRow key={project.id} project={project} last={index === Math.min(projectsInFocus.length, LIST_LIMIT) - 1} />
                ))
              )}
              {projectsInFocus.length > LIST_LIMIT && (
                <Text style={styles.moreText}>+{projectsInFocus.length - LIST_LIMIT} outro(s) — veja Projetos</Text>
              )}
            </Card>
          </>
        )}

        {/* Seção 6 — Ações rápidas */}
        <Text style={styles.sectionTitle}>⚡ Ações Rápidas</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction icon="🗓️" label="Agenda" onPress={() => router.push('/agenda')} />
          <QuickAction icon="🏗️" label="Projetos" onPress={() => router.push('/projetos')} />
          <QuickAction icon="📊" label="Pipeline" onPress={() => router.push('/pipeline')} />
          <QuickAction icon="🔔" label="Pendências" onPress={() => router.push('/notificacoes')} />
          <QuickAction icon="📈" label="Dashboard" onPress={() => router.push('/dashboard-comercial')} />
        </View>
      </ScrollView>
    </View>
  )
}

function SummaryCard({ label, value, color = COLORS.text }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

function ScheduleRow({ block, last }: { block: TodayScheduleItem; last?: boolean }) {
  const status = SCHEDULE_STATUS_LABELS[block.status]
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{block.startTime}–{block.endTime}  {block.title}</Text>
        {block.category && <Text style={styles.rowSub}>🏷️ {block.category}</Text>}
        {block.relatedTasks.length > 0 && (
          <Text style={styles.rowSub}>
            {block.relatedTasks.filter((t) => t.status === 'DONE').length}/{block.relatedTasks.length} tarefa(s) vinculada(s)
          </Text>
        )}
      </View>
      <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
    </View>
  )
}

function PriorityTaskRow({
  item,
  onToggle,
  last,
}: {
  item: PriorityTaskItem
  onToggle?: () => void
  last?: boolean
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      {onToggle ? (
        <View style={{ flex: 1 }}>
          <Checkbox label={item.title} checked={item.status === 'DONE'} onToggle={onToggle} />
          <RowMeta item={item} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          <RowMeta item={item} />
        </View>
      )}
      <Text style={[styles.badgeText, { color: PRIORITY_COLORS[item.priority] }]}>{PRIORITY_LABELS[item.priority]}</Text>
    </View>
  )
}

function RowMeta({ item }: { item: PriorityTaskItem }) {
  return (
    <>
      <Text style={styles.rowSub}>
        {ORIGIN_LABELS[item.origin]}{item.project ? `  ·  🏗️ ${item.project}` : ''}
      </Text>
      {item.deadline && <Text style={styles.rowSub}>📅 {formatDateShort(item.deadline)}</Text>}
      <Text style={styles.rowAction}>➡️ {item.suggestedAction}</Text>
    </>
  )
}

function FollowUpGroup({ label, leads, color, last }: { label: string; leads: { id: string; name: string; followUpAt: string | null }[]; color: string; last?: boolean }) {
  if (leads.length === 0) return null
  return (
    <View style={[!last && styles.rowBorder, { paddingVertical: SPACING.sm }]}>
      <Text style={[styles.rowTitle, { color }]}>{label} ({leads.length})</Text>
      {leads.slice(0, 3).map((lead) => (
        <Text key={lead.id} style={styles.rowSub}>
          • {lead.name}{lead.followUpAt ? ` — ${formatDateShort(lead.followUpAt)}` : ''}
        </Text>
      ))}
      {leads.length > 3 && <Text style={styles.moreText}>+{leads.length - 3} outro(s)</Text>}
    </View>
  )
}

function ProjectFocusRow({ project, last }: { project: ProjectInFocus; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder, { alignItems: 'flex-start' }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{project.name}</Text>
        {project.client && <Text style={styles.rowSub}>🏢 {project.client}</Text>}
        <Text style={styles.rowSub}>
          {project.progress.done}/{project.progress.total} tarefas ({project.progress.percent}%)
          {project.pendingCount > 0 ? ` · ${project.pendingCount} pendente(s)` : ''}
        </Text>
        {project.nextAction && <Text style={[styles.rowSub, { color: COLORS.warning }]}>⚡ {project.nextAction}</Text>}
        <Text style={styles.rowAction}>⚠️ {project.reason}</Text>
      </View>
      {project.deadline && <Text style={styles.rowSub}>{formatDateShort(project.deadline)}</Text>}
    </View>
  )
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  summaryCard: { flex: 1, minWidth: '30%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, alignItems: 'center' },
  summaryValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', marginBottom: 2 },
  summaryLabel: { color: COLORS.textMuted, fontSize: 10, textAlign: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', padding: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowTitle: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  rowSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  rowAction: { color: COLORS.primary, fontSize: FONT_SIZE.xs, marginTop: 4, fontWeight: '600' },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700', marginLeft: SPACING.sm },
  moreText: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontStyle: 'italic', marginTop: SPACING.xs },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  quickAction: { flex: 1, minWidth: '30%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.md, alignItems: 'center' },
  quickActionIcon: { fontSize: FONT_SIZE.xl, marginBottom: 4 },
  quickActionLabel: { color: COLORS.text, fontSize: FONT_SIZE.xs, fontWeight: '700' },
})