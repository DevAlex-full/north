import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { leadService } from '../../services/lead.service'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'
import { formatCurrency } from '../../utils/format'

const STATUS_OPTIONS = [
  { label: '🆕 Novo', value: 'NEW' },
  { label: '📞 Contato feito', value: 'CONTACTED' },
  { label: '💬 Respondeu', value: 'REPLIED' },
  { label: '📄 Proposta enviada', value: 'PROPOSAL_SENT' },
  { label: '🤝 Negociação', value: 'NEGOTIATION' },
  { label: '✅ Fechado', value: 'CLOSED' },
  { label: '❌ Perdido', value: 'LOST' },
]

const ORIGIN_OPTIONS = [
  { label: 'Workana', value: 'workana' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Indicação', value: 'indicacao' },
  { label: 'Outro', value: 'outro' },
]

const ALL_STATUS = [{ label: 'Todos', value: '' }, ...STATUS_OPTIONS]

export default function LeadsScreen() {
  const [leads, setLeads] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [niche, setNiche] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [origin, setOrigin] = useState('')
  const [serviceInterest, setServiceInterest] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [status, setStatus] = useState('NEW')
  const [nextAction, setNextAction] = useState('')
  const [observations, setObservations] = useState('')

  const load = async () => {
    try { setLeads(await leadService.getAll(filterStatus || undefined)) } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, [filterStatus]))

  const openNew = () => {
    setEditing(null)
    setName(''); setCompany(''); setNiche(''); setPhone(''); setInstagram('')
    setOrigin(''); setServiceInterest(''); setEstimatedValue(''); setStatus('NEW')
    setNextAction(''); setObservations('')
    setShowModal(true)
  }

  const openEdit = (lead: any) => {
    setEditing(lead)
    setName(lead.name || ''); setCompany(lead.company || ''); setNiche(lead.niche || '')
    setPhone(lead.phone || ''); setInstagram(lead.instagram || ''); setOrigin(lead.origin || '')
    setServiceInterest(lead.serviceInterest || ''); setEstimatedValue(lead.estimatedValue ? String(lead.estimatedValue) : '')
    setStatus(lead.status || 'NEW'); setNextAction(lead.nextAction || ''); setObservations(lead.observations || '')
    setShowModal(true)
  }

  const save = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Nome é obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(), company: company || undefined, niche: niche || undefined,
        phone: phone || undefined, instagram: instagram || undefined, origin: origin || undefined,
        serviceInterest: serviceInterest || undefined,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue.replace(',', '.')) : undefined,
        status, nextAction: nextAction || undefined, observations: observations || undefined,
      }
      if (editing) await leadService.update(editing.id, payload)
      else await leadService.create(payload)
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  const deleteLead = (lead: any) => {
    Alert.alert('Excluir', `Excluir lead "${lead.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await leadService.delete(lead.id); await load() } },
    ])
  }

  const quickStatus = async (lead: any, newStatus: string) => {
    try { await leadService.update(lead.id, { status: newStatus }); await load() } catch {}
  }

  const grouped = STATUS_OPTIONS.reduce((acc, s) => {
    const group = leads.filter(l => l.status === s.value)
    if (group.length > 0) acc[s.value] = group
    return acc
  }, {} as Record<string, any[]>)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🎯 CRM de Leads</Text>
          <Text style={styles.subtitle}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</Text>
        </View>
        <Button title="+ Lead" onPress={openNew} size="sm" />
      </View>

      {/* Filtro de status */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.sm }}>
        {ALL_STATUS.map(s => (
          <TouchableOpacity key={s.value} onPress={() => setFilterStatus(s.value)}
            style={[styles.filterBtn, filterStatus === s.value && styles.filterActive]}>
            <Text style={[styles.filterText, filterStatus === s.value && { color: COLORS.primary }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {leads.length === 0
          ? <EmptyState icon="🎯" title="Nenhum lead cadastrado" subtitle="Registre seus potenciais clientes" onAction={openNew} actionLabel="Adicionar lead" />
          : leads.map(lead => (
            <TouchableOpacity key={lead.id} onPress={() => openEdit(lead)} onLongPress={() => deleteLead(lead)} activeOpacity={0.85}>
              <Card>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leadName}>{lead.name}</Text>
                    {lead.company && <Text style={styles.leadCompany}>🏢 {lead.company}</Text>}
                    {lead.niche && <Text style={styles.leadInfo}>📌 {lead.niche}</Text>}
                    {lead.serviceInterest && <Text style={styles.leadInfo}>💼 {lead.serviceInterest}</Text>}
                    {lead.estimatedValue && <Text style={[styles.leadInfo, { color: COLORS.success }]}>💰 {formatCurrency(lead.estimatedValue)}</Text>}
                    {lead.nextAction && <Text style={[styles.leadInfo, { color: COLORS.warning }]}>⚡ {lead.nextAction}</Text>}
                  </View>
                  <Badge status={lead.status} />
                </View>
                {/* Ações rápidas de status */}
                {lead.status !== 'CLOSED' && lead.status !== 'LOST' && (
                  <View style={styles.quickActions}>
                    {lead.status === 'NEW' && <TouchableOpacity style={styles.quickBtn} onPress={() => quickStatus(lead, 'CONTACTED')}><Text style={styles.quickText}>📞 Contatei</Text></TouchableOpacity>}
                    {lead.status === 'CONTACTED' && <TouchableOpacity style={styles.quickBtn} onPress={() => quickStatus(lead, 'REPLIED')}><Text style={styles.quickText}>💬 Respondeu</Text></TouchableOpacity>}
                    {lead.status === 'REPLIED' && <TouchableOpacity style={styles.quickBtn} onPress={() => quickStatus(lead, 'PROPOSAL_SENT')}><Text style={styles.quickText}>📄 Proposta enviada</Text></TouchableOpacity>}
                    {lead.status === 'PROPOSAL_SENT' && <TouchableOpacity style={styles.quickBtn} onPress={() => quickStatus(lead, 'NEGOTIATION')}><Text style={styles.quickText}>🤝 Em negociação</Text></TouchableOpacity>}
                    {lead.status === 'NEGOTIATION' && (
                      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.success + '22' }]} onPress={() => quickStatus(lead, 'CLOSED')}><Text style={[styles.quickText, { color: COLORS.success }]}>✅ Fechei!</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.danger + '22' }]} onPress={() => quickStatus(lead, 'LOST')}><Text style={[styles.quickText, { color: COLORS.danger }]}>❌ Perdi</Text></TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Lead' : 'Novo Lead'}>
        <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do lead" />
        <Input label="Empresa" value={company} onChangeText={setCompany} placeholder="Empresa (opcional)" />
        <Input label="Nicho" value={niche} onChangeText={setNiche} placeholder="Ex: Barbearia, Clínica..." />
        <Input label="Telefone" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
        <Input label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="@usuario" />
        <Select label="Origem" value={origin} options={ORIGIN_OPTIONS} onChange={setOrigin} placeholder="De onde veio?" />
        <Input label="Serviço de interesse" value={serviceInterest} onChangeText={setServiceInterest} placeholder="Ex: Site, App, Sistema..." />
        <Input label="Valor estimado (R$)" value={estimatedValue} onChangeText={setEstimatedValue} placeholder="0,00" keyboardType="decimal-pad" />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Input label="Próxima ação" value={nextAction} onChangeText={setNextAction} placeholder="Ex: Ligar na sexta..." />
        <Input label="Observações" value={observations} onChangeText={setObservations} placeholder="Notas sobre o lead..." multiline numberOfLines={3} />
        <Button title={saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar lead'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  subtitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  filterBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  filterText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  leadName: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 4 },
  leadCompany: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginBottom: 2 },
  leadInfo: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 2 },
  quickActions: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  quickBtn: { alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.primary + '22', borderWidth: 1, borderColor: COLORS.primary + '44' },
  quickText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
})
