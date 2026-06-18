import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS, FONT_SIZE, SPACING } from '../../constants/theme'
import { Button } from './Button'

interface Props { icon?: string; title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }

export function EmptyState({ icon = '📭', title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: SPACING.lg, minWidth: 160 }} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl },
  icon: { fontSize: 48, marginBottom: SPACING.md },
  title: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700', textAlign: 'center' },
  sub: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, textAlign: 'center', marginTop: SPACING.sm },
})
