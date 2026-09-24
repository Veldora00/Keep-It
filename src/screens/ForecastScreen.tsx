import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  renderHeight,
  padLeft,
  padRight,
  padBottom,
}: {
  chart: ChartData;
  color: string;
  chartW: number;
  chartH: number;
  renderHeight: number;
  padLeft: number;
  padRight: number;
  padBottom: number;
}) {
  return (
    <Svg width="100%" height={renderHeight} viewBox={`0 0 ${chartW} ${chartH}`}>
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
  // Two charts side by side only when there's actually room to read them —
  // on a phone-width screen that squeezes each chart's $ labels unreadable,
  // so below the breakpoint they stay stacked full-width instead.
  const { width: windowW, height: windowH } = useWindowDimensions();
  const sideBySide = windowW >= 700;
  // Tapping a chart (especially cramped in the side-by-side layout) opens it
  // full-screen instead — a real "look closer" view, not just a bigger card.
  const [expanded, setExpanded] = useState<'balance' | 'savings' | null>(null);

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

  // The SVG's viewBox is a fixed 400x220 (coordinates for the chart math
  // above), but its actual rendered pixel size needs to match whatever room
  // it really has — full card width when stacked, half when side by side —
  // or it renders squashed/stretched instead of keeping its shape.
  const SCREEN_PAD = 36; // 18 either side, see `screen` style below
  const CARD_PAD = 40; // 20 either side, see Card's own style
  const GAP = 14;
  const contentW = Math.min(windowW, 520) - SCREEN_PAD;
  const chartAreaW = sideBySide ? (contentW - GAP) / 2 - CARD_PAD : contentW - CARD_PAD;
  const renderedChartH = Math.round(chartAreaW * (CHART_H / CHART_W));

  // The full-screen view gets the whole window width to work with (minus its
  // own card), capped so it never blows past a sensible chunk of the
  // screen's height on a short/landscape phone.
  const expandedAreaW = windowW - SCREEN_PAD - CARD_PAD;
  const expandedRenderedH = Math.min(Math.round(expandedAreaW * (CHART_H / CHART_W)), Math.round(windowH * 0.5));

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

      <View style={sideBySide ? styles.chartsRow : undefined}>
        <View style={sideBySide ? styles.chartsHalf : undefined}>
          <Text style={styles.sectionLabel}>Overall balance</Text>
          <Pressable onPress={() => setExpanded('balance')}>
            <Card>
              <ForecastChart
                chart={chart}
                color="#1E9E82"
                chartW={CHART_W}
                chartH={CHART_H}
                renderHeight={renderedChartH}
                padLeft={PAD_LEFT}
                padRight={PAD_RIGHT}
                padBottom={PAD_BOTTOM}
              />
              <Text style={styles.note}>{note}</Text>
              <Text style={styles.expandHint}>Tap to view full-screen ⤢</Text>
            </Card>
          </Pressable>
        </View>

        <View style={sideBySide ? styles.chartsHalf : undefined}>
          <Text style={styles.sectionLabel}>Money saved by your habits</Text>
          <Pressable onPress={() => setExpanded('savings')}>
            <Card>
              <ForecastChart
                chart={savingsChart}
                color="#1E9E82"
                chartW={CHART_W}
                chartH={CHART_H}
                renderHeight={renderedChartH}
                padLeft={PAD_LEFT}
                padRight={PAD_RIGHT}
                padBottom={PAD_BOTTOM}
              />
              <Text style={styles.note}>{savingsNote}</Text>
              <Text style={styles.expandHint}>Tap to view full-screen ⤢</Text>
            </Card>
          </Pressable>
        </View>
      </View>

      <Modal visible={!!expanded} transparent animationType="fade" onRequestClose={() => setExpanded(null)}>
        <Pressable style={styles.expandOverlay} onPress={() => setExpanded(null)}>
          <Pressable style={styles.expandSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.expandHeader}>
              <Text style={styles.expandTitle}>{expanded === 'balance' ? 'Overall balance' : 'Money saved by your habits'}</Text>
              <Pressable onPress={() => setExpanded(null)} hitSlop={10}>
                <Text style={styles.expandClose}>✕</Text>
              </Pressable>
            </View>
            {expanded ? (
              <ForecastChart
                chart={expanded === 'balance' ? chart : savingsChart}
                color="#1E9E82"
                chartW={CHART_W}
                chartH={CHART_H}
                renderHeight={expandedRenderedH}
                padLeft={PAD_LEFT}
                padRight={PAD_RIGHT}
                padBottom={PAD_BOTTOM}
              />
            ) : null}
            <Text style={styles.note}>{expanded === 'balance' ? note : savingsNote}</Text>
          </Pressable>
        </Pressable>
      </Modal>

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
  expandHint: { fontSize: 11, color: colors.inkFaint, marginTop: 10, textAlign: 'center' },
  chartsRow: { flexDirection: 'row', gap: 14 },
  chartsHalf: { flex: 1, minWidth: 0 },
  expandOverlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.6)', justifyContent: 'center', padding: 16 },
  expandSheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 18, width: '100%', maxWidth: 640, alignSelf: 'center' },
  expandHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  expandTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.ink },
  expandClose: { fontSize: 18, color: colors.inkFaint, paddingHorizontal: 6 },
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
