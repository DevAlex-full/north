import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { projectService } from '../services/project.service'
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

const STATUS_OPTIONS = [
  { label: '💡 Ideia', value: 'IDEA' },
  { label: '🚀 Em andamento', value: 'IN_PROGRESS' },
  { label: '⏸ Pausado', value: 'PAUSED' },
  { label: '✅ Concluído', value: 'DONE' },
]

export default function ProjetosScreen() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('IN_PROGRESS')
  const [taskTitle, setTaskTitle] = useState('')

  const load = async () => {
    try { setProjects(await projectService.getAll()) } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const openNew = () => { setEditing(null); setName(''); setDescription(''); setStatus('IN_PROGRESS'); setShowModal(true) }
  const openEdit = (p: any) => { setEditing(p); setName(p.name); setDescription(p.description || ''); setStatus(p.status); setShowModal(true) }

  const save = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Nome obrigatório'); return }
    setSaving(true)
    try {
      if (editing) await projectService.update(editing.id, { name: name.trim(), description, status })
      else await projectService.create({ name: name.trim(), description, status, priority: 2 })
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  const addTask = async () => {
    if (!taskTitle.trim() || !selectedProject) return
    setSaving(true)
    try {
      await projectService.createTask(selectedProject.id, { title: taskTitle.trim(), status: 'PENDING', priority: 2 })
      setTaskTitle(''); setShowTaskModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível criar tarefa') }
    finally { setSaving(false) }
  }

  const toggleTask = async (project: any, task: any) => {
    const newStatus = task.status === 'DONE' ? 'PENDING' : 'DONE'
    try { await projectService.updateTask(project.id, task.id, { status: newStatus }); await load() } catch {}
  }

  const deleteProject = (p: any) => {
    Alert.alert('Excluir', `Excluir "${p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await projectService.delete(p.id); await load() } },
    ])
  }

  const getProgress = (tasks: any[]) => {
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
            return (
              <Card key={p.id} style={{ marginBottom: SPACING.sm }}>
                <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : p.id)} onLongPress={() => deleteProject(p)} activeOpacity={0.85}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.projName}>{p.name}</Text>
                      {p.description && <Text style={styles.projDesc}>{p.description}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge status={p.status} />
                      <TouchableOpacity onPress={() => openEdit(p)}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.xs }}>Editar</Text></TouchableOpacity>
                    </View>
                  </View>
                  <ProgressBar value={prog} total={100} label={`${p.projectTasks?.filter((t: any) => t.status === 'DONE').length || 0}/${p.projectTasks?.length || 0} tarefas`} />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm }}>
                    {(p.projectTasks || []).map((task: any) => (
                      <Checkbox key={task.id} label={task.title} checked={task.status === 'DONE'} onToggle={() => toggleTask(p, task)} />
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
        <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do projeto" />
        <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Descreva o projeto..." multiline numberOfLines={3} />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Button title={saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>

      <Modal visible={showTaskModal} onClose={() => setShowTaskModal(false)} title={`+ Tarefa em ${selectedProject?.name}`}>
        <Input label="Tarefa *" value={taskTitle} onChangeText={setTaskTitle} placeholder="Ex: Criar tela de login" />
        <Button title={saving ? 'Adicionando...' : 'Adicionar tarefa'} onPress={addTask} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  projName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 4 },
  projDesc: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm },
  addTaskBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary + '44', borderRadius: 8, borderStyle: 'dashed' },
})
