import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth.store'
import { Card } from '../../components/ui/Card'
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme'

const COMMERCIAL_ITEMS = [
  { icon: '📊', label: 'Pipeline', subtitle: 'Funil de vendas e leads', route: '/pipeline' },
  { icon: '📈', label: 'Dashboard Comercial', subtitle: 'Métricas e receita', route: '/dashboard-comercial' },
  { icon: '🏗️', label: 'Projetos', subtitle: 'Pessoais e de clientes', route: '/projetos' },
]

const MENU_ITEMS = [
  { icon: '💼', label: 'Workana', subtitle: 'Propostas e projetos', route: '/workana' },
  { icon: '👔', label: 'Empregos', subtitle: 'Vagas em andamento', route: '/empregos' },
  { icon: '📝', label: 'Conteúdo', subtitle: 'Instagram e LinkedIn', route: '/conteudo' },
  { icon: '🏆', label: 'Metas 90 dias', subtitle: 'Seus grandes objetivos', route: '/metas' },
  { icon: '⚙️', label: 'Configurações', subtitle: 'Perfil e preferências', route: '/configuracoes' },
]

export default function MaisScreen() {
  const router = useRouter()
  const { user } = useAuthStore()

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'A')[0].toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.userName}>{user?.name || 'Usuário'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      </View>

      <View style={{ padding: SPACING.md }}>
        <Text style={styles.sectionLabel}>💼 CRM Comercial</Text>
        {COMMERCIAL_ITEMS.map((item) => (
          <TouchableOpacity key={item.route} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
            <Card style={styles.menuCard}>
              <View style={styles.menuRow}>
                <View style={[styles.menuIcon, { backgroundColor: COLORS.primary + '22' }]}>
                  <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.subtitle}</Text>
                </View>
                <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>›</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>🛠️ Ferramentas</Text>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity key={item.route} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
            <Card style={styles.menuCard}>
              <View style={styles.menuRow}>
                <View style={styles.menuIcon}>
                  <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuSub}>{item.subtitle}</Text>
                </View>
                <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>›</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, paddingTop: SPACING.xl + 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: FONT_SIZE.xl, fontWeight: '800' },
  userName: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  userEmail: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
  sectionLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  menuCard: { marginBottom: SPACING.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  menuIcon: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '700' },
  menuSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 2 },
})