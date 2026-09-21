import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { AnimatedAmount, AnimatedLineChart, Card, HeroMini, PopIn, PrimaryButton } from './ui';
import { formatTerm, money } from '../lib/calculations';
import type { ExtraImpact } from '../lib/calculations';

export interface TrackedImpact {
  label: string;
  monthlySaving: number;
  impact: ExtraImpact | null; // null when no loan is set up yet
}

export default function TrackedImpactModal({
  visible,
  data,
  onClose,
}: {
  visible: boolean;
  data: TrackedImpact | null;
  onClose: () => void;
}) {
  if (!data) return null;
  const { label, monthlySaving, impact } = data;
  const annual = monthlySaving * 12;
  const hasRealInterestSaving = !!impact && impact.interestSaved > 0;

  // Checkpoints at 1 month, 6 months, and 5 years — the debt line (when there's a
  // real loan payoff to show) traces the balance actually going down; otherwise
  // it's the savings simply piling up.
  const checkpointLabel = (months: number) => (months < 12 ? `${months}mo` : `${Math.round(months / 12)}yr`);
  const chartPoints =
    hasRealInterestSaving && impact
      ? [1, 6, 60].map((m) => {
          const idx = Math.min(m, impact.withExtraResult.balances.length - 1);
          return { label: checkpointLabel(m), value: impact.withExtraResult.balances[idx] };
        })
      : [1, 6, 60].map((m) => ({ label: checkpointLabel(m), value: monthlySaving * m }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <PopIn style={styles.checkmarkWrap}>
            <Text style={styles.checkmark}>✓</Text>
          </PopIn>
          <Text style={styles.title}>Nice — tracking {label}</Text>
          <Text style={styles.subtitle}>Here's what that's worth.</Text>

          <View style={styles.row}>
            <HeroMini variant="g-green" label="Saved / month" amount={money(monthlySaving)} animateValue={monthlySaving} style={styles.heroFlex} />
            <HeroMini
              variant="g-blue"
              label={hasRealInterestSaving ? 'Interest saved' : 'Saved / year'}
              amount={hasRealInterestSaving ? money(impact!.interestSaved) : money(annual)}
              animateValue={hasRealInterestSaving ? impact!.interestSaved : annual}
              animateDelay={120}
              style={styles.heroFlex}
            />
          </View>

          <Card style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLbl}>You'll save this year</Text>
              <AnimatedAmount value={annual} duration={900} style={styles.detailAmt} />
            </View>
            {hasRealInterestSaving ? (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLbl}>You'll be debt-free</Text>
                <Text style={styles.detailAmt}>
                  {impact!.monthsSaved === 0 ? 'sooner' : `${formatTerm(impact!.monthsSaved / 12, true)} sooner`}
                </Text>
              </View>
            ) : (
              <Text style={styles.hint}>Add your loan in Tools to see interest saved and your payoff date move up.</Text>
            )}
          </Card>

          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>{hasRealInterestSaving ? "Your debt, going down" : 'Your savings, growing'}</Text>
            <AnimatedLineChart points={chartPoints} color={hasRealInterestSaving ? colors.red : colors.accentDeep} />
          </Card>

          <PrimaryButton title="Keep going" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.5)', justifyContent: 'center', padding: 22 },
  sheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 22 },
  checkmarkWrap: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  checkmark: {
    color: colors.accentDeep,
    fontSize: 22,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    textAlign: 'center',
  },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.inkDim, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  row: { flexDirection: 'row', gap: 12 },
  heroFlex: { flex: 1 },
  detailCard: { marginTop: 14, marginBottom: 18, paddingVertical: 14 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  detailLbl: { fontSize: 14, color: colors.inkDim, fontFamily: fonts.sans },
  detailAmt: { fontSize: 15, color: colors.ink, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  hint: { fontSize: 12.5, color: colors.inkFaint, lineHeight: 18, paddingTop: 4 },
  chartCard: { marginBottom: 18, alignItems: 'center' },
  chartTitle: { fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim, marginBottom: 10, alignSelf: 'flex-start' },
});
