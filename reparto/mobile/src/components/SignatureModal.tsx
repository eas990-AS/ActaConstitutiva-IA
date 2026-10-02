import React, { useRef } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import { colors } from '../theme';
import { Button } from './ui';

const webStyle = `
  .m-signature-pad { box-shadow: none; border: 3px solid #0A0A0A; border-radius: 12px; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body, html { height: 100%; }
`;

/** Captura de firma. Entrega el PNG como data URL (`data:image/png;base64,...`). */
export function SignatureModal({
  visible,
  onClose,
  onSigned,
}: {
  visible: boolean;
  onClose: () => void;
  onSigned: (dataUrl: string) => void;
}) {
  const ref = useRef<SignatureViewRef>(null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Text style={styles.title}>Firma de quien recibe</Text>
        <View style={styles.pad}>
          <SignatureScreen
            ref={ref}
            webStyle={webStyle}
            imageType="image/png"
            backgroundColor="#FFFFFF"
            penColor="#000000"
            minWidth={2}
            maxWidth={4}
            autoClear={false}
            descriptionText=""
            onOK={(data: string) => {
              onSigned(data);
              onClose();
            }}
            onEmpty={() => Alert.alert('Firma vacía', 'Pide a la persona que firme dentro del recuadro.')}
          />
        </View>
        <View style={styles.actions}>
          <Button title="Borrar" variant="secondary" onPress={() => ref.current?.clearSignature()} style={styles.flex} />
          <Button title="Usar firma" variant="success" onPress={() => ref.current?.readSignature()} style={styles.flex} />
        </View>
        <View style={styles.actions}>
          <Button title="Cancelar" variant="secondary" onPress={onClose} style={styles.flex} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  pad: { flex: 1, minHeight: 260 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
