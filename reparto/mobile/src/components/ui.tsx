import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, sizes } from '../theme';

type Variant = 'primary' | 'success' | 'danger' | 'secondary' | 'emergency';

const variantStyles: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
  success: { bg: colors.success, fg: '#FFFFFF', border: colors.success },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger },
  emergency: { bg: colors.emergency, fg: '#FFFFFF', border: '#7F0000' },
  secondary: { bg: colors.bg, fg: colors.primary, border: colors.primary },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  big,
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  big?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        big && styles.buttonBig,
        { backgroundColor: v.bg, borderColor: v.border, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="large" />
      ) : (
        <Text style={[styles.buttonText, big && styles.buttonTextBig, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Screen({
  children,
  scroll = true,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  if (!scroll) return <View style={styles.screen}>{children}</View>;
  return (
    <ScrollView
      style={styles.screenScroll}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Body({ children, muted, bold }: { children: React.ReactNode; muted?: boolean; bold?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, bold && styles.bold]}>{children}</Text>;
}

export function Field({
  label,
  required,
  error,
  ...props
}: TextInputProps & { label: string; required?: boolean; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, error ? styles.inputError : null]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode }) {
  const map = {
    info: { bg: colors.infoBg, fg: colors.info },
    warning: { bg: colors.warningBg, fg: colors.warning },
    danger: { bg: colors.dangerBg, fg: colors.danger },
    success: { bg: colors.successBg, fg: colors.success },
  }[kind];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg, borderColor: map.fg }]}>
      <Text style={[styles.noticeText, { color: map.fg }]}>{children}</Text>
    </View>
  );
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.body, { marginTop: 12 }]}>{text}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenScroll: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: sizes.pad, paddingBottom: 48, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  button: {
    minHeight: sizes.touch,
    borderRadius: sizes.radius,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBig: { minHeight: 80 },
  buttonText: { fontSize: sizes.font, fontWeight: '700', textAlign: 'center' },
  buttonTextBig: { fontSize: sizes.fontLarge },
  card: {
    backgroundColor: colors.surface,
    borderRadius: sizes.radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: sizes.pad,
    gap: 8,
  },
  title: { fontSize: sizes.fontTitle, fontWeight: '800', color: colors.text },
  label: { fontSize: sizes.fontSmall, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  body: { fontSize: sizes.font, color: colors.text, lineHeight: 26 },
  muted: { color: colors.textMuted },
  bold: { fontWeight: '700' },
  field: { gap: 6 },
  input: {
    minHeight: sizes.touch,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: sizes.radius,
    paddingHorizontal: 14,
    fontSize: sizes.font,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  inputMultiline: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: sizes.fontSmall, fontWeight: '600' },
  notice: { borderWidth: 2, borderRadius: sizes.radius, padding: 12 },
  noticeText: { fontSize: sizes.fontSmall, fontWeight: '700', lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
