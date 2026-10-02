import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Screen, Title } from '../components/ui';
import { colors } from '../theme';

const POINTS: { title: string; text: string }[] = [
  {
    title: 'Ubicación solo durante el recorrido',
    text:
      'La app registra tu ubicación únicamente desde que tocas "Iniciar recorrido" hasta que tocas "Terminar recorrido". ' +
      'Fuera de ese horario no se rastrea tu ubicación.',
  },
  {
    title: 'También con la pantalla apagada',
    text:
      'Mientras el recorrido está activo, la ubicación se registra aunque la app esté en segundo plano. ' +
      'Verás una notificación fija "Recorrido activo" mientras esto ocurre.',
  },
  {
    title: 'Para qué se usa',
    text:
      'Tu supervisor ve tu ubicación en tiempo real para coordinar entregas, generar alertas de seguridad ' +
      '(botón de emergencia, salida de zona, batería baja) y calcular el kilometraje del día.',
  },
  {
    title: 'Evidencia de entrega',
    text:
      'Las fotos, la firma y la ubicación del momento de la entrega se guardan como comprobante. ' +
      'Las fotos se toman solo con la cámara; no se accede a tu galería.',
  },
  {
    title: 'Batería',
    text: 'Junto con la ubicación se envía el nivel de batería del teléfono para avisar si está por apagarse.',
  },
];

export default function PrivacyScreen() {
  const { acceptPrivacyNotice } = useAuth();
  const [saving, setSaving] = useState(false);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Screen>
        <Title>Aviso de privacidad</Title>
        <Text style={styles.lead}>Antes de empezar, lee cómo usa esta app tu información.</Text>
        {POINTS.map((p) => (
          <Card key={p.title}>
            <Text style={styles.pTitle}>{p.title}</Text>
            <Text style={styles.pText}>{p.text}</Text>
          </Card>
        ))}
        <Text style={styles.pText}>
          Si tienes dudas sobre el tratamiento de tus datos, consulta con tu supervisor o con el área responsable de la empresa.
        </Text>
        <View style={{ height: 8 }} />
        <Button
          title="Acepto"
          big
          loading={saving}
          onPress={() => {
            setSaving(true);
            void acceptPrivacyNotice().finally(() => setSaving(false));
          }}
        />
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  lead: { fontSize: 19, color: colors.text, lineHeight: 27 },
  pTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  pText: { fontSize: 17, color: colors.text, lineHeight: 25 },
});
