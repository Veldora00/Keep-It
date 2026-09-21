import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radii } from '../theme/theme';
import { Card, EmptyState, PageTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { FREQUENCY_LABELS, monthlyEquivalent, money } from '../lib/calculations';

const RANGES = [3, 6, 12];

export default function ForecastScreen() {
  const { transactions } = useStore();
  const [months, setMonths] = useState(3);

  const recurring = useMemo(() => transactions.filter((t) => t.recurring), [transactions]);
  const currentBalance = useMemo(
    () =>
      transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) -
      transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const monthlyNet = useMemo(
    () =>
      recurring.reduce((s, t) => {
        const eq = monthlyEquivalent(t.amount, t.frequency);
        return s + (t.type === 'income' ? eq : -eq);
      }, 0),
    [recurring]
  );

  const points = useMemo(() => {
    const pts: number[] = [];
    for (let m = 0; m <= months; m++) pts.push(currentBalance + monthlyNet * m);
    return pts;
  }, [months, currentBalance, monthlyNet]);

  const { pathD, areaD, dots } = useMemo(() => {
    const w = 400,
      h = 180,
      pad = 20;
    const min = Math.min(...points, 0);
    const max = Math.max(...points, 1);
    const range = max - min || 1;
    const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad);
    const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);
    const d = points.map((v, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(v)).join(' ');
    const area = d + ` L${x(points.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
    const dotPts = points.map((v, i) => ({ cx: x(i), cy: y(v) }));
    return { pathD: d, areaD: area, dots: dotPts };
  }, [points]);

  const note =
    recurring.length === 0
      ? 'Mark some transactions as recurring to see a projection here.'
      : `At this pace, your balance moves by ${money(monthlyNet)} per month, reaching ${money(points[points.length - 1])} in ${months} months.`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paperWarm }} contentContainerStyle={styles.screen}>
      <PageTitle>Forecast</PageTitle>

      <View style={styles.controls}>
        {RANGES.map((m) => (
          <Pressable key={m} style={[styles.rangeBtn, months === m && styles.rangeBtnActive]} onPress={() => setMonths(m)}>
            <Text style={[styles.rangeBtnText, months === m && styles.rangeBtnActiveText]}>{m} months</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Svg width="100%" height={180} viewBox="0 0 400 180">
          <Path d={areaD} fill="#1E9E82" fillOpacity={0.12} />
          <Path d={pathD} fill="none" stroke="#1E9E82" strokeWidth={2.5} />
          {dots.map((p, i) => (
            <Circle key={i} cx={p.cx} cy={p.cy} r={3.5} fill="#1E9E82" />
          ))}
        </Svg>
        <Text style={styles.note}>{note}</Text>
      </Card>

      <Text style={styles.sectionLabel}>Recurring items counted</Text>
      {recurring.length === 0 ? (
        <EmptyState text="Mark a transaction as recurring to see it here" />
      ) : (
        <View>
          {recurring.map((t) => (
            <View key={t.id} style={styles.txItem}>
              <View style={[styles.txIcon, { backgroundColor: t.type === 'income' ? colors.accentSoft : colors.redSoft }]}>
                <Text>{t.type === 'income' ? '↓' : '↑'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txName}>{t.name}</Text>
                <Text style={styles.txMeta}>
                  {t.category} · {FREQUENCY_LABELS[t.frequency || 'monthly']}
                </Text>
              </View>
              <Text style={[styles.txAmt, { color: t.type === 'income' ? colors.accentDeep : colors.red }]}>
                {t.type === 'income' ? '+' : '-'}
                {money(t.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, paddingTop: 20, paddingBottom: 110, maxWidth: 520, width: '100%', alignSelf: 'center' },
  controls: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  rangeBtnText: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  rangeBtnActiveText: { color: '#fff' },
  note: { fontSize: 13, color: colors.inkFaint, lineHeight: 20, marginTop: 6 },
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
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: colors.line },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 14.5, fontFamily: fonts.sansMedium, fontWeight: '500', color: colors.ink },
  txMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  txAmt: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
});
