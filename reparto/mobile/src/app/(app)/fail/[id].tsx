import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FailReason } from '../../../api/types';
import { CameraModal } from '../../../components/CameraModal';
import { LocationCapture } from '../../../components/LocationCapture';
import { PhotoStrip } from '../../../components/PhotoStrip';
import { Body, Button, Card, Field, Label, Notice, Screen } from '../../../components/ui';
import { FAIL_REASONS, FAIL_REASON_LABELS } from '../../../labels';
import { canAct, useCourier } from '../../../state/CourierContext';
import { deleteFile } from '../../../sync/files';
import { colors } from '../../../theme';
import { useEvidenceFix } from '../../../utils/useEvidenceFix';

export default function FailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { packages, routeOpen, submitFailure } = useCourier();
  const pkg = packages.find((p) => p.id === id);

  const [clientId] = useState(() => Crypto.randomUUID());
  const [reason, setReason] = useState<FailReason | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const { fix, busy, error: fixError, distance, capture } = useEvidenceFix(pkg?.location);

  const submitted = useRef(false);
  const photoRef = useRef<string | null>(null);
  photoRef.current = photo;
  useEffect(
    () => () => {
      if (!submitted.current && photoRef.current) deleteFile(photoRef.current);
    },
    [],
  );

  if (!pkg) {
    return (
      <Screen>
        <Notice kind="warning">No se encontró el paquete.</Notice>
      </Screen>
    );
  }
  if (!canAct(pkg, routeOpen) && !saving) {
    return (
      <Screen>
        <Notice kind="info">Este paquete ya no se puede marcar como no entregado.</Notice>
        <Button title="Volver" onPress={() => router.back()} />
      </Screen>
    );
  }

  const errors = {
    reason: !reason ? 'Elige el motivo.' : null,
    photo: !photo ? 'Toma una foto de la fachada.' : null,
    fix: !fix ? 'Falta la ubicación GPS.' : null,
    comment: reason === 'OTHER' && comment.trim().length < 3 ? 'Describe el motivo.' : null,
  };
  const valid = !errors.reason && !errors.photo && !errors.fix && !errors.comment;

  const save = async () => {
    setShowErrors(true);
    if (!valid || !fix || !reason || !photo) return;
    setSaving(true);
    try {
      await submitFailure(pkg, {
        clientId,
        location: fix.location,
        occurredAt: fix.at,
        reason,
        comment: comment.trim() || undefined,
        photo,
      });
      submitted.current = true;
      deleteFile(photo);
      router.dismissTo('/packages');
    } catch (e) {
      setSaving(false);
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error desconocido');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Card>
          <Label>Paquete</Label>
          <Text style={styles.big}>{pkg.recipientName}</Text>
          <Body>{pkg.address}</Body>
        </Card>

        <Label>Motivo *</Label>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {FAIL_REASONS.map((r) => {
            const selected = reason === r;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setReason(r)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <Text style={[styles.optionText, selected && { color: '#fff' }]}>{FAIL_REASON_LABELS[r]}</Text>
              </Pressable>
            );
          })}
        </View>
        {showErrors && errors.reason ? <Text style={styles.err}>{errors.reason}</Text> : null}

        <Label>Foto de la fachada *</Label>
        <PhotoStrip
          uris={photo ? [photo] : []}
          max={1}
          onAdd={() => setCameraOpen(true)}
          onRemove={() => {
            if (photo) deleteFile(photo);
            setPhoto(null);
          }}
        />
        {showErrors && errors.photo ? <Text style={styles.err}>{errors.photo}</Text> : null}

        <LocationCapture fix={fix} busy={busy} error={fixError} distance={distance} onRetry={() => void capture()} />
        {showErrors && errors.fix ? <Text style={styles.err}>{errors.fix}</Text> : null}

        <Field
          label={reason === 'OTHER' ? 'Comentario' : 'Comentario (opcional)'}
          required={reason === 'OTHER'}
          multiline
          value={comment}
          onChangeText={setComment}
          error={showErrors ? errors.comment : null}
        />

        <Button title="Guardar intento fallido" big variant="danger" loading={saving} onPress={() => void save()} />
        {showErrors && !valid ? <Notice kind="danger">Revisa los campos marcados.</Notice> : null}
      </Screen>

      <CameraModal
        visible={cameraOpen}
        title="Foto de la fachada"
        onClose={() => setCameraOpen(false)}
        onCaptured={(uri) => {
          setPhoto(uri);
          if (!fix && !busy) void capture();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 22, fontWeight: '900', color: colors.text },
  err: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  optionSelected: { backgroundColor: colors.danger, borderColor: colors.danger },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: colors.text },
  radioSelected: { borderColor: '#fff', backgroundColor: '#fff' },
  optionText: { fontSize: 18, fontWeight: '700', color: colors.text, flexShrink: 1 },
});
