import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useProjectStore } from '../stores/project.store'
import { useLeadStore } from '../stores/lead.store'
import { useActivityStore } from '../stores/activity.store'
import { financialService } from '../services/financial.service'
import { useProjectsFinance } from '../hooks/useProjectsFinance'
import { useProjectTransactions } from '../hooks/useProjectTransactions'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Checkbox } from '../components/ui/Checkbox'
import { EmptyState } from '../components/ui/EmptyState'
import { ActivityTimeline } from '../components/ui/ActivityTimeline'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatCurrency, getProjectKindLabel } from '../utils/format'
import { formatDateShort } from '../utils/date'
import { buildProjectTimeline } from '../utils/commercial'
import type { Project, ProjectTask, ProjectSubTask, ProjectKind, ProjectClientStatus } from '../types/project.types'
import type { FinancialCategory } from '../types/financial.types'

const STATUS_OPTIONS = [
  { label: '💡 Ideia', value: 'IDEA' },
  { label: '🚀 Em andamento', value: 'IN_PROGRESS' },
  { label: '⏸ Pausado', value: 'PAUSED' },
  { label: '✅ Concluído', value: 'DONE' },
]

const KIND_OPTIONS = [
  { label: '👤 Pessoal', value: 'PERSONAL' },
  { label: '💼 Cliente', value: 'CLIENT' },
]

const CLIENT_STATUS_OPTIONS = [
  { label: '🟦 Lead', value: 'LEAD' },
  { label: '📄 Proposta', value: 'PROPOSAL' },
  { label: '🤝 Negociação', value: 'NEGOTIATION' },
  { label: '✅ Fechado', value: 'CLOSED' },
  { label: '🚀 Em desenvolvimento', value: 'DEVELOPMENT' },
  { label: '📦 Entregue', value: 'DELIVERED' },
  { label: '🛟 Em suporte', value: 'SUPPORT' },
  { label: '⏸ Pausado', value: 'PAUSED_CLIENT' },
  { label: '❌ Cancelado', value: 'CANCELLED' },
]

const TASK_STATUS_OPTIONS = [
  { label: '⏳ Pendente', value: 'PENDING' },
  { label: '🚀 Em andamento', value: 'IN_PROGRESS' },
  { label: '✅ Concluída', value: 'DONE' },
]

const TASK_PRIORITY_OPTIONS = [
  { label: '🔴 Alta', value: '1' },
  { label: '🟡 Média', value: '2' },
  { label: '🟢 Baixa', value: '3' },
]

const CLIENT_STATUS_VALUES: ProjectClientStatus[] = [
  'LEAD', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'DEVELOPMENT', 'DELIVERED', 'SUPPORT', 'PAUSED_CLIENT', 'CANCELLED',
]

function isProjectKind(v: string): v is ProjectKind { return v === 'PERSONAL' || v === 'CLIENT' }
function isProjectClientStatus(v: string): v is ProjectClientStatus { return (CLIENT_STATUS_VALUES as string[]).includes(v) }

/**
 * Fase 4.3B/4.3C: quando a tarefa tem subtarefas, sua conclusão é derivada
 * delas (todas DONE ⇒ tarefa considerada concluída para fins de progresso).
 * Sem subtarefas, mantém exatamente o comportamento atual — `task.status`
 * continua sendo a única fonte de verdade, editável no modal de tarefa.
 */
function isTaskDone(task: ProjectTask): boolean {
  const subtasks = task.subtasks ?? []
  return subtasks.length > 0
    ? subtasks.every((s) => s.status === 'DONE')
    : task.status === 'DONE'
}

