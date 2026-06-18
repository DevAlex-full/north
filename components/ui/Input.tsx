import React, { useState } from 'react'
import { View, TextInput, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native'
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../../constants/theme'

interface Props {
  label?: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: any
  multiline?: boolean
  numberOfLines?: number
  style?: ViewStyle
  error?: string
}

export function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, numberOfLines, style, error }: Props) {
  const [show, setShow] = useState(false)
  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.box, error ? { borderColor: COLORS.danger } : {}]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
          cursorColor={COLORS.primary}
          selectionColor={COLORS.primaryLight}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShow(!show)} style={styles.eye}>
            <Text style={{ color: COLORS.textMuted }}>{show ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.md },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginBottom: 6, fontWeight: '600' },
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
  input: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md, paddingVertical: SPACING.md },
  eye: { padding: SPACING.xs },
  error: { color: COLORS.danger, fontSize: FONT_SIZE.xs, marginTop: 4 },
})
