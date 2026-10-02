import { router } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBanner } from '../../../components/StatusBanner';
import { StatusChip, SyncChip } from '../../../components/StatusChip';
import { Notice } from '../../../components/ui';
import { useCourier, type PackageView } from '../../../state/CourierContext';
import { colors } from '../../../theme';

function Row({ pkg, index }: { pkg: PackageView; index: number }) {
  const done = pkg.effectiveStatus === 'DELIVERED' || pkg.effectiveStatus === 'FAILED' || pkg.effectiveStatus === 'RETURNED';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Paquete ${index + 1}, ${pkg.recipientName}, ${pkg.address}`}
      onPress={() => router.push({ pathname: '/package/[id]', params: { id: pkg.id } })}
      style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.num}>
        <Text style={styles.numText}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.chips}>
          <StatusChip status={pkg.effectiveStatus} />
          {pkg.sync ? <SyncChip state={pkg.sync} /> : null}
        </View>
        <Text style={styles.recipient}>{pkg.recipientName}</Text>
        <Text style={styles.address}>{pkg.address}</Text>
        <Text style={styles.code}>{pkg.trackingCode}</Text>
      </View>
    </Pressable>
  );
}

export default function PackagesScreen() {
  const { packages, loading, refresh, error, today } = useCourier();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBanner />
      <FlatList
        data={packages}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => <Row pkg={item} index={index} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
        ListHeaderComponent={error ? <Notice kind="warning">{error}</Notice> : null}
        ListEmptyComponent={
          <Notice kind="info">{today ? 'No tienes paquetes para hoy.' : 'Cargando paquetes…'}</Notice>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 10, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    minHeight: 96,
  },
  rowDone: { backgroundColor: colors.surface },
  num: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recipient: { fontSize: 19, fontWeight: '800', color: colors.text },
  address: { fontSize: 17, color: colors.text, lineHeight: 24 },
  code: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
});
