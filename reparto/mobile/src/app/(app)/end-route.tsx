import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, Label, Notice, Screen } from '../../components/ui';
import { formatTime, plural } from '../../labels';
import { useCourier } from '../../state/CourierContext';
import { colors } from '../../theme';

function Line({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function EndRouteScreen() {
  const { counts, route, routeOpen, finishRoute, pendingCount, online } = useCourier();
  const [ending, setEnding] = useState(false);

  if (!routeOpen || !route) {
    return (
      <Screen>
        <Notice kind="info">No tienes un recorrido abierto.</Notice>
        <Button title="Volver al inicio" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  const end = async () => {
    setEnding(true);
    try {
      await finishRoute();
      Alert.alert(
        'Recorrido terminado',
        online
          ? 'Se detuvo el rastreo de ubicación. ¡Buen trabajo!'
          : 'Se detuvo el rastreo de ubicación. El cierre se enviará cuando tengas conexión.',
      );
      router.dismissTo('/');
    } catch (e) {
      setEnding(false);
      Alert.alert('No se pudo terminar', e instanceof Error ? e.message : 'Error desconocido');
    }
  };

  const confirm = () =>
    Alert.alert(
      'Terminar recorrido',
      counts.pending > 0
        ? `Aún tienes ${plural(counts.pending, 'paquete pendiente', 'paquetes pendientes')}. ¿Terminar de todos modos?`
        : '¿Terminar el recorrido y dejar de compartir tu ubicación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Terminar', style: 'destructive', onPress: () => void end() },
      ],
    );

  return (
    <Screen>
      <Card>
        <Label>Resumen del recorrido</Label>
        <Body>Iniciado a las {formatTime(route.startedAt)}</Body>
        <Line label="Total" value={counts.total} color={colors.primary} />
        <Line label="Entregados" value={counts.delivered} color={colors.success} />
        <Line label="No entregados" value={counts.failed} color={colors.danger} />
        <Line label="Pendientes" value={counts.pending} color={colors.warning} />
      </Card>
      {counts.pending > 0 ? (
        <Notice kind="warning">
          Quedan {plural(counts.pending, 'paquete', 'paquetes')} sin registrar. Márcalos como entregados o no entregados antes de terminar, si es posible.
        </Notice>
      ) : null}
      {pendingCount > 0 ? (
        <Notice kind="info">
          Hay {plural(pendingCount, 'registro', 'registros')} por sincronizar; se enviarán antes del cierre.
        </Notice>
      ) : null}
      <Button title="Terminar recorrido" big variant="danger" loading={ending} onPress={confirm} />
      <Button title="Seguir repartiendo" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  lineLabel: { fontSize: 20, fontWeight: '700', color: colors.text },
  lineValue: { fontSize: 28, fontWeight: '900' },
});
