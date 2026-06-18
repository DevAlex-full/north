import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth.store'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const router = useRouter()

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Atenção', 'Preencha todos os campos'); return }
    if (password.length < 6) { Alert.alert('Atenção', 'Senha deve ter ao menos 6 caracteres'); return }
    setLoading(true)
    try {
      await register(name.trim(), email.trim().toLowerCase(), password)
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>🧭</Text>
        <Text style={styles.title}>Criar conta</Text>
      </View>
      <Input label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
      <Input label="Email" value={email} onChangeText={setEmail} placeholder="seu@email.com" keyboardType="email-address" />
      <Input label="Senha" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry />
      <Button title="Criar conta" onPress={handleRegister} loading={loading} size="lg" style={{ marginTop: SPACING.sm }} />
      <TouchableOpacity onPress={() => router.back()} style={styles.footer}>
        <Text style={styles.footerText}>Já tem conta? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Entrar</Text></Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: SPACING.xl },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  logo: { fontSize: 48 },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.sm },
  footer: { marginTop: SPACING.xl, alignItems: 'center' },
  footerText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
})
