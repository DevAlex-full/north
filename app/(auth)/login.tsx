import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth.store'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const router = useRouter()

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      Alert.alert('Atenção', 'Preencha email e senha')
      return
    }

    setLoading(true)

    try {
      await login(normalizedEmail, password)
    } catch (err: any) {
      Alert.alert(
        'Erro ao fazer login',
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Verifique seu email e senha e tente novamente.'
      )
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
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />

        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          keyboardType="default"
        />

        <Button
          title="Entrar"
          onPress={handleLogin}
          loading={loading}
          size="lg"
          style={{ marginTop: SPACING.sm }}
        />
      </View>

      <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.footer}>
        <Text style={styles.footerText}>
          Não tem conta? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Criar conta</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  logo: { fontSize: 64 },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
    marginTop: SPACING.sm,
  },
  tagline: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, marginTop: SPACING.xs },
  form: { gap: SPACING.xs },
  footer: { marginTop: SPACING.xl, alignItems: 'center' },
  footerText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
})