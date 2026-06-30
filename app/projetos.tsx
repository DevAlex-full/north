import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useProjectStore } from '../stores/project.store'
import { useLeadStore } from '../stores/lead.store'
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
import type { Project, ProjectTask, ProjectFinance, ProjectKind, ProjectClientStatus } from '../types/project.types'

/**
 * O Select de tipo de projeto só oferece 'PERSONAL' e 'CLIENT' (KIND_OPTIONS
 * abaixo), mas seu `onChange` é tipado como `(v: string) => void` — por
 * isso o state `kind` é `string`. Este guard converte esse valor para
 * `ProjectKind` de forma segura (sem `any`) no único ponto em que ele é
 * de fato enviado à API.
 */
function isProjectKind(value: string): value is ProjectKind {
  return value === 'PERSONAL' || value === 'CLIENT'
}

const CLIENT_STATUS_VALUES: ProjectClientStatus[] = [
  'LEAD', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'DEVELOPMENT', 'DELIVERED', 'SUPPORT', 'PAUSED_CLIENT', 'CANCELLED',
]

/** Mesmo raciocínio de isProjectKind, aplicado ao Select de status comercial. */
function isProjectClientStatus(value: string): value is ProjectClientStatus {
  return (CLIENT_STATUS_VALUES as string[]).includes(value)
}

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

