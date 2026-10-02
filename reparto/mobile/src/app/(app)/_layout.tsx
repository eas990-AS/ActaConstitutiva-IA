import { Stack } from 'expo-router';
import React from 'react';
import { EmergencyButton } from '../../components/EmergencyButton';
import { CourierProvider } from '../../state/CourierContext';
import { colors } from '../../theme';

export default function AppLayout() {
  return (
    <CourierProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontSize: 20, fontWeight: '800' },
          headerBackTitle: 'Atrás',
          contentStyle: { backgroundColor: colors.bg },
          headerRight: () => <EmergencyButton />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="package/[id]" options={{ title: 'Paquete' }} />
        <Stack.Screen name="deliver/[id]" options={{ title: 'Confirmar entrega' }} />
        <Stack.Screen name="fail/[id]" options={{ title: 'Entrega fallida' }} />
        <Stack.Screen name="end-route" options={{ title: 'Fin de recorrido' }} />
      </Stack>
    </CourierProvider>
  );
}
