import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS, RADIUS, FONT_SIZE, SPACING } from '../../constants/theme'

interface Props { value: number; total?: number; label?: string; color?: string; showPercent?: boolean }

export function ProgressBar({ value, total = 100, label, color = COLORS.primary, showPercent = true }: Props) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  const barColor = pct >= 100 ? COLORS.success : pct >= 80 ? COLORS.warning : color
  return (
    <View style={styles.wrapper}>
      {label && <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {showPercent && <Text style={[styles.pct, { color: barColor }]}>{pct}%</Text>}
      </View>}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  pct: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  track: { height: 8, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.full },
})
