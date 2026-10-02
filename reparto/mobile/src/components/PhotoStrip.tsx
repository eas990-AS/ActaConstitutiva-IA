import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function PhotoStrip({
  uris,
  max,
  onAdd,
  onRemove,
}: {
  uris: string[];
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={styles.row}>
      {uris.map((uri, i) => (
        <View key={uri} style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} accessibilityLabel={`Foto ${i + 1}`} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quitar foto ${i + 1}`}
            onPress={() => onRemove(i)}
            style={styles.remove}
            hitSlop={8}
          >
            <Text style={styles.removeText}>Quitar</Text>
          </Pressable>
        </View>
      ))}
      {uris.length < max ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tomar foto" onPress={onAdd} style={styles.add}>
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addText}>Tomar foto</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 104, gap: 4 },
  thumb: { width: 104, height: 104, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  remove: { backgroundColor: colors.dangerBg, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  removeText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  add: {
    width: 104,
    height: 104,
    borderRadius: 10,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontSize: 36, fontWeight: '800', color: colors.primary, lineHeight: 40 },
  addText: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
