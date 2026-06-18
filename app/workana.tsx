import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { workanaService } from '../services/workana.service'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme'
import { formatCurrency } from '../utils/format'

const STATUS_OPTIONS = [
  { label: '🔍 Encontrado', value: 'FOUND' },
  { label: '📤 Proposta enviada', value: 'SENT' },
  { label: '👁 Visualizado', value: 'VIEWED' },
  { label: '💬 Respondido', value: 'REPLIED' },
  { label: '✅ Fechado', value: 'CLOSED' },
  { label: '❌ Perdido', value: 'LOST' },
]

export default function WorkanaScreen() {
  const router = useRouter()
  const [proposals, setProposals] = useState<any[]>([])
  const [weekCount, setWeekCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [projectName, setProjectName] = useState('')
  const [client, setClient] = useState('')
  const [proposedValue, setProposedValue] = useState('')
  const [status, setStatus] = useState('FOUND')
  const [projectLink, setProjectLink] = useState('')
  const [observations, setObservations] = useState('')

  const load = async () => {
    try {
      const [p, w] = await Promise.all([workanaService.getAll(), workanaService.getWeekCount()])
      setProposals(p); setWeekCount(w.count)
    } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const openNew = () => {
    setEditing(null); setProjectName(''); setClient(''); setProposedValue(''); setStatus('FOUND'); setProjectLink(''); setObservations('')
    setShowModal(true)
  }

  const openEdit = (p: any) => {
    setEditing(p); setProjectName(p.projectName || ''); setClient(p.client || ''); setProposedValue(p.proposedValue ? String(p.proposedValue) : '')
    setStatus(p.status || 'FOUND'); setProjectLink(p.projectLink || ''); setObservations(p.observations || '')
    setShowModal(true)
  }

  const save = async () => {
    if (!projectName.trim()) { Alert.alert('Atenção', 'Nome do projeto é obrigatório'); return }
    setSaving(true)
    try {
      const payload = { projectName: projectName.trim(), client: client || undefined, proposedValue: proposedValue ? parseFloat(proposedValue.replace(',', '.')) : undefined, status, projectLink: projectLink || undefined, observations: observations || undefined }
      if (editing) await workanaService.update(editing.id, payload)
      else await workanaService.create(payload)
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  const deleteProposal = (p: any) => {
    Alert.alert('Excluir', `Excluir "${p.projectName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await workanaService.delete(p.id); await load() } },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>💼 Workana</Text>
        <Button title="+ Proposta" onPress={openNew} size="sm" />
      </View>

      {/* Meta semanal */}
      <Card style={{ marginHorizontal: SPACING.md, borderColor: weekCount >= 2 ? COLORS.success + '55' : COLORS.border }}>
        <Text style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>Meta semanal</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm }}>
          <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.xxl, fontWeight: '900' }}>{weekCount}<Text style={{ fontSize: FONT_SIZE.lg, color: COLORS.textMuted }}>/2</Text></Text>
          <Badge status={weekCount >= 2 ? 'COMPLETED' : 'PENDING'} label={weekCount >= 2 ? '✅ Meta batida!' : 'Em andamento'} />
        </View>
        <View style={{ height: 6, backgroundColor: COLORS.surfaceLight, borderRadius: 3, marginTop: SPACING.sm, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.min(100, (weekCount / 2) * 100)}%`, backgroundColor: weekCount >= 2 ? COLORS.success : COLORS.primary, borderRadius: 3 }} />
        </View>
      </Card>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {proposals.length === 0
          ? <EmptyState icon="💼" title="Nenhuma proposta" subtitle="Registre suas propostas do Workana" onAction={openNew} actionLabel="Adicionar proposta" />
          : proposals.map(p => (
            <TouchableOpacity key={p.id} onPress={() => openEdit(p)} onLongPress={() => deleteProposal(p)} activeOpacity={0.85}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projName}>{p.projectName}</Text>
                    {p.client && <Text style={styles.projInfo}>👤 {p.client}</Text>}
                    {p.proposedValue && <Text style={[styles.projInfo, { color: COLORS.success }]}>💰 {formatCurrency(p.proposedValue)}</Text>}
                    {p.observations && <Text style={styles.projInfo}>📝 {p.observations}</Text>}
                  </View>
                  <Badge status={p.status} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar proposta' : 'Nova proposta'}>
        <Input label="Nome do projeto *" value={projectName} onChangeText={setProjectName} placeholder="Ex: Sistema de agendamento" />
        <Input label="Cliente" value={client} onChangeText={setClient} placeholder="Nome do cliente" />
        <Input label="Valor proposto (R$)" value={proposedValue} onChangeText={setProposedValue} placeholder="0,00" keyboardType="decimal-pad" />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Input label="Link do projeto" value={projectLink} onChangeText={setProjectLink} placeholder="https://workana.com/..." />
        <Input label="Observações" value={observations} onChangeText={setObservations} placeholder="Notas..." multiline numberOfLines={3} />
        <Button title={saving ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  projName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 4 },
  projInfo: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 },
})
