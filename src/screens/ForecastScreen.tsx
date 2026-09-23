import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
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

  const CHART_W = 400;
  const CHART_H = 220;
  const PAD_LEFT = 58;
  const PAD_RIGHT = 14;
  const PAD_TOP = 26;
  const PAD_BOTTOM = 30;

  const chart = useMemo(() => {
    const min = Math.min(...points, 0);
    const max = Math.max(...points, 1);
    const range = max - min || 1;
    const x = (i: number) => PAD_LEFT + (i / (points.length - 1)) * (CHART_W - PAD_LEFT - PAD_RIGHT);
    const y = (v: number) => CHART_H - PAD_BOTTOM - ((v - min) / range) * (CHART_H - PAD_TOP - PAD_BOTTOM);
    const d = points.map((v, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(v)).join(' ');
    const area = d + ` L${x(points.length - 1)},${CHART_H - PAD_BOTTOM} L${x(0)},${CHART_H - PAD_BOTTOM} Z`;
    const dotPts = points.map((v, i) => ({ cx: x(i), cy: y(v), value: v, month: i }));
    // Only label a handful of points so the numbers don't collide: the
    // start, the end, and (for longer ranges) the midpoint.
    const labelIdx = new Set([0, points.length - 1, Math.round((points.length - 1) / 2)]);
    // Month tick marks along the bottom: every point for short ranges,
    // thinning out for longer ones so the labels don't overlap.
    const tickStep = points.length > 7 ? 2 : 1;
    const gridLines = [min, (min + max) / 2, max];
    return { pathD: d, areaD: area, dots: dotPts, labelIdx, tickStep, gridLines, x, y };
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
        <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
          {chart.gridLines.map((v, i) => (
            <React.Fragment key={i}>
              <Line
                x1={PAD_LEFT}
                x2={CHART_W - PAD_RIGHT}
                y1={chart.y(v)}
                y2={chart.y(v)}
                stroke={colors.line}
                strokeWidth={1}
              />
              <SvgText x={PAD_LEFT - 8} y={chart.y(v) + 4} fontSize={10} fill={colors.inkFaint} textAnchor="end">
                {money(v)}
              </SvgText>
            </React.Fragment>
          ))}

          <Path d={chart.areaD} fill="#1E9E82" fillOpacity={0.12} />
          <Path d={chart.pathD} fill="none" stroke="#1E9E82" strokeWidth={2.5} />

          {chart.dots.map((p, i) => (
            <Circle key={i} cx={p.cx} cy={p.cy} r={3.5} fill="#1E9E82" />
          ))}

          {chart.dots.map((p, i) =>
            chart.labelIdx.has(i) ? (
              <SvgText
                key={`v${i}`}
                x={p.cx}
                y={p.cy - 10}
                fontSize={11}
                fontWeight="600"
                fill={colors.ink}
                textAnchor={i === 0 ? 'start' : i === chart.dots.length - 1 ? 'end' : 'middle'}
              >
                {money(p.value)}
              </SvgText>
            ) : null
          )}

          {chart.dots.map((p, i) =>
            i % chart.tickStep === 0 ? (
              <SvgText
                key={`m${i}`}
                x={p.cx}
                y={CHART_H - PAD_BOTTOM + 18}
                fontSize={10}
                fill={colors.inkFaint}
                textAnchor={i === 0 ? 'start' : i === chart.dots.length - 1 ? 'end' : 'middle'}
              >
                {p.month === 0 ? 'Now' : `${p.month}mo`}
              </SvgText>
            ) : null
          )}
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
