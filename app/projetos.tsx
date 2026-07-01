import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useProjectStore } from '../stores/project.store'
import { useLeadStore } from '../stores/lead.store'
import { useProjectsFinance } from '../hooks/useProjectsFinance'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Checkbox } from '../components/ui/Checkbox'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme'
import { formatCurrency, getProjectKindLabel } from '../utils/format'
import { formatDateShort } from '../utils/date'
import { buildProjectTimeline } from '../utils/commercial'
import type { Project, ProjectTask, ProjectKind, ProjectClientStatus } from '../types/project.types'

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

export default function ProjetosScreen() {
  const router = useRouter()
  const { projects, fetchProjects, createProject, updateProject, deleteProject: removeProject, createTask, updateTask, deleteTask } = useProjectStore()
  const { leads, fetchLeads } = useLeadStore()

  const clientProjects = projects.filter((p) => p.kind === 'CLIENT')
  const { financeByProjectId, reload: reloadFinance } = useProjectsFinance(clientProjects.map((p) => p.id))

  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTaskEditModal, setShowTaskEditModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [detailProject, setDetailProject] = useState<Project | null>(null)
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

  const openDetail = (p: Project) => { setDetailProject(p); setShowDetailModal(true) }

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
    return Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100)
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
                    <ProgressBar value={prog} total={100} label={`${p.projectTasks?.filter(t => t.status === 'DONE').length || 0}/${p.projectTasks?.length || 0} tarefas`} />
                  )}
                </TouchableOpacity>

                {/* Tarefas — projetos pessoais exibem inline; clientes abrem no modal de detalhe */}
                {!isClient && isExpanded && (
                  <View style={{ marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm }}>
                    {(p.projectTasks || []).map(task => (
                      <View key={task.id} style={styles.taskRow}>
                        <View style={{ flex: 1 }}><Checkbox label={task.title} checked={task.status === 'DONE'} onToggle={() => toggleTask(p, task)} /></View>
                        <TouchableOpacity onPress={() => openTaskEdit(p, task)} style={styles.taskActionBtn}><Text style={{ fontSize: FONT_SIZE.md }}>✏️</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteTaskAlert(p, task)} style={styles.taskActionBtn}><Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.md }}>🗑</Text></TouchableOpacity>
                      </View>
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
            {financeByProjectId[detailProject.id] && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>💰 Financeiro do Projeto</Text>
                <View style={styles.financeRow}>
                  <View style={styles.financeItem}><Text style={styles.financeLabel}>Combinado</Text><Text style={styles.financeValue}>{formatCurrency(detailProject.agreedValue || 0)}</Text></View>
                  <View style={styles.financeItem}><Text style={styles.financeLabel}>Recebido</Text><Text style={[styles.financeValue, { color: COLORS.success }]}>{formatCurrency(financeByProjectId[detailProject.id].received)}</Text></View>
                  <View style={styles.financeItem}><Text style={styles.financeLabel}>Pendente</Text><Text style={[styles.financeValue, { color: COLORS.warning }]}>{formatCurrency(financeByProjectId[detailProject.id].pending)}</Text></View>
                  <View style={styles.financeItem}><Text style={styles.financeLabel}>Lucro</Text><Text style={[styles.financeValue, { color: financeByProjectId[detailProject.id].profit >= 0 ? COLORS.success : COLORS.danger }]}>{formatCurrency(financeByProjectId[detailProject.id].profit)}</Text></View>
                </View>
              </View>
            )}

            {/* Tarefas */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>✅ Tarefas</Text>
              {(detailProject.projectTasks || []).map(task => (
                <View key={task.id} style={styles.taskRow}>
                  <View style={{ flex: 1 }}><Checkbox label={task.title} checked={task.status === 'DONE'} onToggle={() => toggleTask(detailProject, task)} /></View>
                  <TouchableOpacity onPress={() => { setShowDetailModal(false); openTaskEdit(detailProject, task) }} style={styles.taskActionBtn}><Text style={{ fontSize: FONT_SIZE.md }}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTaskAlert(detailProject, task)} style={styles.taskActionBtn}><Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.md }}>🗑</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addTaskBtn} onPress={() => { setShowDetailModal(false); setSelectedProject(detailProject); setTaskTitle(''); setShowTaskModal(true) }}>
                <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>+ Adicionar tarefa</Text>
              </TouchableOpacity>
            </View>

            {/* Linha do Tempo */}
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
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskActionBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  addTaskBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary + '44', borderRadius: 8, borderStyle: 'dashed' },
  detailSection: { marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailSectionTitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  detailValue: { color: COLORS.text, fontSize: FONT_SIZE.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  timelineIcon: { fontSize: FONT_SIZE.md, width: 24 },
  timelineLabel: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  timelineDate: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
})