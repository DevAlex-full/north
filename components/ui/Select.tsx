import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native'
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../../constants/theme'

interface Option { label: string; value: string }
interface Props { label?: string; value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string }

export function Select({ label, value, options, onChange, placeholder = 'Selecionar...' }: Props) {
  const [open, setOpen] = useState(false)
  const selected = options.find(o => o.value === value)
  return (
    <View style={{ marginBottom: SPACING.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[styles.text, !selected && { color: COLORS.textMuted }]}>{selected?.label || placeholder}</Text>
        <Text style={{ color: COLORS.textMuted }}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label || 'Selecionar'}</Text>
            <FlatList
              data={options}
              keyExtractor={i => i.value}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.option, item.value === value && styles.selected]} onPress={() => { onChange(item.value); setOpen(false) }}>
                  <Text style={[styles.optText, item.value === value && { color: COLORS.primary, fontWeight: '700' }]}>{item.label}</Text>
                  {item.value === value && <Text style={{ color: COLORS.primary }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginBottom: 6, fontWeight: '600' },
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  text: { color: COLORS.text, fontSize: FONT_SIZE.md },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, maxHeight: '60%' },
  sheetTitle: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: SPACING.md },
  option: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between' },
  selected: { backgroundColor: COLORS.primary + '11' },
  optText: { color: COLORS.text, fontSize: FONT_SIZE.md },
})
