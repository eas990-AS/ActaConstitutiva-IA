import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { T, plural } from '../labels';
import { useCourier } from '../state/CourierContext';
import { colors } from '../theme';

/** Franja superior: rastreo activo, sin conexión y pendientes de sincronizar. */
export function StatusBanner() {
  const { tracking, routeOpen, online, pendingCount, errorCount, pointsPending, syncing } = useCourier();
  const showTracking = routeOpen || tracking !== 'off';
  const showSync = pendingCount > 0 || errorCount > 0;
  if (!showTracking && online && !showSync) return null;

  return (
    <View style={styles.wrap}>
      {showTracking ? (
        <View
          style={[styles.bar, { backgroundColor: tracking === 'off' ? colors.dangerBg : colors.successBg }]}
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.dot, { backgroundColor: tracking === 'off' ? colors.danger : colors.success }]} />
          <Text style={[styles.text, { color: tracking === 'off' ? colors.danger : colors.success }]}>
            {tracking === 'background'
              ? T.trackingOn
              : tracking === 'foreground'
                ? T.trackingForegroundOnly
                : 'Recorrido abierto · ubicación NO se está registrando'}
          </Text>
        </View>
      ) : null}
      {!online ? (
        <View style={[styles.bar, { backgroundColor: colors.neutralBg }]}>
          <Text style={[styles.text, { color: colors.text }]}>
            Sin conexión · lo que registres se guardará y se enviará después
          </Text>
        </View>
      ) : null}
      {showSync ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/sync')}
          style={[styles.bar, { backgroundColor: errorCount ? colors.dangerBg : colors.warningBg }]}
        >
          <Text style={[styles.text, { color: errorCount ? colors.danger : colors.warning }]}>
            {errorCount
              ? `${plural(errorCount, 'registro rechazado', 'registros rechazados')} · toca para revisar`
              : `${T.pendingSync}: ${pendingCount}${syncing ? ' · enviando…' : ''}`}
            {pointsPending > 0 ? ` · ${pointsPending} ubic.` : ''}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  text: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
});
