import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radii } from '../theme/theme';

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function SectionLabelRow({ label, action, onPress }: { label: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {action ? (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text style={styles.linkBtn}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ text, small }: { text: string; small?: boolean }) {
  return (
    <View style={[styles.emptyState, small && styles.emptyStateSmall]}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

type Gradient = 'g-dark' | 'g-green' | 'g-blue';
const GRADIENT_MAP: Record<Gradient, readonly [string, string]> = {
  'g-dark': gradients.dark,
  'g-green': gradients.green,
  'g-blue': gradients.blue,
};

export function HeroResult({
  variant,
  label,
  amount,
  multiplier,
  sub,
  style,
}: {
  variant: Gradient;
  label: string;
  amount: string;
  multiplier?: string;
  sub?: string;
  style?: ViewStyle;
}) {
  return (
    <LinearGradient
      colors={GRADIENT_MAP[variant]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.heroResult, style]}
    >
      <Text style={styles.heroLbl}>{label}</Text>
      <View style={styles.heroAmtRow}>
        <Text style={styles.heroAmt}>{amount}</Text>
        {multiplier ? (
          <View style={styles.heroMultiplier}>
            <Text style={styles.heroMultiplierText}>{multiplier}</Text>
          </View>
        ) : null}
      </View>
      {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
    </LinearGradient>
  );
}

export function HeroMini({ variant, label, amount, style }: { variant: Gradient; label: string; amount: string; style?: ViewStyle }) {
  return (
    <LinearGradient colors={GRADIENT_MAP[variant]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={[styles.heroMini, style]}>
      <Text style={styles.heroMiniLbl}>{label}</Text>
      <Text style={styles.heroMiniAmt}>{amount}</Text>
    </LinearGradient>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function DarkChip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.darkChipActive]}>
      <Text style={[styles.chipText, active && styles.darkChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function TypeToggle({
  leftLabel,
  rightLabel,
  active,
  onChange,
}: {
  leftLabel: string;
  rightLabel: string;
  active: 'left' | 'right';
  onChange: (v: 'left' | 'right') => void;
}) {
  return (
    <View style={styles.typeToggle}>
      <Pressable
        onPress={() => onChange('left')}
        style={[styles.typeBtn, active === 'left' && styles.typeBtnExpenseActive]}
      >
        <Text style={[styles.typeBtnText, active === 'left' && styles.typeBtnExpenseActiveText]}>{leftLabel}</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('right')}
        style={[styles.typeBtn, active === 'right' && styles.typeBtnIncomeActive]}
      >
        <Text style={[styles.typeBtnText, active === 'right' && styles.typeBtnIncomeActiveText]}>{rightLabel}</Text>
      </Pressable>
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.btnPrimary, disabled && styles.btnPrimaryDisabled, pressed && !disabled && styles.btnPrimaryPressed]}
    >
      <Text style={styles.btnPrimaryText}>{title}</Text>
    </Pressable>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.pageTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  pageTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, marginTop: 4, marginBottom: 20 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.inkDim,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  linkBtn: { color: colors.accentDeep, fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyStateSmall: { paddingVertical: 24, paddingHorizontal: 16 },
  emptyStateText: { fontSize: 14, color: colors.inkFaint, textAlign: 'center' },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: 20, marginBottom: 18 },
  heroResult: { borderRadius: radii.xl, padding: 20, marginBottom: 14, overflow: 'hidden' },
  heroLbl: { fontSize: 11.5, fontFamily: fonts.sansBold, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  heroAmtRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' },
  heroAmt: { fontFamily: fonts.serif, fontSize: 32, color: '#fff' },
  heroMultiplier: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.pill },
  heroMultiplierText: { color: '#fff', fontFamily: fonts.sansBold, fontWeight: '700', fontSize: 13 },
  heroSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 18 },
  heroMini: { flex: 1, borderRadius: radii.xl, padding: 18, paddingVertical: 22 },
  heroMiniLbl: { fontSize: 11.5, fontFamily: fonts.sansBold, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 8 },
  heroMiniAmt: { fontFamily: fonts.serif, fontSize: 26, color: '#fff' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, marginRight: 8 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipPressed: { opacity: 0.7 },
  chipText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  chipTextActive: { color: '#fff' },
  darkChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  darkChipTextActive: { color: '#fff' },
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBtn: { flex: 1, paddingVertical: 11, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paperWarm, alignItems: 'center' },
  typeBtnText: { fontSize: 14, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  typeBtnExpenseActive: { backgroundColor: colors.redSoft, borderColor: colors.red },
  typeBtnExpenseActiveText: { color: colors.red },
  typeBtnIncomeActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  typeBtnIncomeActiveText: { color: colors.accentDeep },
  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radii.sm, alignItems: 'center' },
  btnPrimaryPressed: { backgroundColor: colors.accentDeep, transform: [{ scale: 0.985 }] },
  btnPrimaryDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  notice: { backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F0DFAE', borderRadius: 12, padding: 14, marginTop: 18 },
  noticeText: { fontSize: 12.5, color: '#7A5A00', lineHeight: 18 },
});
