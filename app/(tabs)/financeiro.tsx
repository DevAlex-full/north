import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { financialService } from '../../services/financial.service'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Checkbox } from '../../components/ui/Checkbox'
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
 * Correção Meta Indrive — mesma normalização usada no backend (sem
 * acento/caixa) só para decidir, na UI, se a categoria escolhida é
 * Gasolina/Combustível (nesse caso o vínculo com o Indrive é automático
 * e o checkbox fica travado marcado, sem exigir nada do usuário).
 */
function normalizeCategoryName(name?: string): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}
function isGasCategoryName(name?: string): boolean {
  const n = normalizeCategoryName(name)
  return n === 'gasolina' || n === 'combustivel'
}

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
  const [affectsIndrive, setAffectsIndrive] = useState(false)
  const [saving, setSaving] = useState(false)
  /** Correção Meta Indrive — quando preenchido, o modal edita esta transação em vez de criar uma nova. */
  const [editingTransaction, setEditingTransaction] = useState<any>(null)

  // Goal form — Correção funcional: earnedAmount/expenseAmount
  // deixaram de ser editáveis manualmente (o backend agora os recalcula
  // sempre a partir das FinancialTransaction reais do dia). A única
  // edição manual que sobra é a própria meta (targetAmount).
  const [goalTarget, setGoalTarget] = useState('')

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

  const selectedCategoryName = categories.find(c => c.id === categoryId)?.name
  const selectedIsGas = type === 'EXPENSE' && isGasCategoryName(selectedCategoryName)

  /**
   * Correção UX (troca de categoria) — se a categoria selecionada SAI de
   * Gasolina/Combustível para outra categoria, o vínculo automático
   * deixa de se aplicar e o formulário não deve preservar
   * `affectsIndrive = true` "por inércia" (o checkbox reapareceria já
   * marcado, sem o usuário ter decidido isso). Só reseta nessa transição
   * específica — trocar entre duas categorias não-Gasolina preserva a
   * escolha explícita que o usuário já tinha feito.
   */
  const handleCategoryChange = (newCategoryId: string) => {
    const wasGas = selectedIsGas
    setCategoryId(newCategoryId)
    if (wasGas) {
      const newCategoryName = categories.find(c => c.id === newCategoryId)?.name
      if (!isGasCategoryName(newCategoryName)) {
        setAffectsIndrive(false)
      }
    }
  }

  const openNew = (defaultType = 'INCOME') => {
    setEditingTransaction(null)
    setType(defaultType)
    setAmount(''); setDescription(''); setSource(''); setCategoryId(''); setAffectsIndrive(false)
    setSuggestion(null)
    setShowModal(true)
  }

  /** Correção Meta Indrive — abre o modal em modo edição, pré-preenchido com a transação tocada. */
  const openEdit = (t: any) => {
    setEditingTransaction(t)
    setType(t.type)
    setAmount(String(t.amount).replace('.', ','))
    setDescription(t.description || '')
    setSource(t.source || '')
    setCategoryId(t.categoryId)
    setAffectsIndrive(!!t.affectsIndriveGoal)
    setSuggestion(null)
    setShowModal(true)
  }

  const save = async () => {
    if (!amount || !categoryId) { Alert.alert('Atenção', 'Preencha valor e categoria'); return }
    const val = parseFloat(amount.replace(',', '.'))
    if (isNaN(val) || val <= 0) { Alert.alert('Atenção', 'Valor inválido'); return }
    setSaving(true)
    try {
      const payload = {
        type,
        categoryId,
        amount: val,
        description: description || undefined,
        source: source || undefined,
        affectsIndriveGoal: type === 'EXPENSE' ? affectsIndrive : undefined,
      }
      if (editingTransaction) {
        await financialService.updateTransaction(editingTransaction.id, payload)
        setShowModal(false)
        setEditingTransaction(null)
      } else {
        await financialService.createTransaction(payload)
        if (type === 'INCOME') {
          const s = await financialService.getSuggestion(val)
          setSuggestion(s)
        } else {
          setShowModal(false)
        }
      }
      await load()
    } catch { Alert.alert('Erro', 'Não foi possível registrar') }
    finally { setSaving(false) }
  }

  /**
   * Correção funcional — edita somente `targetAmount`.
   * `earnedAmount`/`expenseAmount` são sempre recalculados pelo backend a
   * partir das transações reais do dia (Meta Indrive nunca mais fica
   * dessincronizada do Financeiro).
   */
  const saveGoal = async () => {
    const target = parseFloat(goalTarget.replace(',', '.') || '0')
    if (isNaN(target) || target <= 0) { Alert.alert('Atenção', 'Informe uma meta válida'); return }
    try {
      await financialService.updateDailyGoal({ targetAmount: target })
      setShowGoalModal(false)
      await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar a meta') }
  }

  const deleteTransaction = (t: any) => {
    Alert.alert('Excluir', 'Excluir esta transação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await financialService.deleteTransaction(t.id)
            await load()
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir a transação')
          }
        },
      },
    ])
  }

  const netAmount = (dailyGoal?.earnedAmount || 0) - (dailyGoal?.expenseAmount || 0)
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
            <TouchableOpacity onPress={() => { setGoalTarget(String(dailyGoal?.targetAmount || '')); setShowGoalModal(true) }}>
              <Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' }}>Editar meta</Text>
            </TouchableOpacity>
          </View>
          {metaBatida && <Text style={{ color: COLORS.success, fontWeight: '900', textAlign: 'center', fontSize: FONT_SIZE.lg, marginBottom: SPACING.sm }}>🎯 META BATIDA!</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs }}>Ganhou</Text>
              <Text style={{ color: COLORS.success, fontSize: FONT_SIZE.lg, fontWeight: '800' }}>{formatCurrency(dailyGoal?.earnedAmount || 0)}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs }}>Gastos</Text>
              <Text style={{ color: COLORS.danger, fontSize: FONT_SIZE.lg, fontWeight: '800' }}>-{formatCurrency(dailyGoal?.expenseAmount || 0)}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs }}>Líquido</Text>
              <Text style={{ color: netAmount >= target ? COLORS.success : COLORS.warning, fontSize: FONT_SIZE.lg, fontWeight: '800' }}>{formatCurrency(netAmount)}</Text>
            </View>
          </View>
          <ProgressBar value={netAmount} total={target} label={`Meta: ${formatCurrency(target)}`} color={COLORS.success} />
          {!metaBatida && <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center' }}>Faltam {formatCurrency(Math.max(0, target - netAmount))}</Text>}
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
            <TouchableOpacity key={t.id} onPress={() => openEdit(t)} onLongPress={() => deleteTransaction(t)} activeOpacity={0.8}>
              <Card style={{ marginBottom: SPACING.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600' }}>
                      {t.category?.name || '-'}{t.affectsIndriveGoal ? ' 🚗' : ''}
                    </Text>
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

      {/* Modal Nova Transação / Editar Transação */}
      <Modal
        visible={showModal}
        onClose={() => { setShowModal(false); setSuggestion(null); setEditingTransaction(null) }}
        title={editingTransaction ? (type === 'INCOME' ? '💚 Editar Entrada' : '🔴 Editar Saída') : (type === 'INCOME' ? '💚 Nova Entrada' : '🔴 Nova Saída')}
      >
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
                <TouchableOpacity key={t} onPress={() => { setType(t); setCategoryId(''); setAffectsIndrive(false) }}
                  style={[styles.typeBtn, type === t && { backgroundColor: t === 'INCOME' ? COLORS.success + '33' : COLORS.danger + '33', borderColor: t === 'INCOME' ? COLORS.success : COLORS.danger }]}>
                  <Text style={{ color: type === t ? (t === 'INCOME' ? COLORS.success : COLORS.danger) : COLORS.textMuted, fontWeight: '700' }}>
                    {t === 'INCOME' ? '💚 Entrada' : '🔴 Saída'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Valor (R$) *" value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="decimal-pad" />
            <Select label="Categoria *" value={categoryId} options={catOptions} onChange={handleCategoryChange} placeholder="Selecionar categoria" />
            <Input label="Descrição" value={description} onChangeText={setDescription} placeholder="Opcional..." />
            {type === 'EXPENSE' && (
              selectedIsGas ? (
                <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.md }}>
                  🚗 Gasolina conta automaticamente como despesa operacional do Indrive.
                </Text>
              ) : (
                <View style={{ marginBottom: SPACING.md }}>
                  <Checkbox
                    label="🚗 Despesa operacional do Indrive (pedágio, estacionamento, lavagem, etc.)"
                    checked={affectsIndrive}
                    onToggle={() => setAffectsIndrive(!affectsIndrive)}
                  />
                </View>
              )
            )}
            <Button title={saving ? 'Salvando...' : (editingTransaction ? 'Salvar' : 'Registrar')} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
          </View>
        )}
      </Modal>

      {/* Modal Meta Indrive — Correção funcional: só a meta (targetAmount) é editável; ganho e gasolina vêm sempre das transações reais do dia. */}
      <Modal visible={showGoalModal} onClose={() => setShowGoalModal(false)} title="🚗 Editar Meta Indrive">
        <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginBottom: SPACING.sm }}>
          Ganho e gasolina são calculados automaticamente a partir das transações do dia — registre-as como Entrada/Saída acima.
        </Text>
        <Input label="Meta diária (R$)" value={goalTarget} onChangeText={setGoalTarget} placeholder="150,00" keyboardType="decimal-pad" />
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