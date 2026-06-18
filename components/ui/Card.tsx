import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { COLORS, RADIUS, SPACING } from '../../constants/theme'

interface Props { children: React.ReactNode; style?: ViewStyle; padding?: number }

export function Card({ children, style, padding = SPACING.md }: Props) {
  return <View style={[styles.card, { padding }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
})
