import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth.store'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const router = useRouter()

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Atenção', 'Preencha email e senha'); return }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>🧭</Text>
        <Text style={styles.appName}>North</Text>
        <Text style={styles.tagline}>Sua vida em ordem, todo dia.</Text>
      </View>

      <View style={styles.form}>
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="seu@email.com" keyboardType="email-address" />
        <Input label="Senha" value={password} onChangeText={setPassword} placeholder="••••••" secureTextEntry />
        <Button title="Entrar" onPress={handleLogin} loading={loading} size="lg" style={{ marginTop: SPACING.sm }} />
      </View>

      <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.footer}>
        <Text style={styles.footerText}>Não tem conta? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Criar conta</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: SPACING.xl },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  logo: { fontSize: 64 },
  appName: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.text, letterSpacing: 2, marginTop: SPACING.sm },
  tagline: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, marginTop: SPACING.xs },
  form: { gap: SPACING.xs },
  footer: { marginTop: SPACING.xl, alignItems: 'center' },
  footerText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
})
