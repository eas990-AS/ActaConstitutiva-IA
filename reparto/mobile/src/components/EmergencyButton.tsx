import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import { useCourier } from '../state/CourierContext';
import { colors } from '../theme';

/** Botón de emergencia (solo con recorrido abierto). Pide confirmación antes de enviar. */
export function EmergencyButton() {
  const { routeOpen, panic } = useCourier();
  const [sending, setSending] = useState(false);
  if (!routeOpen) return null;

  const send = async () => {
    setSending(true);
    try {
      await panic();
      Alert.alert('Alerta enviada', 'Tu supervisor recibió la alerta de emergencia con tu ubicación.');
    } catch (e) {
      Alert.alert('No se envió la alerta', e instanceof Error ? e.message : 'Error desconocido', [
        { text: 'Llamar al 911', style: 'destructive', onPress: () => void Linking.openURL('tel:911') },
        { text: 'Cerrar', style: 'cancel' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      'Emergencia',
      '¿Enviar una alerta de emergencia a tu supervisor con tu ubicación actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar alerta', style: 'destructive', onPress: () => void send() },
      ],
      { cancelable: true },
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Botón de emergencia"
      onPress={confirm}
      disabled={sending}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
      hitSlop={8}
    >
      {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>SOS</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.emergency,
    borderRadius: 10,
    minWidth: 64,
    height: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7F0000',
    marginRight: 8,
  },
  text: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
});
