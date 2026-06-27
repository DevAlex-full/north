import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { jobService } from '../services/job.service'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme'
import { formatDateShort } from '../utils/date'

const STATUS_OPTIONS = [
  { label: '🔍 Encontrada', value: 'FOUND' },
  { label: '📤 Aplicado', value: 'APPLIED' },
  { label: '📞 Entrevista', value: 'INTERVIEW' },
  { label: '💻 Teste técnico', value: 'TECHNICAL_TEST' },
  { label: '✅ Aprovado', value: 'APPROVED' },
  { label: '❌ Recusado', value: 'REJECTED' },
]

export default function EmpregosScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [jobLink, setJobLink] = useState('')
  const [status, setStatus] = useState('FOUND')
  const [observations, setObservations] = useState('')

  const load = async () => {
    try { setJobs(await jobService.getAll()) } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const openNew = () => { setEditing(null); setCompany(''); setPosition(''); setJobLink(''); setStatus('FOUND'); setObservations(''); setShowModal(true) }
  const openEdit = (j: any) => { setEditing(j); setCompany(j.company); setPosition(j.position); setJobLink(j.jobLink || ''); setStatus(j.status); setObservations(j.observations || ''); setShowModal(true) }

  const save = async () => {
    if (!company.trim() || !position.trim()) { Alert.alert('Atenção', 'Empresa e cargo são obrigatórios'); return }
    setSaving(true)
    try {
      const payload = { company: company.trim(), position: position.trim(), jobLink: jobLink || undefined, status, observations: observations || undefined }
      if (editing) await jobService.update(editing.id, payload)
      else await jobService.create(payload)
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>👔 Empregos</Text>
        <Button title="+ Vaga" onPress={openNew} size="sm" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {jobs.length === 0
          ? <EmptyState icon="👔" title="Nenhuma vaga" subtitle="Registre as vagas que você está acompanhando" onAction={openNew} actionLabel="Adicionar vaga" />
          : jobs.map(j => (
            <TouchableOpacity key={j.id} onPress={() => openEdit(j)} activeOpacity={0.85}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.position}>{j.position}</Text>
                    <Text style={styles.company}>🏢 {j.company}</Text>
                    {j.observations && <Text style={styles.obs}>{j.observations}</Text>}
                    {j.appliedAt && <Text style={styles.obs}>📅 {formatDateShort(j.appliedAt)}</Text>}
                  </View>
                  <Badge status={j.status} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar vaga' : 'Nova vaga'}>
        <Input label="Empresa *" value={company} onChangeText={setCompany} placeholder="Nome da empresa" />
        <Input label="Cargo *" value={position} onChangeText={setPosition} placeholder="Ex: Desenvolvedor React Native" />
        <Input label="Link da vaga" value={jobLink} onChangeText={setJobLink} placeholder="https://..." />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
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
  position: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 4 },
  company: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginBottom: 4 },
  obs: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
})