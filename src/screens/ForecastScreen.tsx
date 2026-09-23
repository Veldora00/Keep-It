import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts, radii } from '../theme/theme';
import { Card, EmptyState, PageTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { FREQUENCY_LABELS, monthlyEquivalent, money } from '../lib/calculations';

const RANGES = [3, 6, 12];

type ChartData = ReturnType<typeof buildChartData>;
function buildChartData(pts: number[], chartW: number, chartH: number, padLeft: number, padRight: number, padTop: number, padBottom: number) {
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 1);
  const range = max - min || 1;
  const x = (i: number) => padLeft + (i / (pts.length - 1)) * (chartW - padLeft - padRight);
  const y = (v: number) => chartH - padBottom - ((v - min) / range) * (chartH - padTop - padBottom);
  const d = pts.map((v, i) => (i === 0 ? 'M' : 'L') + x(i) + ',' + y(v)).join(' ');
  const area = d + ` L${x(pts.length - 1)},${chartH - padBottom} L${x(0)},${chartH - padBottom} Z`;
  const dotPts = pts.map((v, i) => ({ cx: x(i), cy: y(v), value: v, month: i }));
  const labelIdx = new Set([0, pts.length - 1, Math.round((pts.length - 1) / 2)]);
  const tickStep = pts.length > 7 ? 2 : 1;
  const gridLines = [min, (min + max) / 2, max];
  return { pathD: d, areaD: area, dots: dotPts, labelIdx, tickStep, gridLines, y };
}

function ForecastChart({
  chart,
  color,
  chartW,
  chartH,
  padLeft,
  padRight,
  padBottom,
}: {
  chart: ChartData;
  color: string;
  chartW: number;
  chartH: number;
  padLeft: number;
  padRight: number;
  padBottom: number;
}) {
  return (
    <Svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
      {chart.gridLines.map((v, i) => (
        <React.Fragment key={i}>
          <Line x1={padLeft} x2={chartW - padRight} y1={chart.y(v)} y2={chart.y(v)} stroke={colors.line} strokeWidth={1} />
          <SvgText x={padLeft - 8} y={chart.y(v) + 4} fontSize={10} fill={colors.inkFaint} textAnchor="end">
            {money(v)}
          </SvgText>
        </React.Fragment>
      ))}

      <Path d={chart.areaD} fill={color} fillOpacity={0.12} />
      <Path d={chart.pathD} fill="none" stroke={color} strokeWidth={2.5} />

      {chart.dots.map((p, i) => (
        <Circle key={i} cx={p.cx} cy={p.cy} r={3.5} fill={color} />
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
            y={chartH - padBottom + 18}
            fontSize={10}
            fill={colors.inkFaint}
            textAnchor={i === 0 ? 'start' : i === chart.dots.length - 1 ? 'end' : 'middle'}
          >
            {p.month === 0 ? 'Now' : `${p.month}mo`}
          </SvgText>
        ) : null
      )}
    </Svg>
  );
}

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

  // The balance chart above can legitimately go negative — it's every
  // recurring dollar in and out, loan payments included, not just what
  // you've saved. That reads as "everything is going backwards" even when
  // your habit cuts are working, so it's paired with a second, always-
  // positive chart of just the money your tracked habits are putting aside.
  const monthlySavingsRate = useMemo(() => recurring.reduce((s, t) => s + (t.habitSaving || 0), 0), [recurring]);
  const savingsPoints = useMemo(() => {
    const pts: number[] = [];
    for (let m = 0; m <= months; m++) pts.push(monthlySavingsRate * m);
    return pts;
  }, [months, monthlySavingsRate]);

  const CHART_W = 400;
  const CHART_H = 220;
  const PAD_LEFT = 58;
  const PAD_RIGHT = 14;
  const PAD_TOP = 26;
  const PAD_BOTTOM = 30;

  const chart = useMemo(() => buildChartData(points, CHART_W, CHART_H, PAD_LEFT, PAD_RIGHT, PAD_TOP, PAD_BOTTOM), [points]);
  const savingsChart = useMemo(
    () => buildChartData(savingsPoints, CHART_W, CHART_H, PAD_LEFT, PAD_RIGHT, PAD_TOP, PAD_BOTTOM),
    [savingsPoints]
  );

  const note =
    recurring.length === 0
      ? 'Mark some transactions as recurring to see a projection here.'
      : `At this pace, your balance moves by ${money(monthlyNet)} per month, reaching ${money(points[points.length - 1])} in ${months} months.`;

  const savingsNote =
    monthlySavingsRate <= 0
      ? 'Track an everyday habit on Home to see your savings build up here.'
      : `Your tracked habits put aside ${money(monthlySavingsRate)} per month — ${money(
          savingsPoints[savingsPoints.length - 1]
        )} saved by ${months} months, on top of whatever your balance above is doing.`;

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

      <Text style={styles.sectionLabel}>Overall balance</Text>
      <Card>
        <ForecastChart chart={chart} color="#1E9E82" chartW={CHART_W} chartH={CHART_H} padLeft={PAD_LEFT} padRight={PAD_RIGHT} padBottom={PAD_BOTTOM} />
        <Text style={styles.note}>{note}</Text>
      </Card>

      <Text style={styles.sectionLabel}>Money saved by your habits</Text>
      <Card>
        <ForecastChart chart={savingsChart} color="#1E9E82" chartW={CHART_W} chartH={CHART_H} padLeft={PAD_LEFT} padRight={PAD_RIGHT} padBottom={PAD_BOTTOM} />
        <Text style={styles.note}>{savingsNote}</Text>
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