export default function ProjetosScreen() {
  const router = useRouter()

  const {
    projects,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject: removeProjectFromStore,
    createTask: createTaskInStore,
    updateTask: updateTaskInStore,
    deleteTask: removeTaskFromStore,
    getFinance,
  } = useProjectStore()

  const { leads, fetchLeads } = useLeadStore()

  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTaskEditModal, setShowTaskEditModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [financeMap, setFinanceMap] = useState<Record<string, ProjectFinance>>({})

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('IN_PROGRESS')
  const [taskTitle, setTaskTitle] = useState('')

  // Campos comerciais (kind=CLIENT)
  const [kind, setKind] = useState('PERSONAL')
  const [clientId, setClientId] = useState('')
  const [clientStatus, setClientStatus] = useState('LEAD')
  const [agreedValue, setAgreedValue] = useState('')
  const [projNextAction, setProjNextAction] = useState('')
  const [projObservations, setProjObservations] = useState('')

  // Form da edição de tarefa
  const [taskEditTitle, setTaskEditTitle] = useState('')
  const [taskEditStatus, setTaskEditStatus] = useState('PENDING')
  const [taskEditPriority, setTaskEditPriority] = useState('2')

  const load = async () => {
    await Promise.all([fetchProjects(), fetchLeads()])

    const current = useProjectStore.getState().projects
    const clientProjects = current.filter((p) => p.kind === 'CLIENT')
    if (clientProjects.length > 0) {
      try {
        const results = await Promise.all(clientProjects.map((p) => getFinance(p.id)))
        const map: Record<string, ProjectFinance> = {}
        clientProjects.forEach((p, i) => { map[p.id] = results[i] })
        setFinanceMap(map)
      } catch {
        // Se a busca do financeiro falhar, os cards de cliente seguem exibindo
        // os valores em branco — não impede o resto da tela de funcionar.
      }
    }
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const clientOptions = leads.map((l) => ({
    label: l.company ? `${l.name} — ${l.company}` : l.name,
    value: l.id,
  }))

  const getClientName = (project: Project): string | null => {
    if (!project.clientId) return null
    const lead = leads.find((l) => l.id === project.clientId)
    return lead ? lead.name : null
  }

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

  const save = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Nome obrigatório'); return }
    if (kind === 'CLIENT' && !clientId) { Alert.alert('Atenção', 'Selecione um cliente'); return }
    setSaving(true)
    try {
      const safeKind: ProjectKind = isProjectKind(kind) ? kind : 'PERSONAL'
      const base = { name: name.trim(), description, status, kind: safeKind }
      const safeClientStatus: ProjectClientStatus = isProjectClientStatus(clientStatus) ? clientStatus : 'LEAD'
      const clientFields = kind === 'CLIENT'
        ? {
          clientId,
          clientStatus: safeClientStatus,
          agreedValue: agreedValue ? parseFloat(agreedValue.replace(',', '.')) : undefined,
          nextAction: projNextAction || undefined,
          observations: projObservations || undefined,
        }
        : {}

      if (editing) {
        // Se o projeto deixou de ser de cliente, desfaz explicitamente o vínculo comercial.
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
    try {
      await createTaskInStore(selectedProject.id, { title: taskTitle.trim(), status: 'PENDING', priority: 2 })
      setTaskTitle(''); setShowTaskModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível criar tarefa') }
    finally { setSaving(false) }
  }

  const toggleTask = async (project: Project, task: ProjectTask) => {
    const newStatus = task.status === 'DONE' ? 'PENDING' : 'DONE'
    try { await updateTaskInStore(project.id, task.id, { status: newStatus }); await load() } catch {}
  }

  const deleteProject = (p: Project) => {
    Alert.alert('Excluir', `Excluir "${p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await removeProjectFromStore(p.id); await load() } },
    ])
  }

  const openTaskEdit = (project: Project, task: ProjectTask) => {
    setSelectedProject(project)
    setEditingTask(task)
    setTaskEditTitle(task.title)
    setTaskEditStatus(task.status)
    setTaskEditPriority(String(task.priority ?? 2))
    setShowTaskEditModal(true)
  }

  const saveTaskEdit = async () => {
    if (!taskEditTitle.trim()) { Alert.alert('Atenção', 'Título obrigatório'); return }
    if (!selectedProject || !editingTask) return
    setSaving(true)
    try {
      await updateTaskInStore(selectedProject.id, editingTask.id, {
        title: taskEditTitle.trim(),
        status: taskEditStatus,
        priority: parseInt(taskEditPriority),
      })
      setShowTaskEditModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar a tarefa') }
    finally { setSaving(false) }
  }

  const deleteTask = (project: Project, task: ProjectTask) => {
    Alert.alert('Excluir tarefa', `Excluir "${task.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try { await removeTaskFromStore(project.id, task.id); await load() }
          catch { Alert.alert('Erro', 'Não foi possível excluir a tarefa') }
        },
      },
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
            const isExpanded = expanded === p.id
            const prog = getProgress(p.projectTasks)
            const isClient = p.kind === 'CLIENT'
            const finance = financeMap[p.id]
            const clientName = getClientName(p)

            return (
              <Card key={p.id} style={{ marginBottom: SPACING.sm }}>
                <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : p.id)} onLongPress={() => deleteProject(p)} activeOpacity={0.85}>
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
                        <TouchableOpacity onPress={() => openEdit(p)}>
                          <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteProject(p)}>
                          <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Excluir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {isClient ? (
                    <View style={styles.financeRow}>
                      <View style={styles.financeItem}>
                        <Text style={styles.financeLabel}>Combinado</Text>
                        <Text style={styles.financeValue}>{formatCurrency(p.agreedValue || 0)}</Text>
                      </View>
                      <View style={styles.financeItem}>
                        <Text style={styles.financeLabel}>Recebido</Text>
                        <Text style={[styles.financeValue, { color: COLORS.success }]}>{formatCurrency(finance?.received ?? 0)}</Text>
                      </View>
                      <View style={styles.financeItem}>
                        <Text style={styles.financeLabel}>Pendente</Text>
                        <Text style={[styles.financeValue, { color: COLORS.warning }]}>{formatCurrency(finance?.pending ?? 0)}</Text>
                      </View>
                      <View style={styles.financeItem}>
                        <Text style={styles.financeLabel}>Lucro</Text>
                        <Text style={[styles.financeValue, { color: (finance?.profit ?? 0) >= 0 ? COLORS.success : COLORS.danger }]}>
                          {formatCurrency(finance?.profit ?? 0)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <ProgressBar value={prog} total={100} label={`${p.projectTasks?.filter(t => t.status === 'DONE').length || 0}/${p.projectTasks?.length || 0} tarefas`} />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm }}>
                    {isClient && (
                      <ProgressBar value={prog} total={100} label={`Tarefas: ${p.projectTasks?.filter(t => t.status === 'DONE').length || 0}/${p.projectTasks?.length || 0}`} />
                    )}
                    {p.observations && isClient && (
                      <Text style={[styles.projDesc, { marginBottom: SPACING.sm }]}>📝 {p.observations}</Text>
                    )}
                    {(p.projectTasks || []).map((task) => (
                      <View key={task.id} style={styles.taskRow}>
                        <View style={{ flex: 1 }}>
                          <Checkbox label={task.title} checked={task.status === 'DONE'} onToggle={() => toggleTask(p, task)} />
                        </View>
                        <TouchableOpacity onPress={() => openTaskEdit(p, task)} style={styles.taskActionBtn}>
                          <Text style={{ fontSize: FONT_SIZE.md }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteTask(p, task)} style={styles.taskActionBtn}>
                          <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.md }}>🗑</Text>
                        </TouchableOpacity>
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

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar projeto' : 'Novo projeto'}>
        <Select label="Tipo de projeto" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do projeto" />
        <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Descreva o projeto..." multiline numberOfLines={3} />

        {kind === 'PERSONAL' && (
          <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        )}

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

      <Modal visible={showTaskModal} onClose={() => setShowTaskModal(false)} title={`+ Tarefa em ${selectedProject?.name}`}>
        <Input label="Tarefa *" value={taskTitle} onChangeText={setTaskTitle} placeholder="Ex: Criar tela de login" />
        <Button title={saving ? 'Adicionando...' : 'Adicionar tarefa'} onPress={addTask} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>

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
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xs, marginBottom: SPACING.xs },
  financeItem: { alignItems: 'center', flex: 1 },
  financeLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 2 },
  financeValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '800' },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskActionBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  addTaskBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary + '44', borderRadius: 8, borderStyle: 'dashed' },
})