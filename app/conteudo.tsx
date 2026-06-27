import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { contentService } from '../services/content.service'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../constants/theme'

const PLATFORM_OPTIONS = [{ label: '📸 Instagram', value: 'instagram' }, { label: '💼 LinkedIn', value: 'linkedin' }]
const STATUS_OPTIONS = [{ label: '💡 Ideia', value: 'IDEA' }, { label: '✏️ Criando', value: 'CREATING' }, { label: '✅ Publicado', value: 'PUBLISHED' }, { label: '♻️ Reaproveitar', value: 'REUSE' }]

export default function ConteudoScreen() {
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [filterPlatform, setFilterPlatform] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [platform, setPlatform] = useState('instagram')
  const [theme, setTheme] = useState('')
  const [status, setStatus] = useState('IDEA')
  const [observations, setObservations] = useState('')

  const load = async () => {
    try { setItems(await contentService.getAll(filterPlatform || undefined)) } catch {}
    setRefreshing(false)
  }

  useFocusEffect(useCallback(() => { load() }, [filterPlatform]))

  const openNew = () => { setEditing(null); setPlatform('instagram'); setTheme(''); setStatus('IDEA'); setObservations(''); setShowModal(true) }
  const openEdit = (c: any) => { setEditing(c); setPlatform(c.platform); setTheme(c.theme); setStatus(c.status); setObservations(c.observations || ''); setShowModal(true) }

  const save = async () => {
    if (!theme.trim()) { Alert.alert('Atenção', 'Tema é obrigatório'); return }
    setSaving(true)
    try {
      const payload = { platform, theme: theme.trim(), status, observations: observations || undefined }
      if (editing) await contentService.update(editing.id, payload)
      else await contentService.create(payload)
      setShowModal(false); await load()
    } catch { Alert.alert('Erro', 'Não foi possível salvar') }
    finally { setSaving(false) }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: COLORS.primary, fontSize: FONT_SIZE.lg }}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>📝 Conteúdo</Text>
        <Button title="+ Conteúdo" onPress={openNew} size="sm" />
      </View>

      {/* Filtro */}
      <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md }}>
        {[{ label: 'Todos', value: '' }, ...PLATFORM_OPTIONS].map(p => (
          <TouchableOpacity key={p.value} onPress={() => setFilterPlatform(p.value)}
            style={[styles.filterBtn, filterPlatform === p.value && styles.filterActive]}>
            <Text style={[styles.filterText, filterPlatform === p.value && { color: COLORS.primary }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={COLORS.primary} />}
      >
        {/* Dicas de frequência */}
        <Card style={{ borderColor: COLORS.primary + '33', marginBottom: SPACING.lg }}>
          <Text style={{ color: COLORS.textSecondary, fontWeight: '700', marginBottom: SPACING.sm }}>📅 Calendário padrão</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm }}>📸 Instagram: Seg · Qua · Sex</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm }}>💼 LinkedIn: Ter · Qui</Text>
        </Card>

        {items.length === 0
          ? <EmptyState icon="📝" title="Nenhum conteúdo" subtitle="Planeje seus posts de Instagram e LinkedIn" onAction={openNew} actionLabel="Criar conteúdo" />
          : items.map(c => (
            <TouchableOpacity key={c.id} onPress={() => openEdit(c)} activeOpacity={0.85}>
              <Card style={{ marginBottom: SPACING.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 4 }}>{c.platform === 'instagram' ? '📸 Instagram' : '💼 LinkedIn'}</Text>
                    <Text style={{ color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' }}>{c.theme}</Text>
                    {c.observations && <Text style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 4 }}>{c.observations}</Text>}
                  </View>
                  <Badge status={c.status} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        }
      </ScrollView>

      <Modal visible={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar conteúdo' : 'Novo conteúdo'}>
        <Select label="Plataforma" value={platform} options={PLATFORM_OPTIONS} onChange={setPlatform} />
        <Input label="Tema / Assunto *" value={theme} onChangeText={setTheme} placeholder="Ex: Como montar um portfólio..." />
        <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <Input label="Observações" value={observations} onChangeText={setObservations} placeholder="Roteiro, referências..." multiline numberOfLines={3} />
        <Button title={saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'} onPress={save} loading={saving} size="lg" style={{ marginTop: SPACING.sm }} />
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  filterBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '22' },
  filterText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
})