import React from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { COLORS, FONT_SIZE } from '../../constants/theme'

interface Props { message?: string }

export function LoadingScreen({ message = 'Carregando...' }: Props) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  text: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, marginTop: 16 },
})
