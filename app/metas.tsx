import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { goalService } from '../services/goal.service'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme'
import { formatCurrency } from '../utils/format'

export default function MetasScreen() {
  const router = useRouter()
  const [goals, setGoals] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [increment, setIncrement] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try { setGoals(await goalService.getAll()) } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const openUpdate = (goal: any) => { setSelected(goal); setIncrement(''); setShowUpdate(true) }

  const updateProgress = async () => {
    if (!selected || !increment) return
    const val = parseFloat(increment.replace(',', '.'))
    if (isNaN(val)) { Alert.alert('Valor inválido'); return }
    setSaving(true)
    try {
      await goalService.update(selected.id, { current: selected.current + val })
      setShowUpdate(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível atualizar') }
    finally { setSaving(false) }
  }

  const getIcon = (type: string) => type === 'FINANCIAL' ? '💰' : type === 'COUNTER' ? '🎯' : '✅'
  const formatValue = (g: any, val: number) => g.type === 'FINANCIAL' ? formatCurrency(val) : `${val}${g.unit ? ' ' + g.unit : ''}`

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>🏆 Metas 90 dias</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {/* Banner motivacional */}
        <Card style={{ borderColor: COLORS.primary + '44', marginBottom: SPACING.lg }}>
          <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700', textAlign: 'center' }}>🔥 FOCO NOS PRÓXIMOS 90 DIAS</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, textAlign: 'center', marginTop: 4 }}>Consistência + disciplina = resultado</Text>
        </Card>

        {goals.length === 0
          ? <EmptyState icon="🏆" title="Nenhuma meta" subtitle="Suas metas 90 dias aparecerão aqui" />
          : goals.map(g => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100))
            const done = g.status === 'COMPLETED' || pct >= 100
            return (
              <Card key={g.id} style={[{ marginBottom: SPACING.sm }, done && { borderColor: COLORS.success + '55' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 }}>
                      <Text style={{ fontSize: 20 }}>{getIcon(g.type)}</Text>
                      <Text style={[styles.goalTitle, done && { color: COLORS.success }]}>{g.title}</Text>
                    </View>
                    {g.description && <Text style={styles.goalDesc}>{g.description}</Text>}
                  </View>
                  <Badge status={done ? 'COMPLETED' : g.status} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
                  <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm }}>Progresso</Text>
                  <Text style={{ color: done ? COLORS.success : COLORS.primary, fontWeight: '800', fontSize: FONT_SIZE.sm }}>
                    {formatValue(g, g.current)} / {formatValue(g, g.target)}
                  </Text>
                </View>

                <ProgressBar value={g.current} total={g.target} color={done ? COLORS.success : COLORS.primary} />

                {!done && (
                  <TouchableOpacity style={styles.updateBtn} onPress={() => openUpdate(g)}>
                    <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>+ Atualizar progresso</Text>
                  </TouchableOpacity>
                )}

                {done && (
                  <Text style={{ color: COLORS.success, fontWeight: '700', textAlign: 'center', marginTop: SPACING.sm }}>🎉 META ALCANÇADA!</Text>
                )}
              </Card>
            )
          })
        }
      </ScrollView>

      <Modal visible={showUpdate} onClose={() => setShowUpdate(false)} title={`Atualizar: ${selected?.title}`}>
        <Text style={{ color: COLORS.textMuted, marginBottom: SPACING.md }}>
          Progresso atual: <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
            {selected ? formatValue(selected, selected.current) : '0'} / {selected ? formatValue(selected, selected.target) : '0'}
          </Text>
        </Text>
        <Input
          label={selected?.type === 'FINANCIAL' ? 'Valor a adicionar (R$)' : 'Quantidade a adicionar'}
          value={increment}
          onChangeText={setIncrement}
          placeholder={selected?.type === 'FINANCIAL' ? '0,00' : '1'}
          keyboardType="decimal-pad"
        />
        <Button title={saving ? 'Salvando...' : 'Confirmar'} onPress={updateProgress} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  goalTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', flex: 1 },
  goalDesc: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  updateBtn: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border },
})
