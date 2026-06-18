import React from 'react'
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { COLORS, RADIUS, FONT_SIZE, SPACING } from '../../constants/theme'

interface Props { checked: boolean; onToggle: () => void; label: string; disabled?: boolean }

export function Checkbox({ checked, onToggle, label, disabled }: Props) {
  return (
    <TouchableOpacity onPress={onToggle} disabled={disabled} style={styles.row} activeOpacity={0.7}>
      <View style={[styles.box, checked && styles.checked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
      </View>
      <Text style={[styles.label, checked && styles.doneLabel, disabled && { opacity: 0.4 }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  box: { width: 24, height: 24, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  checked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700' },
  label: { color: COLORS.text, fontSize: FONT_SIZE.md, flex: 1 },
  doneLabel: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
})
