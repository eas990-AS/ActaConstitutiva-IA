import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Notice, Screen } from '../components/ui';
import { API_URL } from '../config';
import { colors } from '../theme';

export default function LoginScreen() {
  const { signIn, sessionExpired } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Escribe tu usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.brand}>Reparto</Text>
            <Text style={styles.sub}>App del repartidor</Text>
          </View>
          {sessionExpired ? <Notice kind="warning">Tu sesión expiró. Vuelve a entrar.</Notice> : null}
          <Field
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
          {error ? <Notice kind="danger">{error}</Notice> : null}
          <Button title="Entrar" big loading={loading} onPress={() => void submit()} />
          <Text style={styles.server}>Servidor: {API_URL}</Text>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', marginVertical: 32 },
  brand: { fontSize: 40, fontWeight: '900', color: colors.primary },
  sub: { fontSize: 20, color: colors.textMuted, fontWeight: '700' },
  server: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 16 },
});
