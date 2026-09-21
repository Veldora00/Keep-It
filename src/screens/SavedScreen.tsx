import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { Card, EmptyState, HeroResult, PageTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { computeExtraImpact, money } from '../lib/calculations';

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function splitHabitIcon(fullName: string): { icon: string; name: string } {
  const m = fullName.match(/^(\p{Extended_Pictographic}️?)\s+(.*)$/u);
  return m ? { icon: m[1], name: m[2] } : { icon: '💡', name: fullName };
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function SavedScreen() {
  const { transactions, dailyLogs, toggleDayHabit, myLoan } = useStore();
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dailyHabits = useMemo(() => transactions.filter((t) => t.habitTrackKey && t.habitTrackKey.endsWith(':daily')), [transactions]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();

  let monthTotal = 0;
  const cells: { key: string | null; day: number | null; logged: boolean; isToday: boolean; isFuture: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ key: null, day: null, logged: false, isToday: false, isFuture: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(year, month, d);
    const log = dailyLogs[key] || {};
    const loggedHabits = dailyHabits.filter((t) => log[t.habitTrackKey!]);
    const daySaved = loggedHabits.reduce((s, t) => s + (t.habitSaving || 0) / 30, 0);
    monthTotal += daySaved;
    cells.push({ key, day: d, logged: loggedHabits.length > 0, isToday: key === today, isFuture: key > today });
  }

  const loanDetail = useMemo(() => {
    if (dailyHabits.length === 0) return 'Track an everyday habit to start logging days.';
    if (myLoan && monthTotal > 0) {
      const impact = computeExtraImpact(myLoan.balance, myLoan.rate, myLoan.term, 0, monthTotal, 'once');
      return impact.interestSaved > 0 ? `Based on your loan, paying this in would save ${money(impact.interestSaved)} in interest.` : 'Tap a day below to log which habits you stuck to.';
    }
    return 'Tap a day below to log which habits you stuck to.';
  }, [dailyHabits.length, myLoan, monthTotal]);

  const selectedLog = selectedDate ? dailyLogs[selectedDate] || {} : {};
  const selectedLabel = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dObj = new Date(y, m - 1, d);
        const lbl = dObj.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
        return (selectedDate === today ? 'Today — ' : '') + lbl;
      })()
    : '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paperWarm }} contentContainerStyle={styles.screen}>
      <PageTitle>Saved</PageTitle>

      <HeroResult variant="g-green" label="Optimized this month" amount={money(dailyHabits.length ? monthTotal : 0)} sub={loanDetail} style={{ marginBottom: 18 }} />

      {dailyHabits.length === 0 ? (
        <EmptyState text="Track an everyday habit on Home first, then log the days you stuck to it here." />
      ) : (
        <>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => {
                setViewDate(new Date(year, month - 1, 1));
                setSelectedDate(null);
              }}
            >
              <Text style={styles.navBtn}>‹ Prev</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              onPress={() => {
                setViewDate(new Date(year, month + 1, 1));
                setSelectedDate(null);
              }}
            >
              <Text style={styles.navBtn}>Next ›</Text>
            </Pressable>
          </View>

          <Card>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((c, i) =>
                c.day === null ? (
                  <View key={i} style={styles.cell} />
                ) : (
                  <Pressable
                    key={i}
                    disabled={c.isFuture}
                    onPress={() => setSelectedDate(c.key)}
                    style={[
                      styles.cell,
                      styles.cellBox,
                      c.isToday && styles.cellToday,
                      c.logged && styles.cellLogged,
                      selectedDate === c.key && styles.cellSelected,
                      c.isFuture && { opacity: 0.35 },
                    ]}
                  >
                    <Text style={[styles.cellDay, c.logged && { color: colors.accentDeep }]}>{c.day}</Text>
                    {c.logged ? <View style={styles.cellDot} /> : null}
                  </Pressable>
                )
              )}
            </View>
          </Card>

          {selectedDate ? (
            <Card style={{ marginTop: 4 }}>
              <Text style={styles.dayTitle}>{selectedLabel}</Text>
              {dailyHabits.map((t) => {
                const { icon, name } = splitHabitIcon(t.name);
                const done = !!selectedLog[t.habitTrackKey!];
                const daily = (t.habitSaving || 0) / 30;
                return (
                  <Pressable key={t.id} style={styles.habitRow} onPress={() => toggleDayHabit(selectedDate, t.habitTrackKey!)}>
                    <Text style={styles.habitRowName}>
                      {icon} {name}
                    </Text>
                    <Text style={[styles.habitRowCheck, done && { color: colors.accentDeep }]}>{done ? '✓ +' + money(daily) : 'Mark done'}</Text>
                  </Pressable>
                );
              })}
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const CELL_SIZE = '13.5%';

const styles = StyleSheet.create({
  screen: { padding: 18, paddingTop: 20, paddingBottom: 110, maxWidth: 520, width: '100%', alignSelf: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { color: colors.accentDeep, fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  monthLabel: { fontSize: 13, fontFamily: fonts.sansBold, fontWeight: '700', color: colors.inkDim, textTransform: 'uppercase', letterSpacing: 0.4 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  weekday: { width: CELL_SIZE, textAlign: 'center', fontSize: 11, fontFamily: fonts.sansBold, fontWeight: '700', color: colors.inkFaint, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  cell: { width: CELL_SIZE, aspectRatio: 1 },
  cellBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellToday: { borderColor: colors.ink, borderWidth: 1.5 },
  cellSelected: { borderColor: colors.accentDeep, borderWidth: 2 },
  cellLogged: { backgroundColor: colors.accentSoft },
  cellDay: { fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  cellDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentDeep },
  dayTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.ink, marginBottom: 8 },
  habitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  habitRowName: { fontSize: 14.5, color: colors.ink },
  habitRowCheck: { fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkFaint },
});
