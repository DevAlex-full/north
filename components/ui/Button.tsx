import React from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native'
import { COLORS, RADIUS, FONT_SIZE, SPACING } from '../../constants/theme'

interface Props {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, style }: Props) {
  const bg = { primary: COLORS.primary, secondary: COLORS.surface, danger: COLORS.danger, ghost: 'transparent' }
  const textColor = variant === 'ghost' ? COLORS.primary : COLORS.text
  const pad = { sm: SPACING.sm, md: SPACING.md, lg: SPACING.lg }
  const fs = { sm: FONT_SIZE.sm, md: FONT_SIZE.md, lg: FONT_SIZE.lg }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg[variant], paddingVertical: pad[size], opacity: disabled ? 0.5 : 1 },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={COLORS.text} size="small" />
        : <Text style={[styles.text, { color: textColor, fontSize: fs[size] }]}>{title}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: { borderRadius: RADIUS.md, alignItems: 'center', paddingHorizontal: SPACING.lg },
  text: { fontWeight: '700', letterSpacing: 0.3 },
})
