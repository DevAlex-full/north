import { Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { COLORS, FONT_SIZE } from '../../constants/theme'

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, borderTopWidth: 1, height: 64, paddingBottom: 8 },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Início', tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: ({ focused }) => <TabIcon icon="📅" focused={focused} /> }} />
      <Tabs.Screen name="financeiro" options={{ title: 'Finanças', tabBarIcon: ({ focused }) => <TabIcon icon="💰" focused={focused} /> }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads', tabBarIcon: ({ focused }) => <TabIcon icon="🎯" focused={focused} /> }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: ({ focused }) => <TabIcon icon="☰" focused={focused} /> }} />
    </Tabs>
  )
}
