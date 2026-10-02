import React, { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBanner } from '../../../components/StatusBanner';
import { Body, Button, Card, Field, Label, Notice, Screen } from '../../../components/ui';
import { FAIL_REASON_LABELS, formatDistance, formatTime } from '../../../labels';
import { useCourier } from '../../../state/CourierContext';
import { removeItem, retryItem, setDistanceJustification, type OutboxItem } from '../../../sync/outbox';
import { flushAll } from '../../../sync/flush';
import { colors } from '../../../theme';

function describe(item: OutboxItem): { title: string; detail: string } {
  switch (item.kind) {
    case 'deliver':
      return {
        title: `Entrega · ${item.trackingCode}`,
        detail: `${item.data.photos.length} foto(s)${item.data.signature ? ' + firma' : ''} · ${formatTime(item.data.occurredAt)}`,
      };
    case 'fail':
      return {
        title: `No entregado · ${item.trackingCode}`,
        detail: `${FAIL_REASON_LABELS[item.data.reason]} · ${formatTime(item.data.occurredAt)}`,
      };
    case 'endRoute':
      return { title: 'Fin de recorrido', detail: formatTime(item.data.endedAt) };
  }
}

function ItemCard({ item }: { item: OutboxItem }) {
  const [justification, setJustification] = useState('');
  const { title, detail } = describe(item);
  const needsJustification = item.kind === 'deliver' && item.lastError?.code === 'DISTANCE_JUSTIFICATION_REQUIRED';

  const discard = () =>
    Alert.alert(
      'Descartar registro',
      'Se borrará del teléfono y NO llegará al servidor. El paquete volverá a quedar pendiente. ¿Seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => void removeItem(item.id) },
      ],
    );

  return (
    <Card style={item.status === 'error' ? { borderColor: colors.danger, borderWidth: 2 } : undefined}>
      <Text style={styles.title}>{title}</Text>
      <Body muted>{detail}</Body>
      {item.status === 'error' ? (
        <Notice kind="danger">
          {needsJustification
            ? 'El servidor pide una justificación porque la entrega se registró a más de 150 m del domicilio.'
            : `Rechazado por el servidor: ${item.lastError?.message ?? 'error desconocido'}`}
        </Notice>
      ) : item.lastError ? (
        <Notice kind="warning">
          Intentos: {item.attempts}. Último error: {item.lastError.message}. Se reintentará automáticamente.
        </Notice>
      ) : (
        <Notice kind="warning">En espera de enviarse.</Notice>
      )}
      {needsJustification && item.kind === 'deliver' ? (
        <>
          {item.data.distanceMeters != null ? (
            <Body>Distancia registrada: {formatDistance(item.data.distanceMeters)}</Body>
          ) : null}
          <Field
            label="Justificación"
            required
            multiline
            value={justification}
            onChangeText={setJustification}
            placeholder="Ej.: el cliente salió a recibirlo a la esquina"
          />
          <Button
            title="Guardar y reenviar"
            variant="success"
            disabled={justification.trim().length < 5}
            onPress={() => {
              void setDistanceJustification(item.id, justification.trim()).then(() => flushAll(true));
            }}
          />
        </>
      ) : null}
      {item.status === 'error' && !needsJustification ? (
        <Button title="Reintentar" onPress={() => void retryItem(item.id).then(() => flushAll(true))} />
      ) : null}
      {item.status === 'error' ? <Button title="Descartar" variant="danger" onPress={discard} /> : null}
    </Card>
  );
}

export default function SyncScreen() {
  const { outbox, pointsPending, syncing, syncNow, online } = useCourier();
  const errors = outbox.filter((i) => i.status === 'error');
  const pending = outbox.filter((i) => i.status === 'pending');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBanner />
      <Screen refreshControl={<RefreshControl refreshing={syncing} onRefresh={() => void syncNow()} />}>
        <Button
          title={syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          loading={syncing}
          disabled={!online}
          onPress={() => void syncNow()}
        />
        {!online ? <Notice kind="warning">Sin conexión. Se sincronizará al recuperar la señal.</Notice> : null}
        {outbox.length === 0 && pointsPending === 0 ? (
          <Notice kind="success">Todo está sincronizado.</Notice>
        ) : null}
        {pointsPending > 0 ? (
          <Card>
            <Label>Ubicaciones</Label>
            <Body>{pointsPending} puntos de ubicación por enviar.</Body>
          </Card>
        ) : null}
        {errors.length > 0 ? <Label>Requieren tu atención</Label> : null}
        {errors.map((i) => (
          <ItemCard key={i.id} item={i} />
        ))}
        {pending.length > 0 ? <Label>Pendientes de enviar</Label> : null}
        {pending.map((i) => (
          <ItemCard key={i.id} item={i} />
        ))}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
});
