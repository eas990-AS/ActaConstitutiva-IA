import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { CameraModal } from '../../../components/CameraModal';
import { LocationCapture } from '../../../components/LocationCapture';
import { PhotoStrip } from '../../../components/PhotoStrip';
import { SignatureModal } from '../../../components/SignatureModal';
import { Body, Button, Card, Field, Label, Notice, Screen } from '../../../components/ui';
import { MAX_DISTANCE_WITHOUT_JUSTIFICATION_M } from '../../../config';
import { canAct, useCourier } from '../../../state/CourierContext';
import { deleteFile, deleteItemFiles, writeBase64File } from '../../../sync/files';
import { colors } from '../../../theme';
import { useEvidenceFix } from '../../../utils/useEvidenceFix';

const MAX_PHOTOS = 3;

export default function DeliverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { packages, routeOpen, submitDelivery } = useCourier();
  const pkg = packages.find((p) => p.id === id);

  const [clientId] = useState(() => Crypto.randomUUID());
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState(pkg?.recipientName ?? '');
  const [comment, setComment] = useState('');
  const [justification, setJustification] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const { fix, busy, error: fixError, distance, capture } = useEvidenceFix(pkg?.location);

  // Si se sale sin guardar, borrar los archivos temporales.
  const submitted = useRef(false);
  const photosRef = useRef<string[]>([]);
  photosRef.current = photos;
  useEffect(
    () => () => {
      if (!submitted.current) {
        photosRef.current.forEach(deleteFile);
        deleteItemFiles(clientId);
      }
    },
    [clientId],
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
        <Notice kind="info">Este paquete ya no se puede marcar como entregado.</Notice>
        <Button title="Volver" onPress={() => router.back()} />
      </Screen>
    );
  }

  const tooFar = distance !== null && distance > MAX_DISTANCE_WITHOUT_JUSTIFICATION_M;
  const errors = {
    photos: photos.length < 1 ? 'Toma al menos una foto del paquete entregado.' : null,
    fix: !fix ? 'Falta la ubicación GPS de la entrega.' : null,
    justification:
      tooFar && justification.trim().length < 5
        ? `Estás a más de ${MAX_DISTANCE_WITHOUT_JUSTIFICATION_M} m del domicilio: explica por qué.`
        : null,
  };
  const valid = !errors.photos && !errors.fix && !errors.justification;

  const onCaptured = (uri: string) => {
    setPhotos((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
    if (!fix && !busy) void capture();
  };

  const onSigned = (dataUrl: string) => {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    try {
      setSignature(writeBase64File(clientId, base64, 'firma.png'));
    } catch {
      Alert.alert('Error', 'No se pudo guardar la firma.');
    }
  };

  const save = async () => {
    setShowErrors(true);
    if (!valid || !fix) return;
    setSaving(true);
    try {
      await submitDelivery(pkg, {
        clientId,
        location: fix.location,
        occurredAt: fix.at,
        recipientName: recipientName.trim() || undefined,
        comment: comment.trim() || undefined,
        distanceJustification: tooFar ? justification.trim() : justification.trim() || undefined,
        distanceMeters: distance,
        photos,
        signature: signature ?? undefined,
      });
      submitted.current = true;
      photos.forEach(deleteFile); // ya se copiaron al directorio de documentos
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

        <Label>Fotos de la entrega (1 a 3) *</Label>
        <PhotoStrip
          uris={photos}
          max={MAX_PHOTOS}
          onAdd={() => setCameraOpen(true)}
          onRemove={(i) =>
            setPhotos((prev) => {
              const uri = prev[i];
              if (uri) deleteFile(uri);
              return prev.filter((_, j) => j !== i);
            })
          }
        />
        {showErrors && errors.photos ? <Text style={styles.err}>{errors.photos}</Text> : null}

        <LocationCapture
          fix={fix}
          busy={busy}
          error={fixError}
          distance={distance}
          limit={MAX_DISTANCE_WITHOUT_JUSTIFICATION_M}
          onRetry={() => void capture()}
        />
        {showErrors && errors.fix ? <Text style={styles.err}>{errors.fix}</Text> : null}

        {tooFar ? (
          <>
            <Notice kind="danger">
              Estás a más de {MAX_DISTANCE_WITHOUT_JUSTIFICATION_M} m del domicilio. Escribe una justificación para guardar.
            </Notice>
            <Field
              label="Justificación de distancia"
              required
              multiline
              value={justification}
              onChangeText={setJustification}
              placeholder="Ej.: el cliente salió a recibirlo a la esquina"
              error={showErrors ? errors.justification : null}
            />
          </>
        ) : null}

        <Field
          label="Nombre de quien recibe"
          value={recipientName}
          onChangeText={setRecipientName}
          autoCapitalize="words"
        />

        <Label>Firma (opcional)</Label>
        {signature ? (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: signature }} style={styles.signature} resizeMode="contain" />
            <Button title="Volver a firmar" variant="secondary" onPress={() => setSignatureOpen(true)} />
          </View>
        ) : (
          <Button title="Capturar firma" variant="secondary" onPress={() => setSignatureOpen(true)} />
        )}

        <Field label="Comentario (opcional)" multiline value={comment} onChangeText={setComment} />

        <Button title="Guardar entrega" big variant="success" loading={saving} onPress={() => void save()} />
        {showErrors && !valid ? <Notice kind="danger">Revisa los campos marcados.</Notice> : null}
      </Screen>

      <CameraModal
        visible={cameraOpen}
        title={`Foto de entrega ${photos.length + 1} de ${MAX_PHOTOS}`}
        onClose={() => setCameraOpen(false)}
        onCaptured={onCaptured}
      />
      <SignatureModal visible={signatureOpen} onClose={() => setSignatureOpen(false)} onSigned={onSigned} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 22, fontWeight: '900', color: colors.text },
  err: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  signature: { height: 140, borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff' },
});
