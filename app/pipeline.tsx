import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useLeadStore } from '../stores/lead.store'
import { useProjectStore } from '../stores/project.store'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'
import { formatCurrency } from '../utils/format'
import { buildPipelineColumns, getNextLeadStatus, type PipelineCardData } from '../utils/commercial'
import type { Lead } from '../types/lead.types'

export default function PipelineScreen() {
  const router = useRouter()
  const { leads, fetchLeads, updateLead } = useLeadStore()
  const { projects, fetchProjects } = useProjectStore()
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    await Promise.all([fetchLeads(), fetchProjects('CLIENT')])
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const columns = buildPipelineColumns(leads, projects)

  const advance = async (lead: Lead) => {
    const next = getNextLeadStatus(lead.status)
    if (!next) return
    try { await updateLead(lead.id, { status: next }); await load() }
    catch { Alert.alert('Erro', 'Não foi possível avançar o lead') }
  }

  const markLost = (lead: Lead) => {
    Alert.alert('Marcar como perdido', `Marcar "${lead.name}" como perdido?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          try { await updateLead(lead.id, { status: 'LOST' }); await load() }
          catch { Alert.alert('Erro', 'Não foi possível atualizar o lead') }
        },
      },
    ])
  }

  const hasAnyLead = leads.length > 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>📊 Pipeline</Text>
        <View style={{ width: 24 }} />
      </View>

      {!hasAnyLead ? (
        <EmptyState icon="📊" title="Nenhum lead no pipeline" subtitle="Cadastre leads na tela de Clientes para vê-los aqui" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
        >
          {columns.map((column) => (
            <View key={column.key} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={styles.columnTitle}>{column.label}</Text>
                <View style={styles.columnCountBadge}>
                  <Text style={styles.columnCountText}>{column.count}</Text>
                </View>
              </View>
              <Text style={styles.columnTotal}>{formatCurrency(column.totalValue)}</Text>

              <ScrollView style={styles.columnBody} showsVerticalScrollIndicator={false}>
                {column.cards.length === 0
                  ? <Text style={styles.columnEmpty}>Nenhum card aqui</Text>
                  : column.cards.map((cardData: PipelineCardData) => {
                    const { lead, linkedProject, combinedValue } = cardData
                    const next = getNextLeadStatus(lead.status)
                    const showActions = lead.status !== 'ACTIVE_CLIENT' && lead.status !== 'LOST'

                    return (
                      <Card key={lead.id} style={styles.pipelineCard}>
                        <Text style={styles.cardName}>{lead.name}</Text>
                        {lead.company && <Text style={styles.cardLine}>🏢 {lead.company}</Text>}
                        {(lead.phone || lead.whatsapp) && <Text style={styles.cardLine}>📞 {lead.whatsapp || lead.phone}</Text>}
                        {lead.followUpAt && (
                          <Text style={styles.cardLine}>📅 {new Date(lead.followUpAt).toLocaleDateString('pt-BR')}</Text>
                        )}
                        {combinedValue != null && (
                          <Text style={[styles.cardLine, { color: COLORS.success, fontWeight: '700' }]}>💰 {formatCurrency(combinedValue)}</Text>
                        )}
                        {linkedProject && (
                          <Text style={styles.cardLine}>🏗️ {linkedProject.name}</Text>
                        )}
                        <View style={{ marginTop: SPACING.xs }}>
                          <Badge status={lead.status} />
                        </View>

                        {showActions && (
                          <View style={styles.cardActions}>
                            {next && (
                              <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(lead)}>
                                <Text style={styles.advanceText}>Avançar →</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.lostBtn} onPress={() => markLost(lead)}>
                              <Text style={styles.lostText}>Perdido</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </Card>
                    )
                  })
                }
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const COLUMN_WIDTH = 260

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  column: { width: COLUMN_WIDTH },
  columnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  columnTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '800' },
  columnCountBadge: { backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  columnCountText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  columnTotal: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm },
  columnBody: { maxHeight: 560 },
  columnEmpty: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: SPACING.lg },
  pipelineCard: { marginBottom: SPACING.sm },
  cardName: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '700', marginBottom: 4 },
  cardLine: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 2 },
  cardActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  advanceBtn: { flex: 1, backgroundColor: COLORS.primary + '22', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.primary + '44', paddingVertical: 6, alignItems: 'center' },
  advanceText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  lostBtn: { backgroundColor: COLORS.danger + '22', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.danger + '44', paddingVertical: 6, paddingHorizontal: SPACING.sm, alignItems: 'center' },
  lostText: { color: COLORS.danger, fontSize: FONT_SIZE.xs, fontWeight: '700' },
})