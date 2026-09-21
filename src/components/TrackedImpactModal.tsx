import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { Card, HeroMini, PrimaryButton } from './ui';
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.title}>Nice — tracking {label}</Text>
          <Text style={styles.subtitle}>Here's what that's worth.</Text>

          <View style={styles.row}>
            <HeroMini variant="g-green" label="Saved / month" amount={money(monthlySaving)} style={styles.heroFlex} />
            <HeroMini
              variant="g-blue"
              label={hasRealInterestSaving ? 'Interest saved' : 'Saved / year'}
              amount={hasRealInterestSaving ? money(impact!.interestSaved) : money(annual)}
              style={styles.heroFlex}
            />
          </View>

          <Card style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLbl}>Saved this year</Text>
              <Text style={styles.detailAmt}>{money(annual)}</Text>
            </View>
            {hasRealInterestSaving ? (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLbl}>Debt cleared</Text>
                <Text style={styles.detailAmt}>
                  {impact!.monthsSaved === 0 ? 'sooner' : `${formatTerm(impact!.monthsSaved / 12, true)} sooner`}
                </Text>
              </View>
            ) : (
              <Text style={styles.hint}>Add your loan in Tools to see interest saved and your payoff date move up.</Text>
            )}
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
  checkmark: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    color: colors.accentDeep,
    fontSize: 22,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 44,
    marginBottom: 12,
    overflow: 'hidden',
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
});
