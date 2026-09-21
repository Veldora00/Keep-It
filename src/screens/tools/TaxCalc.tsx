import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme/theme';
import { Field, FieldGrid, SelectField } from '../../components/fields';
import { HeroMini, HeroResult, Notice, SectionLabel } from '../../components/ui';
import { calcHelp, calcIncomeTax, calcMedicareLevy, money } from '../../lib/calculations';

const PERIODS = [
  { key: 'week', label: 'Weekly', divisor: 52, name: 'week' },
  { key: 'fortnight', label: 'Fortnightly', divisor: 26, name: 'fortnight' },
  { key: 'month', label: 'Monthly', divisor: 12, name: 'month' },
  { key: 'year', label: 'Annual', divisor: 1, name: 'year' },
];

export default function TaxCalc() {
  const [income, setIncome] = useState('95000');
  const [hasHelp, setHasHelp] = useState(false);
  const [period, setPeriod] = useState('week');

  const result = useMemo(() => {
    const incomeNum = parseFloat(income) || 0;
    const incomeTax = Math.max(calcIncomeTax(incomeNum), 0);
    const medicare = calcMedicareLevy(incomeNum);
    const help = hasHelp ? calcHelp(incomeNum) : 0;
    const takeHome = incomeNum - incomeTax - medicare - help;
    const p = PERIODS.find((x) => x.key === period)!;
    const effRate = incomeNum > 0 ? ((incomeTax + medicare + help) / incomeNum) * 100 : 0;
    return { incomeTax, medicare, help, takeHome, divisor: p.divisor, periodName: p.name, effRate };
  }, [income, hasHelp, period]);

  return (
    <View style={styles.card}>
      <SectionLabel style={{ marginTop: 0 }}>Your income</SectionLabel>
      <FieldGrid>
        <Field label="Gross annual income" value={income} onChangeText={setIncome} />
        <SelectField label="HELP/HECS debt" value={hasHelp ? 'Yes' : 'No'} options={['No', 'Yes']} onChange={(v) => setHasHelp(v === 'Yes')} />
      </FieldGrid>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} style={[styles.periodBtn, period === p.key && styles.periodBtnActive]} onPress={() => setPeriod(p.key)}>
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <HeroResult
        variant="g-green"
        label="Take-home pay"
        amount={money(result.takeHome / result.divisor)}
        sub={`That's your take-home pay per ${result.periodName}, after tax${hasHelp ? ', Medicare and HELP' : ' and Medicare'}.`}
      />
      <View style={styles.heroRow}>
        <HeroMini variant="g-dark" label="Income tax" amount={money(result.incomeTax / result.divisor)} />
        <HeroMini variant="g-blue" label="Medicare levy" amount={money(result.medicare / result.divisor)} />
      </View>

      <SectionLabel>Take-home, every way</SectionLabel>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLbl}>Weekly</Text>
          <Text style={styles.statAmt}>{money(result.takeHome / 52)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLbl}>Fortnightly</Text>
          <Text style={styles.statAmt}>{money(result.takeHome / 26)}</Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLbl}>Monthly</Text>
          <Text style={styles.statAmt}>{money(result.takeHome / 12)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLbl}>Annual</Text>
          <Text style={styles.statAmt}>{money(result.takeHome)}</Text>
        </View>
      </View>

      {hasHelp ? (
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>HELP repayment</Text>
            <Text style={[styles.statAmt, { color: colors.red }]}>{money(result.help / result.divisor)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>Effective tax rate</Text>
            <Text style={styles.statAmt}>{result.effRate.toFixed(1)}%</Text>
          </View>
        </View>
      ) : null}

      <Notice>
        Estimate based on 2026–27 Australian resident tax brackets and a flat 2% Medicare levy. HELP repayment is simplified (single marginal
        band above the minimum threshold). Doesn't include offsets, deductions, or the Medicare levy surcharge. General information only, not
        tax advice — for an exact figure, use the ATO's own calculator or speak with a registered tax agent.
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: 22 },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, alignItems: 'center' },
  periodBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  periodText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  periodTextActive: { color: '#fff' },
  heroRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 16 },
  statLbl: { fontSize: 12, color: colors.inkFaint, marginBottom: 4 },
  statAmt: { fontFamily: fonts.serif, fontSize: 22, color: colors.accentDeep },
});
