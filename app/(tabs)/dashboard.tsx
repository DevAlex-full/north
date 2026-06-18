import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { dashboardService } from '../../services/dashboard.service'
import { taskService } from '../../services/task.service'
import { financialService } from '../../services/financial.service'
import { Card } from '../../components/ui/Card'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Badge } from '../../components/ui/Badge'
import { Checkbox } from '../../components/ui/Checkbox'
import { LoadingScreen } from '../../components/ui/LoadingScreen'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'
import { formatCurrency } from '../../utils/format'
import { useAuthStore } from '../../stores/auth.store'

export default function DashboardScreen() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { user } = useAuthStore()

  const load = async () => {
    try {
      const d = await dashboardService.get()
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const toggleTask = async (id: string, status: string) => {
    const newStatus = status === 'DONE' ? 'PENDING' : 'DONE'
    try {
      await taskService.update(id, { status: newStatus })
      await load()
    } catch { Alert.alert('Erro', 'Não foi possível atualizar a tarefa') }
  }

  if (loading) return <LoadingScreen message="Carregando seu dia..." />

  const fin = data?.financial || {}
  const pct = data?.progress || 0
  const tasks = data?.tasks || []
  const metaBatida = fin.status === 'REACHED'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: SPACING.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{data?.greeting || `Bom dia, ${user?.name}`}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <Text style={{ fontSize: 36 }}>🧭</Text>
      </View>

      {/* Meta Indrive */}
      <Card style={[styles.metaCard, metaBatida && { borderColor: COLORS.success + '66' }]}>
        <Text style={styles.metaTitle}>🚗 Meta Indrive de Hoje</Text>
        {metaBatida && <Text style={styles.metaBatida}>🎯 META BATIDA!</Text>}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Ganhou</Text>
            <Text style={[styles.metaValue, { color: COLORS.success }]}>{formatCurrency(fin.earned || 0)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Gasolina</Text>
            <Text style={[styles.metaValue, { color: COLORS.danger }]}>-{formatCurrency(fin.gas || 0)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Líquido</Text>
            <Text style={[styles.metaValue, { color: fin.netProfit >= fin.target ? COLORS.success : COLORS.warning }]}>{formatCurrency(fin.netProfit || 0)}</Text>
          </View>
        </View>
        <ProgressBar value={fin.netProfit || 0} total={fin.target || 150} label={`Meta: ${formatCurrency(fin.target || 150)}`} color={COLORS.success} />
        {!metaBatida && (
          <Text style={styles.metaFalta}>Faltam <Text style={{ color: COLORS.warning, fontWeight: '700' }}>{formatCurrency(fin.remaining || 0)}</Text> para bater a meta</Text>
        )}
      </Card>

      {/* Progresso do dia */}
      <Card>
        <Text style={styles.sectionTitle}>📊 Progresso de Hoje</Text>
        <ProgressBar value={pct} total={100} label={`${tasks.filter((t: any) => t.status === 'DONE').length} de ${tasks.length} tarefas`} />
        <Badge status={pct >= 100 ? 'COMPLETED' : pct >= 60 ? 'IN_PROGRESS' : 'PENDING'} label={`${pct}% concluído`} />
      </Card>

      {/* Financeiro resumo */}
      <Card>
        <Text style={styles.sectionTitle}>💰 Finanças de Hoje</Text>
        <View style={styles.finRow}>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Entradas</Text>
            <Text style={[styles.finValue, { color: COLORS.success }]}>{formatCurrency(fin.income || 0)}</Text>
          </View>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Saídas</Text>
            <Text style={[styles.finValue, { color: COLORS.danger }]}>{formatCurrency(fin.expense || 0)}</Text>
          </View>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Lucro</Text>
            <Text style={[styles.finValue, { color: (fin.profit || 0) >= 0 ? COLORS.success : COLORS.danger }]}>{formatCurrency(fin.profit || 0)}</Text>
          </View>
        </View>
      </Card>

      {/* Tarefas do dia */}
      <Card>
        <Text style={styles.sectionTitle}>✅ Tarefas de Hoje</Text>
        {tasks.length === 0
          ? <Text style={styles.empty}>Nenhuma tarefa para hoje</Text>
          : tasks.map((task: any) => (
            <Checkbox
              key={task.id}
              label={task.title}
              checked={task.status === 'DONE'}
              onToggle={() => toggleTask(task.id, task.status)}
            />
          ))
        }
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  greeting: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  date: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2, textTransform: 'capitalize' },
  metaCard: { marginHorizontal: SPACING.md, borderColor: COLORS.border },
  metaTitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '700', marginBottom: SPACING.md },
  metaBatida: { color: COLORS.success, fontSize: FONT_SIZE.lg, fontWeight: '900', textAlign: 'center', marginBottom: SPACING.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  metaItem: { alignItems: 'center', flex: 1 },
  metaLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 },
  metaValue: { fontSize: FONT_SIZE.lg, fontWeight: '800' },
  metaFalta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center', marginTop: SPACING.xs },
  sectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.md },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finItem: { alignItems: 'center', flex: 1 },
  finLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 },
  finValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  empty: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, textAlign: 'center', padding: SPACING.lg },
})
