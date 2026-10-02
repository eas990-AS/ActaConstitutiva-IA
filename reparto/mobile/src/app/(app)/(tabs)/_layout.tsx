import { Tabs } from 'expo-router';
import React from 'react';
import { EmergencyButton } from '../../../components/EmergencyButton';
import { useCourier } from '../../../state/CourierContext';
import { colors } from '../../../theme';

export default function TabsLayout() {
  const { pendingCount, errorCount } = useCourier();
  const badge = pendingCount + errorCount;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontSize: 20, fontWeight: '800' },
        headerRight: () => <EmergencyButton />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 16, fontWeight: '800' },
        tabBarIconStyle: { display: 'none' },
        tabBarIcon: () => null,
        tabBarStyle: { height: 72, paddingBottom: 12, paddingTop: 8, borderTopWidth: 2, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarLabel: 'Inicio' }} />
      <Tabs.Screen name="packages" options={{ title: 'Mis paquetes', tabBarLabel: 'Paquetes' }} />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sincronización',
          tabBarLabel: 'Sincronizar',
          tabBarBadge: badge > 0 ? badge : undefined,
          tabBarBadgeStyle: { backgroundColor: errorCount ? colors.danger : colors.warning, color: '#fff' },
        }}
      />
    </Tabs>
  );
}
