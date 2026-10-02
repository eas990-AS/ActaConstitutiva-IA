import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { compressPhoto } from '../utils/image';
import { colors } from '../theme';
import { Button } from './ui';

/**
 * Cámara a pantalla completa. Solo permite tomar fotos en el momento:
 * no hay acceso a la galería a propósito (evidencia real).
 */
export function CameraModal({
  visible,
  title,
  onClose,
  onCaptured,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.85, exif: false });
      const uri = await compressPhoto(pic.uri, pic.width, pic.height);
      onCaptured(uri);
      onClose();
    } catch {
      setError('No se pudo tomar la foto. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  let content: React.ReactNode;
  if (!permission) {
    content = <ActivityIndicator size="large" color="#fff" />;
  } else if (!permission.granted) {
    content = (
      <View style={styles.permission}>
        <Text style={styles.permText}>Se necesita permiso de cámara para tomar la evidencia.</Text>
        {permission.canAskAgain ? (
          <Button title="Dar permiso" onPress={() => void requestPermission()} />
        ) : (
          <Button title="Abrir ajustes" onPress={() => void Linking.openSettings()} />
        )}
        <Button title="Cancelar" variant="secondary" onPress={onClose} />
      </View>
    );
  } else {
    content = (
      <>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => setReady(true)}
        />
        <View style={styles.bottom}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel} hitSlop={10}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tomar foto"
              onPress={() => void take()}
              disabled={!ready || busy}
              style={[styles.shutter, (!ready || busy) && { opacity: 0.5 }]}
            >
              {busy ? <ActivityIndicator color={colors.primary} size="large" /> : <View style={styles.shutterInner} />}
            </Pressable>
            <View style={styles.cancel} />
          </View>
        </View>
      </>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.body}>{content}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', padding: 16, textAlign: 'center' },
  body: { flex: 1, justifyContent: 'center' },
  permission: { padding: 24, gap: 16 },
  permText: { color: '#fff', fontSize: 18, textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 24, gap: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
  },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' },
  cancel: { width: 110, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  error: { color: '#fff', backgroundColor: colors.danger, padding: 10, textAlign: 'center', fontSize: 16, fontWeight: '700' },
});
