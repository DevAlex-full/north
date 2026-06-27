import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { financialService } from '../../services/financial.service'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'
import { formatCurrency } from '../../utils/format'
import { getTodayString, startOfDaySP, endOfDaySP, getWeekRangeSP, getMonthRangeSP, formatDateShort } from '../../utils/date'

type Period = 'day' | 'week' | 'month'

const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'day' },
  { label: 'Semana', value: 'week' },
  { label: 'Mês', value: 'month' },
]

/**
 * Calcula o intervalo de datas (início/fim) correspondente ao período
 * selecionado, para filtrar tanto o resumo quanto a lista de transações.
 * Sempre ancorado no calendário de São Paulo (não no fuso do dispositivo).
 */
function getPeriodRange(period: Period): { startDate: string; endDate: string } {
  const today = getTodayString()
  let start: Date
  let end: Date

  if (period === 'day') {
    start = startOfDaySP(today)
    end = endOfDaySP(today)
  } else if (period === 'week') {
    const range = getWeekRangeSP(today)
    start = range.start
    end = range.end
  } else {
    const range = getMonthRangeSP(today)
    start = range.start
    end = range.end
  }

  return { startDate: start.toISOString(), endDate: end.toISOString() }
}

export default function FinanceiroScreen() {
  const [period, setPeriod] = useState<Period>('day')
  const [summary, setSummary] = useState<any>({})
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [dailyGoal, setDailyGoal] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [suggestion, setSuggestion] = useState<any>(null)

  // Form state
  const [type, setType] = useState('INCOME')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)

  // Goal form
  const [earnedAmount, setEarnedAmount] = useState('')
  const [gasAmount, setGasAmount] = useState('')

  const load = async () => {
    try {
      const range = getPeriodRange(period)
      const [s, t, c, g] = await Promise.all([
        financialService.getSummary(period),
        financialService.getTransactions(range),
        financialService.getCategories(),
        financialService.getDailyGoal(),
      ])
      setSummary(s)
      setTransactions(t)
      setCategories(c)
      setDailyGoal(g)
    } catch (e) {
      console.error(e)
    }
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, [period]))

  const catOptions = categories
    .filter(c => c.type === type)
    .map(c => ({ label: c.name, value: c.id }))

  const openNew = (defaultType = 'INCOME') => {
    setType(defaultType)
    setAmount(''); setDescription(''); setSource(''); setCategoryId('')
    setSuggestion(null)
    setShowModal(true)
  }

  const save = async () => {
    if (!amount || !categoryId) { Alert.alert('Atenção', 'Preencha valor e categoria'); return }
    const val = parseFloat(amount.replace(',', '.'))
    if (isNaN(val) || val <= 0) { Alert.alert('Atenção', 'Valor inválido'); return }
    setSaving(true)
    try {
      await financialService.createTransaction({ type, categoryId, amount: val, description: description || undefined, source: source || undefined })
      if (type === 'INCOME') {
        const s = await financialService.getSuggestion(val)
        setSuggestion(s)
      } else {
        setShowModal(false)
      }
      await load()
    } catch { Alert.alert('Erro', 'Não foi possível registrar') }
    finally { setSaving(false) }
  }

  const saveGoal = async () => {
    const earned = parseFloat(earnedAmount.replace(',', '.') || '0')
    const gas = parseFloat(gasAmount.replace(',', '.') || '0')
    try {
      await financialService.updateDailyGoal({ earnedAmount: earned, gasAmount: gas })
      setShowGoalModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar meta') }
  }

  const deleteTransaction = (t: any) => {
    Alert.alert('Excluir', 'Excluir esta transação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await financialService.deleteTransaction(t.id); await load() } },
    ])
  }

  const netProfit = (dailyGoal?.earnedAmount || 0) - (dailyGoal?.gasAmount || 0)
  const target = dailyGoal?.targetAmount || 150
  const metaBatida = dailyGoal?.status === 'REACHED'

  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Hoje'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💰 Financeiro</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <Button title="+ Entrada" onPress={() => openNew('INCOME')} size="sm" />
          <Button title="+ Saída" onPress={() => openNew('EXPENSE')} size="sm" variant="secondary" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {/* Meta Indrive */}
        <Card style={[{ borderColor: metaBatida ? COLORS.success + '55' : COLORS.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
            <Text style={styles.sectionTitle}>🚗 Meta Indrive</Text>
            <TouchableOpacity onPress={() => { setEarnedAmount(String(dailyGoal?.earnedAmount || '')); setGasAmount(String(dailyGoal?.gasAmount || '')); setShowGoalModal(true) }}>
              <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>Editar</Text>
            </TouchableOpacity>
          </View>
          {metaBatida && <Text style={{ color: COLORS.success, fontWeight: '900', textAlign: 'center', fontSize: FONT_SIZE.lg, marginBottom: SPACING.sm }}>🎯 META BATIDA!</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs }}>Ganhou</Text>
              <Text style={{ color: COLORS.success, fontSize: FONT_SIZE.lg, fontWeight: '800' }}>{formatCurrency(dailyGoal?.earnedAmount || 0)}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs }}>Gasolina</Text>
              <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.lg, fontWeight: '800' }}>-{formatCurrency(dailyGoal?.gasAmount || 0)}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs }}>Líquido</Text>
              <Text style={{ color: netProfit >= target ? COLORS.success : COLORS.warning, fontSize: FONT_SIZE.lg, fontWeight: '800' }}>{formatCurrency(netProfit)}</Text>
            </View>
          </View>
          <ProgressBar value={netProfit} total={target} label={`Meta: ${formatCurrency(target)}`} color={COLORS.success} />
          {!metaBatida && <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' }}>Faltam {formatCurrency(Math.max(0, target - netProfit))}</Text>}
        </Card>

        {/* Seletor de período */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map(p => (
            <TouchableOpacity key={p.value} onPress={() => setPeriod(p.value as Period)} style={[styles.periodBtn, period === p.value && styles.periodActive]}>
              <Text style={[styles.periodText, period === p.value && { color: COLORS.primary }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Resumo */}
        <Card>
          <Text style={styles.sectionTitle}>📊 Resumo — {periodLabel}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>Entradas</Text>
              <Text style={{ color: COLORS.success, fontSize: FONT_SIZE.xl, fontWeight: '800' }}>{formatCurrency(summary.income || 0)}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: COLORS.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>Saídas</Text>
              <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.xl, fontWeight: '800' }}>{formatCurrency(summary.expense || 0)}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: COLORS.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>Lucro</Text>
              <Text style={{ color: (summary.profit || 0) >= 0 ? COLORS.success : COLORS.danger, fontSize: FONT_SIZE.xl, fontWeight: '800' }}>{formatCurrency(summary.profit || 0)}</Text>
            </View>
          </View>
        </Card>

        {/* Transações do período selecionado */}
        <Text style={[styles.sectionTitle, { marginBottom: SPACING.sm }]}>📋 Transações — {periodLabel}</Text>
        {transactions.length === 0
          ? <EmptyState icon="💳" title="Nenhuma transação" subtitle={`Nenhum lançamento em "${periodLabel}"`} onAction={() => openNew()} actionLabel="Adicionar" />
          : transactions.map(t => (
            <TouchableOpacity key={t.id} onLongPress={() => deleteTransaction(t)} activeOpacity={0.8}>
              <Card style={{ marginBottom: SPACING.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' }}>{t.category?.name || '-'}</Text>
                    {t.description ? <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm }}>{t.description}</Text> : null}
                    <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 }}>{formatDateShort(t.date)}</Text>
                  </View>
                  <Text style={{ fontSize: FONT_SIZE.lg, fontWeight: '800', color: t.type === 'INCOME' ? COLORS.success : COLORS.danger }}>
                    {t.type === 'INCOME' ? '+' : '-'}{formatCurrency(t.amount)}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      {/* Modal Nova Transação */}
      <Modal visible={showModal} onClose={() => { setShowModal(false); setSuggestion(null) }} title={type === 'INCOME' ? '💚 Nova Entrada' : '🔴 Nova Saída'}>
        {suggestion ? (
          <View>
            <Text style={{ color: COLORS.success, fontSize: FONT_SIZE.lg, fontWeight: '800', textAlign: 'center', marginBottom: SPACING.md }}>✅ Entrada registrada!</Text>
            <Card style={{ borderColor: COLORS.primary + '44' }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: '700', marginBottom: SPACING.sm }}>💡 Sugestão de divisão (70/20/10)</Text>
              <View style={{ gap: SPACING.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.textMuted }}>70% Despesas</Text>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>{formatCurrency(suggestion.despesas)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.textMuted }}>20% Reserva</Text>
                  <Text style={{ color: COLORS.success, fontWeight: '700' }}>{formatCurrency(suggestion.reserva)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.textMuted }}>10% Projetos</Text>
                  <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{formatCurrency(suggestion.investimento)}</Text>
                </View>
              </View>
            </Card>
            <Button title="Fechar" onPress={() => { setShowModal(false); setSuggestion(null) }} variant="secondary" style={{ marginTop: SPACING.md }} />
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
              {['INCOME', 'EXPENSE'].map(t => (
                <TouchableOpacity key={t} onPress={() => { setType(t); setCategoryId('') }}
                  style={[styles.typeBtn, type === t && { backgroundColor: t === 'INCOME' ? COLORS.success + '33' : COLORS.danger + '33', borderColor: t === 'INCOME' ? COLORS.success : COLORS.danger }]}>
                  <Text style={{ color: type === t ? (t === 'INCOME' ? COLORS.success : COLORS.danger) : COLORS.textMuted, fontWeight: '700' }}>
                    {t === 'INCOME' ? '💚 Entrada' : '🔴 Saída'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Valor (R$) *" value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="decimal-pad" />
            <Select label="Categoria *" value={categoryId} options={catOptions} onChange={setCategoryId} placeholder="Selecionar categoria" />
            <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Opcional..." />
            <Button title={saving ? 'Registrando...' : 'Registrar'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
          </View>
        )}
      </Modal>

      {/* Modal Meta Indrive */}
      <Modal visible={showGoalModal} onClose={() => setShowGoalModal(false)} title="🚗 Atualizar Meta Indrive">
        <Input label="Total ganho hoje (R$)" value={earnedAmount} onChangeText={setEarnedAmount} placeholder="0,00" keyboardType="decimal-pad" />
        <Input label="Gasto com gasolina (R$)" value={gasAmount} onChangeText={setGasAmount} placeholder="0,00" keyboardType="decimal-pad" />
        <Button title="Salvar" onPress={saveGoal} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  sectionTitle: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.sm },
  periodRow: { flexDirection: 'row', marginBottom: SPACING.md, gap: SPACING.sm },
  periodBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  periodActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  periodText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.sm },
  typeBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
})