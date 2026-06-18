import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { RADIUS, FONT_SIZE, SPACING } from '../../constants/theme'
import { getStatusColor, getStatusLabel } from '../../utils/format'

interface Props { status: string; label?: string }

export function Badge({ status, label }: Props) {
  const color = getStatusColor(status)
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[styles.text, { color }]}>{label || getStatusLabel(status)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  text: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
})
