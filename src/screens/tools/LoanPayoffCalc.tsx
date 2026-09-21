import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme/theme';
import { Field, FieldGrid, CheckRow } from '../../components/fields';
import { HeroMini, HeroResult, Notice, SectionLabel, TypeToggle } from '../../components/ui';
import { computeExtraImpact, formatTerm, money } from '../../lib/calculations';
import { LOAN_PRESETS, LoanType } from '../../lib/types';

const LOAN_TABS: { key: LoanType; label: string }[] = [
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'car', label: 'Car loan' },
  { key: 'personal', label: 'Personal loan' },
];

export default function LoanPayoffCalc() {
  const [loanType, setLoanType] = useState<LoanType>('mortgage');
  const preset = LOAN_PRESETS[loanType];
  const [balance, setBalance] = useState(String(preset.balance));
  const [rate, setRate] = useState(String(preset.rate));
  const [term, setTerm] = useState(String(preset.term));
  const [balloonOn, setBalloonOn] = useState(false);
  const [balloon, setBalloon] = useState('0');
  const [extra, setExtra] = useState('2000');
  const [extraMode, setExtraMode] = useState<'once' | 'monthly'>('once');

  function selectType(t: LoanType) {
    setLoanType(t);
    const p = LOAN_PRESETS[t];
    setBalance(String(p.balance));
    setRate(String(p.rate));
    setTerm(String(p.term));
    setBalloon(String(p.balloon));
    setBalloonOn(t !== 'mortgage' ? p.hasBalloon : false);
  }

  const balanceNum = parseFloat(balance) || 0;
  const rateNum = parseFloat(rate) || 0;
  const termNum = parseFloat(term) || 0.5;
  const balloonNum = Math.min(balloonOn ? parseFloat(balloon) || 0 : 0, balanceNum);
  const extraNum = parseFloat(extra) || 0;

  const r = useMemo(
    () => computeExtraImpact(balanceNum, rateNum, termNum, balloonNum, extraNum, extraMode),
    [balanceNum, rateNum, termNum, balloonNum, extraNum, extraMode]
  );

  const totalPutIn = extraMode === 'once' ? extraNum : extraNum * r.withExtraResult.months;
  const multiplier = totalPutIn > 0 ? (r.interestSaved / totalPutIn).toFixed(1) + '×' : '—';
  const detail =
    extraNum > 0 && r.interestSaved > 0
      ? extraMode === 'once'
        ? `on a ${money(extraNum)} extra repayment`
        : `on an extra ${money(extraNum)} every month`
      : 'Add an extra repayment above to see how much interest it saves.';

  const baseMonths = r.baseResult.months;
  const depositMonths = r.withExtraResult.months;
  const longest = Math.max(baseMonths, 1);
  const depositPct = Math.max((depositMonths / longest) * 100, depositMonths > 0 ? 2 : 0);

  const notice =
    loanType === 'mortgage'
      ? 'General information only, based on the numbers you enter — an approximation, not a full amortisation schedule, and not financial advice.'
      : 'General information only, based on the numbers you enter — an approximation, not a full amortisation schedule, and not financial advice. A balloon payment is a lump sum still owing at the end of the term.';

  return (
    <View style={styles.card}>
      <SectionLabel style={{ marginTop: 0 }}>Loan type</SectionLabel>
      <View style={styles.tabs}>
        {LOAN_TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tab, loanType === t.key && styles.tabActive]} onPress={() => selectType(t.key)}>
            <Text style={[styles.tabText, loanType === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Extra repayment / offset amount" value={extra} onChangeText={setExtra} />
      <TypeToggle
        leftLabel="One-off, today"
        rightLabel="Every month"
        active={extraMode === 'once' ? 'left' : 'right'}
        onChange={(v) => setExtraMode(v === 'left' ? 'once' : 'monthly')}
      />

      <FieldGrid>
        <Field label="Remaining loan amount" value={balance} onChangeText={setBalance} />
        <Field label="Interest rate (%)" value={rate} onChangeText={setRate} />
        <Field label="Term remaining (years)" value={term} onChangeText={setTerm} />
      </FieldGrid>

      {loanType !== 'mortgage' ? (
        <>
          <CheckRow label="This loan has a balloon payment" checked={balloonOn} onToggle={() => setBalloonOn(!balloonOn)} />
          {balloonOn ? <Field label="Balloon payment" value={balloon} onChangeText={setBalloon} /> : null}
        </>
      ) : null}

      <HeroResult variant="g-green" label="Interest saved" amount={money(r.interestSaved)} multiplier={multiplier} sub={detail} />
      <View style={styles.heroRow}>
        <HeroMini variant="g-blue" label="Time saved" amount={r.monthsSaved === 0 ? 'Same' : formatTerm(r.monthsSaved / 12, true)} />
        <HeroMini
          variant="g-dark"
          label={r.newBalanceLbl}
          amount={extraMode === 'once' ? money(r.newBalanceOrPayment) : money(r.newBalanceOrPayment) + '/mo'}
        />
      </View>

      <SectionLabel>When you'll be debt-free</SectionLabel>
      <View style={styles.compareCard}>
        <View style={styles.payoffRow}>
          <Text style={styles.payoffLbl}>Without extra</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: '100%', backgroundColor: '#B3B9C2' }]} />
          </View>
          <Text style={styles.payoffTime}>{formatTerm(baseMonths / 12, true)}</Text>
        </View>
        <View style={styles.payoffRow}>
          <Text style={styles.payoffLbl}>With extra</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${depositPct}%`, backgroundColor: colors.accent }]} />
          </View>
          <Text style={styles.payoffTime}>{formatTerm(depositMonths / 12, true)}</Text>
        </View>
        <View style={[styles.banner, r.monthsSaved <= 0 && styles.bannerNeutral]}>
          <Text style={[styles.bannerText, r.monthsSaved <= 0 && styles.bannerNeutralText]}>
            {r.monthsSaved > 0
              ? `🎉 Debt-free ${formatTerm(r.monthsSaved / 12, true)} sooner — ${money(r.interestSaved)} less interest`
              : 'Add an extra repayment above to pay it off sooner'}
          </Text>
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
  compareCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: 20 },
  payoffRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  payoffLbl: { width: 100, fontSize: 12.5, color: colors.inkDim, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  track: { flex: 1, height: 14, backgroundColor: colors.line, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  payoffTime: { width: 60, textAlign: 'right', fontSize: 13.5, fontFamily: fonts.sansBold, fontWeight: '700', color: colors.ink },
  banner: { marginTop: 2, backgroundColor: colors.accentSoft, borderRadius: 10, padding: 11, alignItems: 'center' },
  bannerText: { color: colors.accentDeep, fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600', textAlign: 'center' },
  bannerNeutral: { backgroundColor: colors.paperWarm },
  bannerNeutralText: { color: colors.inkFaint, fontFamily: fonts.sans, fontWeight: '500' },
});
