import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../auth/AuthContext';
import { StatusBanner } from '../../../components/StatusBanner';
import { Body, Button, Card, Label, Notice, Screen } from '../../../components/ui';
import { formatTime } from '../../../labels';
import { useCourier } from '../../../state/CourierContext';
import { colors } from '../../../theme';

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.stat, { borderColor: color }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const {
    today,
    counts,
    route,
    routeOpen,
    routeEndPending,
    loading,
    error,
    lastUpdated,
    refresh,
    beginRoute,
    logout,
    pendingCount,
    errorCount,
    pointsPending,
  } = useCourier();
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const res = await beginRoute();
      if (res.warning) Alert.alert('Recorrido iniciado', res.warning);
    } catch (e) {
      Alert.alert('No se pudo iniciar', e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setStarting(false);
    }
  };

  const confirmStart = () =>
    Alert.alert(
      'Iniciar recorrido',
      'A partir de ahora se compartirá tu ubicación con tu supervisor hasta que termines el recorrido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar', onPress: () => void start() },
      ],
    );

  const confirmLogout = () => {
    const pend = pendingCount + errorCount + (pointsPending > 0 ? 1 : 0);
    Alert.alert(
      'Cerrar sesión',
      pend > 0
        ? 'Hay registros SIN sincronizar en este teléfono. Si cierras sesión se perderán. ¿Seguro?'
        : routeOpen
          ? 'Tienes un recorrido abierto. Al cerrar sesión se detiene el rastreo. ¿Seguro?'
          : '¿Quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => void logout() },
      ],
    );
  };

  const routeEnded = !!route && !routeOpen;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBanner />
      <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
        <View>
          <Text style={styles.hello}>Hola, {user?.name ?? ''}</Text>
          <Text style={styles.zone}>
            Zona: <Text style={{ fontWeight: '900' }}>{today?.zone?.name ?? 'Sin zona asignada'}</Text>
          </Text>
        </View>

        {error ? <Notice kind="warning">{error}</Notice> : null}

        {!today && loading ? <Body>Cargando tu día…</Body> : null}

        <View style={styles.stats}>
          <Stat label="Total" value={counts.total} color={colors.primary} />
          <Stat label="Entregados" value={counts.delivered} color={colors.success} />
          <Stat label="Fallidos" value={counts.failed} color={colors.danger} />
          <Stat label="Pendientes" value={counts.pending} color={colors.warning} />
        </View>

        {routeOpen && route ? (
          <Card style={{ borderColor: colors.success, borderWidth: 2 }}>
            <Label>Recorrido en curso</Label>
            <Body bold>Iniciado a las {formatTime(route.startedAt)}</Body>
            <Button title="Ver mis paquetes" onPress={() => router.push('/packages')} />
            <Button title="Terminar recorrido" variant="danger" onPress={() => router.push('/end-route')} />
          </Card>
        ) : null}

        {routeEnded && route ? (
          <Card>
            <Label>Recorrido terminado</Label>
            <Body>
              {formatTime(route.startedAt)}
              {route.endedAt ? ` – ${formatTime(route.endedAt)}` : ''}
              {route.distanceKm ? ` · ${route.distanceKm.toFixed(1)} km` : ''}
            </Body>
            {routeEndPending ? <Notice kind="warning">El cierre se enviará al recuperar conexión.</Notice> : null}
          </Card>
        ) : null}

        {!routeOpen ? (
          <>
            {counts.total === 0 && today ? <Notice kind="info">No tienes paquetes asignados para hoy.</Notice> : null}
            {!routeEnded || counts.pending > 0 ? (
              <Button
                title={routeEnded ? 'Iniciar otro recorrido' : 'Iniciar recorrido'}
                big
                variant="success"
                loading={starting}
                onPress={confirmStart}
                accessibilityHint="Obtiene tu ubicación y empieza a compartirla"
              />
            ) : null}
            <Button title="Ver mis paquetes" variant="secondary" onPress={() => router.push('/packages')} />
          </>
        ) : null}

        {lastUpdated ? <Text style={styles.updated}>Actualizado: {formatTime(lastUpdated)} · desliza hacia abajo para actualizar</Text> : null}

        <View style={{ height: 24 }} />
        <Button title="Cerrar sesión" variant="secondary" onPress={confirmLogout} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 26, fontWeight: '900', color: colors.text },
  zone: { fontSize: 19, color: colors.text, marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 3,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  statValue: { fontSize: 40, fontWeight: '900' },
  statLabel: { fontSize: 17, fontWeight: '800', color: colors.text },
  updated: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
