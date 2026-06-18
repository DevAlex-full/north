import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { taskService } from '../../services/task.service'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { EmptyState } from '../../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'
import { getTodayString } from '../../utils/date'

const STATUS_OPTIONS = [
  { label: 'Pendente', value: 'PENDING' },
  { label: 'Em andamento', value: 'IN_PROGRESS' },
  { label: 'Concluída', value: 'DONE' },
  { label: 'Pulada', value: 'SKIPPED' },
]

const PRIORITY_OPTIONS = [
  { label: '🔴 Alta', value: '1' },
  { label: '🟡 Média', value: '2' },
  { label: '🟢 Baixa', value: '3' },
]

export default function AgendaScreen() {
  const [tasks, setTasks] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [priority, setPriority] = useState('2')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const d = await taskService.getAll(selectedDate)
      setTasks(d)
    } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, [selectedDate]))

  const openNew = () => {
    setEditing(null); setTitle(''); setDescription(''); setStatus('PENDING'); setPriority('2')
    setShowModal(true)
  }

  const openEdit = (task: any) => {
    setEditing(task); setTitle(task.title); setDescription(task.description || ''); setStatus(task.status); setPriority(String(task.priority))
    setShowModal(true)
  }

  const save = async () => {
    if (!title.trim()) { Alert.alert('Atenção', 'Título é obrigatório'); return }
    setSaving(true)
    try {
      const payload = { title: title.trim(), description: description.trim() || undefined, status, priority: parseInt(priority), date: selectedDate }
      if (editing) { await taskService.update(editing.id, payload) }
      else { await taskService.create(payload) }
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar a tarefa') }
    finally { setSaving(false) }
  }

  const toggleStatus = async (task: any) => {
    const next = task.status === 'DONE' ? 'PENDING' : 'DONE'
    try { await taskService.update(task.id, { status: next }); await load() } catch {}
  }

  const deleteTask = (task: any) => {
    Alert.alert('Excluir', `Excluir "${task.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await taskService.delete(task.id); await load() } }
    ])
  }

  // Gera datas da semana
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + i)
    return d.toISOString().split('T')[0]
  })

  const done = tasks.filter(t => t.status === 'DONE').length

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Agenda</Text>
        <Button title="+ Tarefa" onPress={openNew} size="sm" />
      </View>

      {/* Seletor de dias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll} contentContainerStyle={{ paddingHorizontal: SPACING.md }}>
        {weekDates.map(date => {
          const d = new Date(date + 'T12:00:00')
          const isSelected = date === selectedDate
          const isToday = date === getTodayString()
          return (
            <TouchableOpacity key={date} onPress={() => setSelectedDate(date)} style={[styles.dayBtn, isSelected && styles.dayBtnActive]}>
              <Text style={[styles.dayName, isSelected && { color: COLORS.primary }]}>
                {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </Text>
              <Text style={[styles.dayNum, isSelected && { color: COLORS.primary, fontWeight: '800' }]}>{d.getDate()}</Text>
              {isToday && <View style={styles.todayDot} />}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Progresso */}
      {tasks.length > 0 && (
        <View style={styles.progress}>
          <Text style={styles.progressText}>{done}/{tasks.length} concluídas</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }]} />
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {tasks.length === 0
          ? <EmptyState icon="📋" title="Nenhuma tarefa" subtitle="Toque em '+ Tarefa' para adicionar" onAction={openNew} actionLabel="Adicionar tarefa" />
          : tasks.map(task => (
            <TouchableOpacity key={task.id} onPress={() => openEdit(task)} activeOpacity={0.8}>
              <Card>
                <View style={styles.taskRow}>
                  <TouchableOpacity onPress={() => toggleStatus(task)} style={[styles.check, task.status === 'DONE' && styles.checkDone]}>
                    {task.status === 'DONE' && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, task.status === 'DONE' && styles.taskDone]}>{task.title}</Text>
                    {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                    <Badge status={task.status} />
                  </View>
                  <TouchableOpacity onPress={() => deleteTask(task)} style={styles.delBtn}>
                    <Text style={{ color: COLORS.danger }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      {/* Modal Criar/Editar */}
      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar tarefa' : 'Nova tarefa'}>
        <Input label="Título *" value={title} onChangeText={setTitle} placeholder="Ex: Enviar proposta Workana" />
        <Input label="Observação" value={description} onChangeText={setDescription} placeholder="Detalhe opcional..." multiline numberOfLines={3} />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Select label="Prioridade" value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} />
        <Button title={saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar tarefa'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.md }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  weekScroll: { maxHeight: 80 },
  dayBtn: { alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginRight: SPACING.xs, borderRadius: RADIUS.md, minWidth: 52 },
  dayBtnActive: { backgroundColor: COLORS.primary + '22', borderWidth: 1, borderColor: COLORS.primary + '66' },
  dayName: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '600', textTransform: 'uppercase' },
  dayNum: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700', marginTop: 2 },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 2 },
  progress: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  progressText: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 6 },
  progressBar: { height: 6, backgroundColor: COLORS.surfaceLight, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  check: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  taskTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600', marginBottom: 4 },
  taskDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  taskDesc: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 6 },
  delBtn: { padding: SPACING.xs },
})
