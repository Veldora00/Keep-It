import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme/theme';
import { Field, FieldGrid } from '../../components/fields';
import { HeroMini, HeroResult, Notice, SectionLabel } from '../../components/ui';
import { calcIncomeTax, calcMedicareLevy, maxLoanForPayment, money } from '../../lib/calculations';
import { BC_PRESETS, BcType } from '../../lib/types';

const BC_TABS: { key: BcType; label: string }[] = [
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'car', label: 'Car loan' },
  { key: 'personal', label: 'Personal loan' },
];

export default function BorrowCalc() {
  const [bcType, setBcType] = useState<BcType>('mortgage');
  const preset = BC_PRESETS[bcType];
  const [income, setIncome] = useState('95000');
  const [expenses, setExpenses] = useState('2200');
  const [debts, setDebts] = useState('0');
  const [deposit, setDeposit] = useState(String(preset.deposit));
  const [rate, setRate] = useState(String(preset.rate));
  const [term, setTerm] = useState(String(preset.term));

  function selectType(t: BcType) {
    setBcType(t);
    const p = BC_PRESETS[t];
    setRate(String(p.rate));
    setTerm(String(p.term));
    setDeposit(String(p.deposit));
  }

  const result = useMemo(() => {
    const p = BC_PRESETS[bcType];
    const incomeNum = parseFloat(income) || 0;
    const expensesNum = parseFloat(expenses) || 0;
    const debtsNum = parseFloat(debts) || 0;
    const depositNum = p.showDeposit ? parseFloat(deposit) || 0 : 0;
    const rateNum = parseFloat(rate) || 0;
    const termYears = parseFloat(term) || 30;
    const buffer = p.buffer;

    const incomeTax = Math.max(calcIncomeTax(incomeNum), 0);
    const medicare = calcMedicareLevy(incomeNum);
    const netMonthly = (incomeNum - incomeTax - medicare) / 12;

    const assessRate = rateNum + buffer;
    const monthlyAssessRate = assessRate / 100 / 12;
    const termMonths = termYears * 12;

    const surplus = Math.max(netMonthly - expensesNum - debtsNum, 0);
    const maxLoan = maxLoanForPayment(surplus, monthlyAssessRate, termMonths);
    const maxPrice = maxLoan + depositNum;

    const actualMonthlyRate = rateNum / 100 / 12;
    const actualPayment =
      actualMonthlyRate === 0 ? maxLoan / termMonths : (maxLoan * actualMonthlyRate) / (1 - Math.pow(1 + actualMonthlyRate, -termMonths));

    return { maxPrice, maxLoan, depositNum, actualPayment, assessRate, surplus };
  }, [bcType, income, expenses, debts, deposit, rate, term]);

  const notice =
    bcType === 'mortgage'
      ? 'Uses a 3% serviceability buffer on top of your entered rate, the same minimum buffer APRA requires lenders to apply to home loans. General information only, based on the numbers you enter — actual lending criteria vary by lender and this is not a loan pre-approval or financial advice.'
      : `APRA's 3% buffer specifically applies to home loans — ${bcType === 'car' ? 'car' : 'personal'} loans aren't held to a fixed buffer, so this uses your entered rate directly. Individual lenders may still apply their own margin. General information only, not a loan pre-approval or financial advice.`;

  return (
    <View style={styles.card}>
      <SectionLabel style={{ marginTop: 0 }}>Loan type</SectionLabel>
      <View style={styles.tabs}>
        {BC_TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tab, bcType === t.key && styles.tabActive]} onPress={() => selectType(t.key)}>
            <Text style={[styles.tabText, bcType === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel style={{ marginTop: 0 }}>Your position</SectionLabel>
      <FieldGrid>
        <Field label="Gross annual income" value={income} onChangeText={setIncome} />
        <Field label="Monthly living expenses" value={expenses} onChangeText={setExpenses} />
        <Field label="Other monthly debts" value={debts} onChangeText={setDebts} />
        {preset.showDeposit ? <Field label={preset.depositLabel} value={deposit} onChangeText={setDeposit} /> : null}
        <Field label="Loan rate (%)" value={rate} onChangeText={setRate} />
        <Field label="Loan term (years)" value={term} onChangeText={setTerm} />
      </FieldGrid>

      <HeroResult
        variant="g-dark"
        label={preset.priceLabel}
        amount={money(result.maxPrice)}
        sub={result.surplus <= 0 ? 'Living expenses and debts currently exceed your net income' : 'Based on your income, expenses' + (preset.showDeposit ? ' and deposit' : '')}
      />
      <View style={styles.heroRow}>
        <HeroMini variant="g-green" label="Loan amount" amount={money(result.maxLoan)} />
        {preset.showDeposit ? <HeroMini variant="g-blue" label="Deposit used" amount={money(result.depositNum)} /> : null}
      </View>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLbl}>Est. monthly repayment</Text>
          <Text style={styles.statAmt}>{money(result.actualPayment)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLbl}>Assessed at (incl. buffer)</Text>
          <Text style={styles.statAmt}>{result.assessRate.toFixed(2)}%</Text>
        </View>
      </View>
      <Notice>{notice}</Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: 22 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, alignItems: 'center' },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  tabTextActive: { color: '#fff' },
  heroRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 16 },
  statLbl: { fontSize: 12, color: colors.inkFaint, marginBottom: 4 },
  statAmt: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
});
