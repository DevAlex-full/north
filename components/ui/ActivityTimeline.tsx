import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS, SPACING, FONT_SIZE } from '../../constants/theme'
import { formatDateShort, formatTime } from '../../utils/date'
import type { Activity, ActivityType } from '../../types/activity.types'

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  CONTACT_MADE: '📞',
  REPLY_RECEIVED: '💬',
  PROPOSAL_SENT: '📄',
  NEGOTIATION_STARTED: '🤝',
  DEAL_CLOSED: '✅',
  PROJECT_STARTED: '🚀',
  PAYMENT_RECEIVED: '💰',
  DELIVERY_MADE: '📦',
  SUPPORT_STARTED: '🛟',
  NOTE: '📝',
}

interface Props {
  activities: Activity[]
  isLoading?: boolean
  emptyLabel?: string
  /** Quando informado, mostra apenas os N eventos mais recentes. */
  limit?: number
}

/**
 * Timeline visual reutilizável baseada em ActivityLog (Fase 4.3C).
 * Puramente apresentacional: recebe `activities` já carregadas pela tela
 * via ActivityStore — não faz nenhuma chamada a service/store por conta
 * própria, preservando o fluxo Tela → Store → Service → Backend.
 * Usada por app/projetos.tsx e app/(tabs)/leads.tsx para evitar duplicar
 * a mesma renderização em dois lugares.
 */
export function ActivityTimeline({ activities, isLoading, emptyLabel = 'Nenhuma atividade registrada ainda.', limit }: Props) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  )
  const visible = limit ? sorted.slice(0, limit) : sorted

  if (isLoading) {
    return <Text style={styles.empty}>Carregando atividades...</Text>
  }

  if (visible.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>
  }

  return (
    <View>
      {visible.map((activity) => (
        <View key={activity.id} style={styles.row}>
          <Text style={styles.icon}>{ACTIVITY_ICONS[activity.type] || '•'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{activity.title}</Text>
            {activity.description && <Text style={styles.description}>{activity.description}</Text>}
            <Text style={styles.date}>{formatDateShort(activity.occurredAt)} às {formatTime(activity.occurredAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  icon: { fontSize: FONT_SIZE.md, width: 24 },
  title: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  description: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 2 },
  date: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  empty: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, textAlign: 'center', paddingVertical: SPACING.md },
})