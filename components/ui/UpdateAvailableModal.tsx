import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'

interface Props {
  visible: boolean
  onUpdateNow: () => void
  onLater: () => void
}

export function UpdateAvailableModal({ visible, onUpdateNow, onLater }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <Image source={require('../../assets/icon.png')} style={styles.icon} resizeMode="contain" />
          </View>

          <Text style={styles.title}>NOVA VERSÃO DISPONÍVEL</Text>
          <Text style={styles.body}>
            Uma nova versão do North foi instalada e está pronta para ser utilizada.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={onUpdateNow} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Atualizar agora</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onLater} activeOpacity={0.7}>
            <Text style={styles.secondaryText}>Depois</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  icon: { width: 48, height: 48 },
  title: {
    color: COLORS.text,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  primaryText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  secondaryBtn: { width: '100%', paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, fontWeight: '600' },
})