import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../../stores/lead.store'
import { useProjectStore } from '../../stores/project.store'
import { projectService } from '../../services/project.service'
import { useProjectsFinance } from '../../hooks/useProjectsFinance'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'
import { formatCurrency } from '../../utils/format'
import { formatDateShort } from '../../utils/date'
import { getClientMetrics } from '../../utils/commercial'
import type { Lead } from '../../types/lead.types'
import type { Project } from '../../types/project.types'

const STATUS_OPTIONS = [
  { label: '🆕 Novo', value: 'NEW' },
  { label: '📞 Contato feito', value: 'CONTACTED' },
  { label: '💬 Respondeu', value: 'REPLIED' },
  { label: '📄 Proposta enviada', value: 'PROPOSAL_SENT' },
  { label: '🤝 Negociação', value: 'NEGOTIATION' },
  { label: '✅ Fechado', value: 'CLOSED' },
  { label: '❌ Perdido', value: 'LOST' },
  { label: '⭐ Cliente ativo', value: 'ACTIVE_CLIENT' },
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
  const router = useRouter()
  const { leads, fetchLeads, createLead, updateLead, deleteLead } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()

  const [filterStatus, setFilterStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [clientProjectsMap, setClientProjectsMap] = useState<Record<string, Project[]>>({})

  // Financeiro dos projetos de cliente já carregados pela store
  const clientProjects = projects.filter((p) => p.kind === 'CLIENT')
  const { financeByProjectId } = useProjectsFinance(clientProjects.map((p) => p.id))

  // Form
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [niche, setNiche] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [website, setWebsite] = useState('')
  const [instagram, setInstagram] = useState('')
  const [origin, setOrigin] = useState('')
  const [serviceInterest, setServiceInterest] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [status, setStatus] = useState('NEW')
  const [nextAction, setNextAction] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [observations, setObservations] = useState('')

  const load = async () => {
    await Promise.all([fetchLeads(filterStatus || undefined), fetchProjects('CLIENT')])
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, [filterStatus]))

  const openNew = () => {
    setEditing(null)
    setName(''); setCompany(''); setNiche(''); setPhone(''); setEmail(''); setWhatsapp(''); setWebsite('')
    setInstagram(''); setOrigin(''); setServiceInterest(''); setEstimatedValue(''); setStatus('NEW')
    setNextAction(''); setFollowUpAt(''); setObservations('')
    setShowModal(true)
  }

  const openEdit = (lead: Lead) => {
    setEditing(lead)
    setName(lead.name); setCompany(lead.company || ''); setNiche(lead.niche || '')
    setPhone(lead.phone || ''); setEmail(lead.email || ''); setWhatsapp(lead.whatsapp || ''); setWebsite(lead.website || '')
    setInstagram(lead.instagram || ''); setOrigin(lead.origin || '')
    setServiceInterest(lead.serviceInterest || '')
    setEstimatedValue(lead.estimatedValue != null ? String(lead.estimatedValue) : '')
    setStatus(lead.status); setNextAction(lead.nextAction || '')
    setFollowUpAt(lead.followUpAt ? lead.followUpAt.split('T')[0] : '')
    setObservations(lead.observations || '')
    setShowModal(true)
  }

  const save = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'Nome é obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(), company: company || undefined, niche: niche || undefined,
        phone: phone || undefined, email: email || undefined, whatsapp: whatsapp || undefined,
        website: website || undefined, instagram: instagram || undefined, origin: origin || undefined,
        serviceInterest: serviceInterest || undefined,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue.replace(',', '.')) : undefined,
        status, nextAction: nextAction || undefined,
        followUpAt: followUpAt || undefined,
        observations: observations || undefined,
      }
      if (editing) await updateLead(editing.id, payload)
      else await createLead(payload)
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  const removeLead = (lead: Lead) => {
    Alert.alert('Excluir', `Excluir lead "${lead.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteLead(lead.id); await load() } },
    ])
  }

  const quickStatus = async (lead: Lead, newStatus: string) => {
    try { await updateLead(lead.id, { status: newStatus }); await load() } catch {}
  }

  const promoteToClient = (lead: Lead) => {
    Alert.alert('Promover a cliente', `Marcar "${lead.name}" como cliente ativo?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => quickStatus(lead, 'ACTIVE_CLIENT') },
    ])
  }

  const toggleExpand = async (lead: Lead) => {
    const next = expanded === lead.id ? null : lead.id
    setExpanded(next)
    if (next && !clientProjectsMap[lead.id]) {
      try {
        const linked = await projectService.getByClient(lead.id)
        setClientProjectsMap((prev) => ({ ...prev, [lead.id]: linked }))
      } catch {
        setClientProjectsMap((prev) => ({ ...prev, [lead.id]: [] }))
      }
    }
  }

  const getLinkedProjects = (lead: Lead): Project[] =>
    clientProjectsMap[lead.id] ?? clientProjects.filter((p) => p.clientId === lead.id)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🎯 CRM de Leads</Text>
          <Text style={styles.subtitle}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</Text>
        </View>
        <Button title="+ Lead" onPress={openNew} size="sm" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.sm }}>
        {ALL_STATUS.map(s => (
          <TouchableOpacity key={s.value} onPress={() => setFilterStatus(s.value)} style={[styles.filterBtn, filterStatus === s.value && styles.filterActive]}>
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
          : leads.map(lead => {
            const isActiveClient = lead.status === 'ACTIVE_CLIENT'
            const isExpanded = expanded === lead.id
            const linkedProjects = isExpanded ? getLinkedProjects(lead) : []
            const clientMetrics = isActiveClient && isExpanded
              ? getClientMetrics(linkedProjects, financeByProjectId)
              : null

            return (
              <TouchableOpacity key={lead.id} onPress={() => toggleExpand(lead)} onLongPress={() => removeLead(lead)} activeOpacity={0.85}>
                <Card style={isActiveClient ? { borderColor: COLORS.success + '55' } : undefined}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leadName}>{isActiveClient ? '⭐ ' : ''}{lead.name}</Text>
                      {lead.company && <Text style={styles.leadCompany}>🏢 {lead.company}</Text>}
                      {lead.niche && <Text style={styles.leadInfo}>📌 {lead.niche}</Text>}
                      {lead.serviceInterest && <Text style={styles.leadInfo}>💼 {lead.serviceInterest}</Text>}
                      {lead.email && <Text style={styles.leadInfo}>✉️ {lead.email}</Text>}
                      {lead.whatsapp && <Text style={styles.leadInfo}>📱 {lead.whatsapp}</Text>}
                      {lead.website && <Text style={styles.leadInfo}>🌐 {lead.website}</Text>}
                      {lead.estimatedValue != null && <Text style={[styles.leadInfo, { color: COLORS.success }]}>💰 {formatCurrency(lead.estimatedValue)}</Text>}
                      {lead.nextAction && <Text style={[styles.leadInfo, { color: COLORS.warning }]}>⚡ {lead.nextAction}</Text>}
                      {lead.followUpAt && <Text style={styles.leadInfo}>📅 Próximo contato: {formatDateShort(lead.followUpAt)}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge status={lead.status} />
                      <TouchableOpacity onPress={() => openEdit(lead)}>
                        <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' }}>Editar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Ações rápidas de funil */}
                  {lead.status !== 'CLOSED' && lead.status !== 'LOST' && lead.status !== 'ACTIVE_CLIENT' && (
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

                  {lead.status === 'CLOSED' && (
                    <View style={styles.quickActions}>
                      <TouchableOpacity style={[styles.quickBtn, { backgroundColor: COLORS.success + '22' }]} onPress={() => promoteToClient(lead)}>
                        <Text style={[styles.quickText, { color: COLORS.success }]}>⭐ Promover a cliente ativo</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Seção expandida — Cliente Ativo (Fase 4.2D) */}
                  {isExpanded && isActiveClient && clientMetrics && (
                    <View style={styles.clientSection}>
                      <Text style={styles.clientSectionTitle}>📊 Visão do Cliente</Text>

                      <View style={styles.clientMetricsRow}>
                        <View style={styles.clientMetricItem}>
                          <Text style={[styles.clientMetricValue, { color: COLORS.primary }]}>{clientMetrics.activeProjects}</Text>
                          <Text style={styles.clientMetricLabel}>Projetos ativos</Text>
                        </View>
                        <View style={styles.clientMetricItem}>
                          <Text style={[styles.clientMetricValue, { color: COLORS.success }]}>{clientMetrics.completedProjects}</Text>
                          <Text style={styles.clientMetricLabel}>Concluídos</Text>
                        </View>
                        <View style={styles.clientMetricItem}>
                          <Text style={[styles.clientMetricValue, { color: COLORS.success }]}>{formatCurrency(clientMetrics.totalReceived)}</Text>
                          <Text style={styles.clientMetricLabel}>Receita gerada</Text>
                        </View>
                        <View style={styles.clientMetricItem}>
                          <Text style={[styles.clientMetricValue, { color: COLORS.warning }]}>{formatCurrency(clientMetrics.totalPending)}</Text>
                          <Text style={styles.clientMetricLabel}>Em aberto</Text>
                        </View>
                      </View>

                      {lead.followUpAt && (
                        <Text style={styles.clientInfoLine}>📅 Próximo contato: {formatDateShort(lead.followUpAt)}</Text>
                      )}
                      {lead.lastContactAt && (
                        <Text style={styles.clientInfoLine}>🕐 Última interação: {formatDateShort(lead.lastContactAt)}</Text>
                      )}

                      {linkedProjects.length > 0 && (
                        <>
                          <Text style={[styles.clientSectionTitle, { marginTop: SPACING.sm }]}>🏗️ Projetos</Text>
                          {linkedProjects.map((p) => (
                            <View key={p.id} style={styles.linkedProjectRow}>
                              <Text style={styles.linkedProjectName}>{p.name}</Text>
                              <Badge status={p.clientStatus || 'LEAD'} />
                            </View>
                          ))}
                        </>
                      )}

                      <TouchableOpacity onPress={() => router.push('/projetos')}>
                        <Text style={styles.linkedManageText}>Gerenciar em Projetos →</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Seção expandida — Lead normal (projetos vinculados) */}
                  {isExpanded && !isActiveClient && (
                    <View style={styles.linkedSection}>
                      <Text style={styles.linkedSectionTitle}>🏗️ Projetos vinculados</Text>
                      {linkedProjects.length === 0
                        ? <Text style={styles.linkedEmpty}>Nenhum projeto vinculado.</Text>
                        : linkedProjects.map((p) => (
                          <View key={p.id} style={styles.linkedProjectRow}>
                            <Text style={styles.linkedProjectName}>{p.name}</Text>
                            <Badge status={p.clientStatus || 'LEAD'} />
                          </View>
                        ))
                      }
                      <TouchableOpacity onPress={() => router.push('/projetos')}>
                        <Text style={styles.linkedManageText}>Gerenciar em Projetos →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            )
          })
        }
      </ScrollView>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Lead' : 'Novo Lead'}>
        <Input label="Nome *" value={name} onChangeText={setName} placeholder="Nome do lead" />
        <Input label="Empresa" value={company} onChangeText={setCompany} placeholder="Empresa (opcional)" />
        <Input label="Nicho" value={niche} onChangeText={setNiche} placeholder="Ex: Barbearia, Clínica..." />
        <Input label="Telefone" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
        <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} placeholder="(11) 99999-9999" keyboardType="phone-pad" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="cliente@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Input label="Website" value={website} onChangeText={setWebsite} placeholder="https://..." autoCapitalize="none" autoCorrect={false} />
        <Input label="Instagram" value={instagram} onChangeText={setInstagram} placeholder="@usuario" autoCapitalize="none" autoCorrect={false} />
        <Select label="Origem" value={origin} options={ORIGIN_OPTIONS} onChange={setOrigin} placeholder="De onde veio?" />
        <Input label="Serviço de interesse" value={serviceInterest} onChangeText={setServiceInterest} placeholder="Ex: Site, App, Sistema..." />
        <Input label="Valor estimado (R$)" value={estimatedValue} onChangeText={setEstimatedValue} placeholder="0,00" keyboardType="decimal-pad" />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Input label="Próxima ação" value={nextAction} onChangeText={setNextAction} placeholder="Ex: Ligar na sexta..." />
        <Input label="Próximo contato (AAAA-MM-DD)" value={followUpAt} onChangeText={setFollowUpAt} placeholder="2025-01-15" />
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
  clientSection: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  clientSectionTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  clientMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  clientMetricItem: { alignItems: 'center', flex: 1 },
  clientMetricValue: { fontSize: FONT_SIZE.md, fontWeight: '800' },
  clientMetricLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', marginTop: 2 },
  clientInfoLine: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: 4 },
  linkedSection: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  linkedSectionTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  linkedEmpty: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  linkedProjectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  linkedProjectName: { color: COLORS.text, fontSize: FONT_SIZE.sm },
  linkedManageText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700', marginTop: SPACING.xs },
})