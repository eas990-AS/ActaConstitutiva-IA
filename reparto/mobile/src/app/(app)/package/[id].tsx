import { router, Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBanner } from '../../../components/StatusBanner';
import { StatusChip, SyncChip } from '../../../components/StatusChip';
import { Body, Button, Card, Label, Notice, Screen } from '../../../components/ui';
import { T } from '../../../labels';
import { canAct, useCourier } from '../../../state/CourierContext';
import { colors } from '../../../theme';
import { callPhone, chooseNavigation, openWhatsApp } from '../../../utils/links';

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { packages, routeOpen } = useCourier();
  const pkg = packages.find((p) => p.id === id);

  if (!pkg) {
    return (
      <Screen>
        <Notice kind="warning">No se encontró el paquete. Puede que ya no esté asignado a ti.</Notice>
        <Button title="Volver" onPress={() => router.back()} />
      </Screen>
    );
  }

  const actionable = canAct(pkg, routeOpen);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: pkg.trackingCode }} />
      <StatusBanner />
      <Screen>
        <View style={styles.chips}>
          <StatusChip status={pkg.effectiveStatus} />
          {pkg.sync ? <SyncChip state={pkg.sync} /> : null}
          {pkg.attempts > 0 ? <Text style={styles.attempts}>Intentos: {pkg.attempts}</Text> : null}
        </View>

        <Card>
          <Label>Destinatario</Label>
          <Text style={styles.big}>{pkg.recipientName}</Text>
          {pkg.recipientPhone ? (
            <>
              <Body>{pkg.recipientPhone}</Body>
              <View style={styles.row}>
                <Button title="Llamar" style={styles.flex} onPress={() => void callPhone(pkg.recipientPhone!)} />
                <Button
                  title="WhatsApp"
                  variant="success"
                  style={styles.flex}
                  onPress={() => void openWhatsApp(pkg.recipientPhone!)}
                />
              </View>
            </>
          ) : (
            <Body muted>{T.noPhone}</Body>
          )}
        </Card>

        <Card>
          <Label>Dirección</Label>
          <Text style={styles.address}>{pkg.address}</Text>
          {!pkg.location ? <Body muted>{T.noLocation} (se navegará por dirección)</Body> : null}
          <Button title="Navegar" onPress={() => chooseNavigation(pkg)} />
        </Card>

        <Card>
          <Label>Notas</Label>
          <Body>{pkg.notes?.trim() ? pkg.notes : T.noNotes}</Body>
        </Card>

        {actionable ? (
          <View style={{ gap: 12 }}>
            <Button
              title="Entregado"
              big
              variant="success"
              onPress={() => router.push({ pathname: '/deliver/[id]', params: { id: pkg.id } })}
            />
            <Button
              title="No entregado"
              big
              variant="danger"
              onPress={() => router.push({ pathname: '/fail/[id]', params: { id: pkg.id } })}
            />
          </View>
        ) : !routeOpen && (pkg.effectiveStatus === 'ASSIGNED' || pkg.effectiveStatus === 'IN_ROUTE') ? (
          <Notice kind="info">Inicia tu recorrido para registrar la entrega.</Notice>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  attempts: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  big: { fontSize: 24, fontWeight: '900', color: colors.text },
  address: { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 28 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
