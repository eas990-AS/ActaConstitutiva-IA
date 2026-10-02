import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PackageStatus } from '../api/types';
import { STATUS_LABELS, T } from '../labels';
import { colors } from '../theme';

const chipColors: Record<PackageStatus, { bg: string; fg: string }> = {
  REGISTERED: { bg: colors.neutralBg, fg: colors.text },
  ASSIGNED: { bg: colors.infoBg, fg: colors.info },
  IN_ROUTE: { bg: colors.warningBg, fg: colors.warning },
  DELIVERED: { bg: colors.successBg, fg: colors.success },
  FAILED: { bg: colors.dangerBg, fg: colors.danger },
  RETURNED: { bg: colors.neutralBg, fg: colors.textMuted },
};

export function StatusChip({ status }: { status: PackageStatus }) {
  const c = chipColors[status];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg, borderColor: c.fg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

export function SyncChip({ state }: { state: 'pending' | 'error' }) {
  const isErr = state === 'error';
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: isErr ? colors.dangerBg : colors.warningBg, borderColor: isErr ? colors.danger : colors.warning },
      ]}
    >
      <Text style={[styles.text, { color: isErr ? colors.danger : colors.warning }]}>
        {isErr ? T.syncError : T.pendingSync}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 15, fontWeight: '800' },
});