export default function ProjetosScreen() {
  const router = useRouter()
  const { projects, fetchProjects, createProject, updateProject, deleteProject: removeProject, createTask, updateTask, deleteTask } = useProjectStore()
  const { leads, fetchLeads } = useLeadStore()
  const { activities, isLoading: activitiesLoading, fetchActivities } = useActivityStore()

  const clientProjects = projects.filter((p) => p.kind === 'CLIENT')
  const { financeByProjectId, reload: reloadFinance } = useProjectsFinance(clientProjects.map((p) => p.id))

  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTaskEditModal, setShowTaskEditModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [detailProject, setDetailProject] = useState<Project | null>(null)
  // Fase 4.4D — Histórico financeiro do projeto em detalhe
  const { transactions, isLoading: transactionsLoading, reload: reloadTransactions } = useProjectTransactions(detailProject?.id ?? null)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('IN_PROGRESS')
  const [kind, setKind] = useState('PERSONAL')
  const [clientId, setClientId] = useState('')
  const [clientStatus, setClientStatus] = useState('LEAD')
  const [agreedValue, setAgreedValue] = useState('')
  const [projNextAction, setProjNextAction] = useState('')
  const [projObservations, setProjObservations] = useState('')

  // Task form
  const [taskTitle, setTaskTitle] = useState('')
  const [taskEditTitle, setTaskEditTitle] = useState('')
  const [taskEditStatus, setTaskEditStatus] = useState('PENDING')
  const [taskEditPriority, setTaskEditPriority] = useState('2')

  // Fase 4.4A — Pagamento/Despesa do projeto
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentProject, setPaymentProject] = useState<Project | null>(null)
  const [paymentType, setPaymentType] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentCategoryId, setPaymentCategoryId] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentInstallmentNumber, setPaymentInstallmentNumber] = useState('')
  const [paymentInstallmentTotal, setPaymentInstallmentTotal] = useState('')
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([])
  const [savingPayment, setSavingPayment] = useState(false)

  const load = async () => {
    await Promise.all([fetchProjects(), fetchLeads()])
    await reloadFinance()
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const clientOptions = leads.map((l) => ({ label: l.company ? `${l.name} — ${l.company}` : l.name, value: l.id }))
  const getClientName = (p: Project) => leads.find((l) => l.id === p.clientId)?.name ?? null

  const resetForm = () => {
    setName(''); setDescription(''); setStatus('IN_PROGRESS')
    setKind('PERSONAL'); setClientId(''); setClientStatus('LEAD')
    setAgreedValue(''); setProjNextAction(''); setProjObservations('')
  }

  const openNew = () => { setEditing(null); resetForm(); setShowModal(true) }

  const openEdit = (p: Project) => {
    setEditing(p)
    setName(p.name); setDescription(p.description || ''); setStatus(p.status)
    setKind(p.kind); setClientId(p.clientId || ''); setClientStatus(p.clientStatus || 'LEAD')
    setAgreedValue(p.agreedValue != null ? String(p.agreedValue) : '')
    setProjNextAction(p.nextAction || ''); setProjObservations(p.observations || '')
    setShowModal(true)
  }

  const openDetail = (p: Project) => {
    setDetailProject(p)
    setShowDetailModal(true)
    // Fase 4.3C — Timeline de atividades do projeto (ActivityStore)
    fetchActivities({ projectId: p.id }).catch(() => {})
  }

  const save = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Nome obrigatório'); return }
    if (kind === 'CLIENT' && !clientId) { Alert.alert('Atenção', 'Selecione um cliente'); return }
    setSaving(true)
    try {
      const safeKind: ProjectKind = isProjectKind(kind) ? kind : 'PERSONAL'
      const safeClientStatus: ProjectClientStatus = isProjectClientStatus(clientStatus) ? clientStatus : 'LEAD'
      const base = { name: name.trim(), description, status, kind: safeKind }
      const clientFields = kind === 'CLIENT'
        ? { clientId, clientStatus: safeClientStatus, agreedValue: agreedValue ? parseFloat(agreedValue.replace(',', '.')) : undefined, nextAction: projNextAction || undefined, observations: projObservations || undefined }
        : {}
      if (editing) {
        const unlinkFields = kind === 'PERSONAL' && editing.kind === 'CLIENT'
          ? { clientId: null, clientStatus: null, agreedValue: null, nextAction: null }
          : {}
        await updateProject(editing.id, { ...base, ...clientFields, ...unlinkFields })
      } else {
        await createProject({ ...base, ...clientFields })
      }
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  const addTask = async () => {
    if (!taskTitle.trim() || !selectedProject) return
    setSaving(true)
    try { await createTask(selectedProject.id, { title: taskTitle.trim(), status: 'PENDING', priority: 2 }); setTaskTitle(''); setShowTaskModal(false); await load() }
    catch { Alert.alert('Erro', 'Não foi possível criar tarefa') }
    finally { setSaving(false) }
  }

  const toggleTask = async (project: Project, task: ProjectTask) => {
    const next = task.status === 'DONE' ? 'PENDING' : 'DONE'
    try { await updateTask(project.id, task.id, { status: next }); await load() } catch {}
  }

  const deleteProjectAlert = (p: Project) => {
    Alert.alert('Excluir', `Excluir "${p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await removeProject(p.id); await load() } },
    ])
  }

  const openTaskEdit = (project: Project, task: ProjectTask) => {
    setSelectedProject(project); setEditingTask(task)
    setTaskEditTitle(task.title); setTaskEditStatus(task.status); setTaskEditPriority(String(task.priority ?? 2))
    setShowTaskEditModal(true)
  }

  const saveTaskEdit = async () => {
    if (!taskEditTitle.trim()) { Alert.alert('Atenção', 'Título obrigatório'); return }
    if (!selectedProject || !editingTask) return
    setSaving(true)
    try { await updateTask(selectedProject.id, editingTask.id, { title: taskEditTitle.trim(), status: taskEditStatus, priority: parseInt(taskEditPriority) }); setShowTaskEditModal(false); await load() }
    catch { Alert.alert('Erro', 'Não foi possível salvar a tarefa') }
    finally { setSaving(false) }
  }

  const deleteTaskAlert = (project: Project, task: ProjectTask) => {
    Alert.alert('Excluir tarefa', `Excluir "${task.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { try { await deleteTask(project.id, task.id); await load() } catch { Alert.alert('Erro', 'Não foi possível excluir') } } },
    ])
  }

  const getProgress = (tasks: ProjectTask[]) => {
    if (!tasks?.length) return 0
    return Math.round((tasks.filter(isTaskDone).length / tasks.length) * 100)
  }

  /**
   * Fase 4.4A — Abre o formulário de lançamento financeiro rápido do
   * projeto (pagamento recebido ou despesa). Segue o mesmo padrão já usado
   * ao editar tarefa a partir do modal de detalhe: fecha o modal de
   * detalhe antes de abrir o novo, evitando empilhar modais.
   */
  const openPaymentModal = async (project: Project, type: 'INCOME' | 'EXPENSE') => {
    setShowDetailModal(false)
    setPaymentProject(project)
    setPaymentType(type)
    setPaymentAmount(''); setPaymentCategoryId(''); setPaymentDescription(''); setPaymentDate('')
    setPaymentInstallmentNumber(''); setPaymentInstallmentTotal('')
    setShowPaymentModal(true)
    if (financialCategories.length === 0) {
      try { setFinancialCategories(await financialService.getCategories()) } catch {}
    }
  }

  /**
   * Cria a transação financeira sempre vinculada ao projeto (`projectId`).
   * O financeiro do projeto continua 100% derivado de FinancialTransaction
   * — nenhum valor é somado ou guardado localmente; após salvar, apenas
   * recarregamos o resumo (`reloadFinance`) e o histórico
   * (`reloadTransactions`). Quando é um pagamento (INCOME), o backend já
   * cria o ActivityLog automático — aqui só atualizamos a timeline local
   * para refletir o novo evento.
   *
   * Fase 4.4D — Parcelas: "nº da parcela" e "total de parcelas" não criam
   * nenhum campo/tabela nova — são só compostos no `description` da
   * própria FinancialTransaction (ex: "Parcela 2/3 — Sinal do projeto"),
   * exatamente como pedido. Só fazem sentido para pagamento (INCOME); em
   * despesa os dois campos nem aparecem no formulário.
   */
  const savePayment = async () => {
    if (!paymentProject) return
    if (!paymentAmount || !paymentCategoryId) { Alert.alert('Atenção', 'Preencha valor e categoria'); return }
    const val = parseFloat(paymentAmount.replace(',', '.'))
    if (isNaN(val) || val <= 0) { Alert.alert('Atenção', 'Valor inválido'); return }
    setSavingPayment(true)
    try {
      const installmentLabel = paymentType === 'INCOME' && paymentInstallmentNumber && paymentInstallmentTotal
        ? `Parcela ${paymentInstallmentNumber}/${paymentInstallmentTotal}`
        : ''
      const finalDescription = installmentLabel
        ? (paymentDescription ? `${installmentLabel} — ${paymentDescription}` : installmentLabel)
        : paymentDescription

      await financialService.createTransaction({
        type: paymentType,
        categoryId: paymentCategoryId,
        projectId: paymentProject.id,
        amount: val,
        description: finalDescription || undefined,
        date: paymentDate || undefined,
      })
      setShowPaymentModal(false)
      await Promise.all([reloadFinance(), reloadTransactions()])
      if (paymentType === 'INCOME') {
        fetchActivities({ projectId: paymentProject.id }).catch(() => {})
      }
    } catch {
      Alert.alert('Erro', paymentType === 'INCOME' ? 'Não foi possível registrar o pagamento' : 'Não foi possível registrar a despesa')
    } finally {
      setSavingPayment(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>🏗️ Projetos</Text>
        <Button title="+ Projeto" onPress={openNew} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {projects.length === 0
          ? <EmptyState icon="🏗️" title="Nenhum projeto" subtitle="Adicione seus projetos e acompanhe o progresso" onAction={openNew} actionLabel="Criar projeto" />
          : projects.map(p => {
            const isClient = p.kind === 'CLIENT'
            const finance = financeByProjectId[p.id]
            const prog = getProgress(p.projectTasks)
            const isExpanded = expanded === p.id
            const clientName = getClientName(p)

            return (
              <Card key={p.id} style={{ marginBottom: SPACING.sm }}>
                <TouchableOpacity onPress={() => isClient ? openDetail(p) : setExpanded(isExpanded ? null : p.id)} onLongPress={() => deleteProjectAlert(p)} activeOpacity={0.85}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kindTag}>{isClient ? '💼' : '👤'} {getProjectKindLabel(p.kind)}</Text>
                      <Text style={styles.projName}>{p.name}</Text>
                      {isClient && clientName && <Text style={styles.projDesc}>🏢 {clientName}</Text>}
                      {p.description && <Text style={styles.projDesc}>{p.description}</Text>}
                      {isClient && p.nextAction && <Text style={[styles.projDesc, { color: COLORS.warning }]}>⚡ {p.nextAction}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge status={isClient ? (p.clientStatus || 'LEAD') : p.status} />
                      <View style={styles.projectActions}>
                        <TouchableOpacity onPress={() => openEdit(p)}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Editar</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteProjectAlert(p)}><Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Excluir</Text></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {isClient && finance ? (
                    <View style={styles.financeRow}>
                      <View style={styles.financeItem}><Text style={styles.financeLabel}>Combinado</Text><Text style={styles.financeValue}>{formatCurrency(p.agreedValue || 0)}</Text></View>
                      <View style={styles.financeItem}><Text style={styles.financeLabel}>Recebido</Text><Text style={[styles.financeValue, { color: COLORS.success }]}>{formatCurrency(finance.received)}</Text></View>
                      <View style={styles.financeItem}><Text style={styles.financeLabel}>Pendente</Text><Text style={[styles.financeValue, { color: COLORS.warning }]}>{formatCurrency(finance.pending)}</Text></View>
                      <View style={styles.financeItem}><Text style={styles.financeLabel}>Lucro</Text><Text style={[styles.financeValue, { color: finance.profit >= 0 ? COLORS.success : COLORS.danger }]}>{formatCurrency(finance.profit)}</Text></View>
                    </View>
                  ) : (
                    <ProgressBar value={prog} total={100} label={`${p.projectTasks?.filter(isTaskDone).length || 0}/${p.projectTasks?.length || 0} tarefas`} />
                  )}
                </TouchableOpacity>

                {/* Tarefas — projetos pessoais exibem inline; clientes abrem no modal de detalhe */}
                {!isClient && isExpanded && (
                  <View style={{ marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm }}>
                    {(p.projectTasks || []).map(task => (
                      <TaskItem key={task.id} project={p} task={task} onEditTask={openTaskEdit} onDeleteTask={deleteTaskAlert} onToggleTask={toggleTask} />
                    ))}
                    <TouchableOpacity style={styles.addTaskBtn} onPress={() => { setSelectedProject(p); setTaskTitle(''); setShowTaskModal(true) }}>
                      <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>+ Adicionar tarefa</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            )
          })
        }
      </ScrollView>

      {/* Modal Criar/Editar Projeto */}
      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar projeto' : 'Novo projeto'}>
        <Select label="Tipo de projeto" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do projeto" />
        <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Descreva o projeto..." multiline numberOfLines={3} />
        {kind === 'PERSONAL' && <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />}
        {kind === 'CLIENT' && (
          <>
            <Select label="Cliente *" value={clientId} options={clientOptions} onChange={setClientId} placeholder="Selecionar cliente" />
            <Select label="Status comercial" value={clientStatus} options={CLIENT_STATUS_OPTIONS} onChange={setClientStatus} />
            <Input label="Valor combinado (R$)" value={agreedValue} onChangeText={setAgreedValue} placeholder="0,00" keyboardType="decimal-pad" />
            <Input label="Próxima ação" value={projNextAction} onChangeText={setProjNextAction} placeholder="Ex: Enviar contrato..." />
            <Input label="Observações" value={projObservations} onChangeText={setProjObservations} placeholder="Notas sobre o projeto..." multiline numberOfLines={3} />
          </>
        )}
        <Button title={saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>

      {/* Modal Detalhe — Projeto Comercial (Fase 4.2C) */}
      {detailProject && (
        <Modal visible={showDetailModal} onClose={() => setShowDetailModal(false)} title={`📋 ${detailProject.name}`}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
            {/* Cliente vinculado */}
            {detailProject.clientId && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>🏢 Cliente</Text>
                <Text style={styles.detailValue}>{getClientName(detailProject) || '—'}</Text>
              </View>
            )}

            {/* Situação */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>📌 Situação</Text>
              <Badge status={detailProject.clientStatus || 'LEAD'} />
            </View>

            {/* Próximos passos */}
            {detailProject.nextAction && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>⚡ Próximos Passos</Text>
                <Text style={styles.detailValue}>{detailProject.nextAction}</Text>
              </View>
            )}

            {/* Observações */}
            {detailProject.observations && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>📝 Observações</Text>
                <Text style={styles.detailValue}>{detailProject.observations}</Text>
              </View>
            )}

            {/* Financeiro do Projeto */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>💰 Financeiro do Projeto</Text>
              {financeByProjectId[detailProject.id] && (
                <View style={styles.financeSummaryGrid}>
                  <View style={styles.financeChip}>
                    <Text style={styles.financeChipLabel}>Combinado</Text>
                    <Text style={styles.financeChipValue}>{formatCurrency(detailProject.agreedValue || 0)}</Text>
                  </View>
                  <View style={styles.financeChip}>
                    <Text style={styles.financeChipLabel}>Recebido</Text>
                    <Text style={[styles.financeChipValue, { color: COLORS.success }]}>{formatCurrency(financeByProjectId[detailProject.id].received)}</Text>
                  </View>
                  <View style={[styles.financeChip, styles.financeChipHighlightWarning]}>
                    <Text style={styles.financeChipLabel}>Pendente</Text>
                    <Text style={[styles.financeChipValue, { color: COLORS.warning }]}>{formatCurrency(financeByProjectId[detailProject.id].pending)}</Text>
                  </View>
                  <View style={[styles.financeChip, styles.financeChipHighlightDanger]}>
                    <Text style={styles.financeChipLabel}>Custos</Text>
                    <Text style={[styles.financeChipValue, { color: COLORS.danger }]}>{formatCurrency(financeByProjectId[detailProject.id].spent)}</Text>
                  </View>
                  <View style={[styles.financeChip, financeByProjectId[detailProject.id].profit >= 0 ? styles.financeChipHighlightSuccess : styles.financeChipHighlightDanger]}>
                    <Text style={styles.financeChipLabel}>Lucro</Text>
                    <Text style={[styles.financeChipValue, { color: financeByProjectId[detailProject.id].profit >= 0 ? COLORS.success : COLORS.danger }]}>
                      {formatCurrency(financeByProjectId[detailProject.id].profit)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Fase 4.4A — Lançamento financeiro rápido, sempre vinculado ao projeto */}
              <View style={styles.paymentActionsRow}>
                <TouchableOpacity style={styles.paymentActionBtn} onPress={() => openPaymentModal(detailProject, 'INCOME')}>
                  <Text style={styles.paymentActionText}>💰 Registrar pagamento</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.paymentActionBtn, styles.expenseActionBtn]} onPress={() => openPaymentModal(detailProject, 'EXPENSE')}>
                  <Text style={[styles.paymentActionText, { color: COLORS.danger }]}>💸 Registrar despesa</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Fase 4.4D — Histórico Financeiro (lista de FinancialTransaction do projeto) */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🧾 Histórico Financeiro</Text>
              {transactionsLoading ? (
                <Text style={styles.emptyText}>Carregando lançamentos...</Text>
              ) : transactions.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum lançamento registrado para este projeto ainda.</Text>
              ) : (
                transactions.map((t) => (
                  <View key={t.id} style={styles.transactionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.transactionDesc}>
                        {t.type === 'INCOME' ? '💰' : '💸'} {t.description || t.category?.name || (t.type === 'INCOME' ? 'Pagamento' : 'Despesa')}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {formatDateShort(t.date)}{t.category?.name ? ` · ${t.category.name}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.transactionAmount, { color: t.type === 'INCOME' ? COLORS.success : COLORS.danger }]}>
                      {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Tarefas */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>✅ Tarefas</Text>
              {(detailProject.projectTasks || []).map(task => (
                <TaskItem
                  key={task.id}
                  project={detailProject}
                  task={task}
                  onEditTask={(proj, t) => { setShowDetailModal(false); openTaskEdit(proj, t) }}
                  onDeleteTask={deleteTaskAlert}
                  onToggleTask={toggleTask}
                />
              ))}
              <TouchableOpacity style={styles.addTaskBtn} onPress={() => { setShowDetailModal(false); setSelectedProject(detailProject); setTaskTitle(''); setShowTaskModal(true) }}>
                <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>+ Adicionar tarefa</Text>
              </TouchableOpacity>
            </View>

            {/* Linha do Tempo (derivada de datas do próprio projeto — Fase 4.2C) */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>🕐 Histórico</Text>
              {buildProjectTimeline(detailProject).map(event => (
                <View key={event.id} style={styles.timelineRow}>
                  <Text style={styles.timelineIcon}>{event.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineLabel}>{event.label}</Text>
                    <Text style={styles.timelineDate}>{formatDateShort(event.date)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Fase 4.3C — Timeline de atividades (ActivityLog) */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>📍 Atividades</Text>
              <ActivityTimeline
                activities={activities}
                isLoading={activitiesLoading}
                emptyLabel="Nenhuma atividade registrada para este projeto ainda."
              />
            </View>
          </ScrollView>

          <Button title="Editar projeto" onPress={() => { setShowDetailModal(false); openEdit(detailProject) }} variant="secondary" size="md" style={{ marginTop: SPACING.md }} />
        </Modal>
      )}

      {/* Modal Nova Tarefa */}
      <Modal visible={showTaskModal} onClose={() => setShowTaskModal(false)} title={`+ Tarefa em ${selectedProject?.name}`}>
        <Input label="Tarefa *" value={taskTitle} onChangeText={setTaskTitle} placeholder="Ex: Criar tela de login" />
        <Button title={saving ? 'Adicionando...' : 'Adicionar tarefa'} onPress={addTask} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>

      {/* Modal Editar Tarefa */}
      <Modal visible={showTaskEditModal} onClose={() => setShowTaskEditModal(false)} title="Editar tarefa">
        <Input label="Título *" value={taskEditTitle} onChangeText={setTaskEditTitle} placeholder="Título da tarefa" />
        <Select label="Status" value={taskEditStatus} options={TASK_STATUS_OPTIONS} onChange={setTaskEditStatus} />
        <Select label="Prioridade" value={taskEditPriority} options={TASK_PRIORITY_OPTIONS} onChange={setTaskEditPriority} />
        <Button title={saving ? 'Salvando...' : 'Salvar alterações'} onPress={saveTaskEdit} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>

      {/* Modal Registrar Pagamento/Despesa — Fase 4.4A */}
      <Modal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={paymentType === 'INCOME' ? `💰 Pagamento — ${paymentProject?.name ?? ''}` : `💸 Despesa — ${paymentProject?.name ?? ''}`}
      >
        <Input label="Valor (R$) *" value={paymentAmount} onChangeText={setPaymentAmount} placeholder="0,00" keyboardType="decimal-pad" />
        <Select
          label="Categoria *"
          value={paymentCategoryId}
          options={financialCategories.filter((c) => c.type === paymentType).map((c) => ({ label: c.name, value: c.id }))}
          onChange={setPaymentCategoryId}
          placeholder="Selecionar categoria"
        />
        {paymentType === 'INCOME' && (
          <View style={styles.installmentRow}>
            <View style={{ flex: 1 }}>
              <Input label="Parcela nº (opcional)" value={paymentInstallmentNumber} onChangeText={setPaymentInstallmentNumber} placeholder="Ex: 2" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="De quantas" value={paymentInstallmentTotal} onChangeText={setPaymentInstallmentTotal} placeholder="Ex: 3" keyboardType="number-pad" />
            </View>
          </View>
        )}
        <Input label="Descrição" value={paymentDescription} onChangeText={setPaymentDescription} placeholder="Opcional..." />
        <Input label="Data (AAAA-MM-DD)" value={paymentDate} onChangeText={setPaymentDate} placeholder="Deixe em branco para hoje" />
        <Button
          title={savingPayment ? 'Registrando...' : paymentType === 'INCOME' ? 'Registrar pagamento' : 'Registrar despesa'}
          onPress={savePayment}
          loading={savingPayment}
          size="lg"
          style={{ marginTop: SPACING.sm }}
        />
      </Modal>
    </View>
  )
}

/**
 * Fase 4.3C — Item de tarefa com suporte completo a subtarefas: expandir,
 * recolher, criar, editar, excluir, concluir e reabrir. Usado tanto no card
 * inline (projetos pessoais) quanto no modal de detalhe (projetos de
 * cliente), evitando duplicar a mesma lógica em dois lugares.
 *
 * Sem subtarefas: mantém exatamente o comportamento anterior (Checkbox
 * ligado a task.status). Com subtarefas: a checkbox de nível de tarefa dá
 * lugar a um título expansível + barra de progresso computada a partir das
 * subtarefas, conforme especificado.
 */
function TaskItem({
  project,
  task,
  onEditTask,
  onDeleteTask,
  onToggleTask,
}: {
  project: Project
  task: ProjectTask
  onEditTask: (project: Project, task: ProjectTask) => void
  onDeleteTask: (project: Project, task: ProjectTask) => void
  onToggleTask: (project: Project, task: ProjectTask) => void
}) {
  const { createSubTask } = useProjectStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [newSubtitle, setNewSubtitle] = useState('')
  const [adding, setAdding] = useState(false)

  const subtasks = task.subtasks ?? []
  const hasSubtasks = subtasks.length > 0
  const doneCount = subtasks.filter((s) => s.status === 'DONE').length

  const addSubtask = async () => {
    const trimmed = newSubtitle.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      await createSubTask(project.id, task.id, { title: trimmed, order: subtasks.length })
      setNewSubtitle('')
    } catch {
      Alert.alert('Erro', 'Não foi possível criar a subtarefa')
    } finally {
      setAdding(false)
    }
  }

  return (
    <View style={styles.taskItemWrapper}>
      <View style={styles.taskRow}>
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.expandBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>

        {hasSubtasks ? (
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7}>
            <Text style={[styles.taskTitleText, doneCount === subtasks.length && styles.taskTitleDone]}>
              {task.title}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }}>
            <Checkbox label={task.title} checked={task.status === 'DONE'} onToggle={() => onToggleTask(project, task)} />
          </View>
        )}

        <TouchableOpacity onPress={() => onEditTask(project, task)} style={styles.taskActionBtn}>
          <Text style={{ fontSize: FONT_SIZE.md }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDeleteTask(project, task)} style={styles.taskActionBtn}>
          <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.md }}>🗑</Text>
        </TouchableOpacity>
      </View>

      {hasSubtasks && (
        <View style={styles.subtaskProgressWrap}>
          <ProgressBar value={doneCount} total={subtasks.length} label={`${doneCount}/${subtasks.length} subtarefas`} />
        </View>
      )}

      {isExpanded && (
        <View style={styles.subtasksContainer}>
          {subtasks.map((sub) => (
            <SubtaskRow key={sub.id} projectId={project.id} taskId={task.id} subtask={sub} />
          ))}
          <View style={styles.addSubtaskRow}>
            <Input
              value={newSubtitle}
              onChangeText={setNewSubtitle}
              placeholder="Nova subtarefa..."
              onSubmitEditing={addSubtask}
              returnKeyType="done"
              style={{ marginBottom: 0, flex: 1 }}
            />
            <TouchableOpacity onPress={addSubtask} disabled={adding} style={styles.addSubtaskBtn}>
              <Text style={styles.addSubtaskBtnText}>{adding ? '...' : '+'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

/** Fase 4.3C — Linha de subtarefa: concluir/reabrir (checkbox), editar (inline) e excluir. */
function SubtaskRow({ projectId, taskId, subtask }: { projectId: string; taskId: string; subtask: ProjectSubTask }) {
  const { updateSubTask, deleteSubTask } = useProjectStore()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(subtask.title)

  const toggle = async () => {
    try {
      await updateSubTask(projectId, taskId, subtask.id, { status: subtask.status === 'DONE' ? 'PENDING' : 'DONE' })
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a subtarefa')
    }
  }

  const saveEdit = async () => {
    const trimmed = title.trim()
    if (!trimmed) { setTitle(subtask.title); setIsEditing(false); return }
    if (trimmed === subtask.title) { setIsEditing(false); return }
    try {
      await updateSubTask(projectId, taskId, subtask.id, { title: trimmed })
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a subtarefa')
      setTitle(subtask.title)
    }
    setIsEditing(false)
  }

  const remove = () => {
    Alert.alert('Excluir subtarefa', `Excluir "${subtask.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try { await deleteSubTask(projectId, taskId, subtask.id) }
          catch { Alert.alert('Erro', 'Não foi possível excluir a subtarefa') }
        },
      },
    ])
  }

  if (isEditing) {
    return (
      <View style={styles.subtaskRow}>
        <Input
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={saveEdit}
          onBlur={saveEdit}
          autoFocus
          returnKeyType="done"
          style={{ marginBottom: 0, flex: 1 }}
        />
      </View>
    )
  }

  return (
    <View style={styles.subtaskRow}>
      <View style={{ flex: 1 }}>
        <Checkbox label={subtask.title} checked={subtask.status === 'DONE'} onToggle={toggle} />
      </View>
      <TouchableOpacity onPress={() => { setTitle(subtask.title); setIsEditing(true) }} style={styles.taskActionBtn}>
        <Text style={{ fontSize: FONT_SIZE.sm }}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={remove} style={styles.taskActionBtn}>
        <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.sm }}>🗑</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  kindTag: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  projName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 4 },
  projDesc: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm },
  projectActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xs },
  financeItem: { alignItems: 'center', flex: 1 },
  financeLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 2 },
  financeValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '800' },
  // Fase 4.4D — resumo financeiro do projeto, em chips (substitui financeRow/financeItem só no modal de detalhe)
  financeSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  financeChip: { flexBasis: '30%', flexGrow: 1, backgroundColor: COLORS.surfaceLight, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.sm, alignItems: 'center' },
  financeChipHighlightWarning: { backgroundColor: COLORS.warning + '15', borderColor: COLORS.warning + '44' },
  financeChipHighlightDanger: { backgroundColor: COLORS.danger + '15', borderColor: COLORS.danger + '44' },
  financeChipHighlightSuccess: { backgroundColor: COLORS.success + '15', borderColor: COLORS.success + '44' },
  financeChipLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 2 },
  financeChipValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '800' },
  // Fase 4.4D — histórico financeiro do projeto
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: SPACING.md },
  transactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  transactionDesc: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  transactionMeta: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  transactionAmount: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  installmentRow: { flexDirection: 'row', gap: SPACING.sm },
  taskItemWrapper: { marginBottom: 2 },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskActionBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  expandBtn: { width: 28, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  expandIcon: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  taskTitleText: { color: COLORS.text, fontSize: FONT_SIZE.md, paddingVertical: SPACING.sm },
  taskTitleDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  subtaskProgressWrap: { paddingLeft: 28, paddingRight: SPACING.sm, marginBottom: SPACING.xs },
  subtasksContainer: { paddingLeft: 28, marginBottom: SPACING.sm },
  subtaskRow: { flexDirection: 'row', alignItems: 'center' },
  addSubtaskRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  addSubtaskBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary + '44' },
  addSubtaskBtnText: { color: COLORS.primary, fontWeight: '700' },
  addTaskBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary + '44', borderRadius: 8, borderStyle: 'dashed' },
  paymentActionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  paymentActionBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: COLORS.success + '44', backgroundColor: COLORS.success + '15' },
  expenseActionBtn: { borderColor: COLORS.danger + '44', backgroundColor: COLORS.danger + '15' },
  paymentActionText: { color: COLORS.success, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  detailSection: { marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailSectionTitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  detailValue: { color: COLORS.text, fontSize: FONT_SIZE.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  timelineIcon: { fontSize: FONT_SIZE.md, width: 24 },
  timelineLabel: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  timelineDate: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
})