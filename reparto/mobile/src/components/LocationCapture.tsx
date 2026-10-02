import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LatLng } from '../api/types';
import { formatDistance, formatTime } from '../labels';
import { colors } from '../theme';
import { Button } from './ui';

export interface Fix {
  location: LatLng;
  accuracy: number | null;
  at: string;
}

/** Muestra la ubicación capturada para la evidencia y la distancia al destino. */
export function LocationCapture({
  fix,
  busy,
  error,
  distance,
  limit,
  onRetry,
}: {
  fix: Fix | null;
  busy: boolean;
  error: string | null;
  distance: number | null;
  limit?: number;
  onRetry: () => void;
}) {
  const far = limit !== undefined && distance !== null && distance > limit;
  return (
    <View style={styles.box}>
      <Text style={styles.label}>UBICACIÓN DE LA EVIDENCIA</Text>
      {busy ? <Text style={styles.text}>Obteniendo ubicación GPS…</Text> : null}
      {!busy && fix ? (
        <>
          <Text style={styles.text}>
            Capturada a las {formatTime(fix.at)}
            {fix.accuracy != null ? ` (precisión ±${Math.round(fix.accuracy)} m)` : ''}
          </Text>
          {distance !== null ? (
            <Text style={[styles.dist, { color: far ? colors.danger : colors.success }]}>
              A {formatDistance(distance)} del domicilio
            </Text>
          ) : (
            <Text style={styles.text}>El paquete no tiene coordenadas; no se puede calcular la distancia.</Text>
          )}
        </>
      ) : null}
      {!busy && !fix ? (
        <Text style={styles.text}>{error ?? 'Se capturará al tomar la primera foto.'}</Text>
      ) : null}
      {!busy && (error || fix) ? (
        <Button title={fix ? 'Volver a capturar ubicación' : 'Obtener ubicación'} variant="secondary" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 8 },
  label: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  text: { fontSize: 17, color: colors.text },
  dist: { fontSize: 20, fontWeight: '900' },
});
