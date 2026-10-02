import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { Loading } from '../components/ui';
import { colors } from '../theme';

function RootNavigator() {
  const { ready, privacyAccepted, user } = useAuth();
  if (!ready) return <Loading />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!privacyAccepted}>
        <Stack.Screen name="privacy" />
      </Stack.Protected>
      <Stack.Protected guard={privacyAccepted && !user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={privacyAccepted && !!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
