import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { Card, PrimaryButton } from './ui';
import { useStore } from '../lib/store';
import { computeStreak, earnedTrophies, money, round2, todayKey, TROPHY_MILESTONES } from '../lib/calculations';
import { Transaction } from '../lib/types';

function splitIcon(name: string): { icon: string; rest: string } {
  const m = name.match(/^(\p{Extended_Pictographic}️?)\s+(.*)$/u);
  return m ? { icon: m[1], rest: m[2] } : { icon: '💡', rest: name };
}

// Everything about a habit that's the same whether it's being asked about
// or being recalibrated — computed once per habit instead of duplicated at
// every call site.
function habitFigures(t: Transaction) {
  const dailyTarget = round2(t.amount / 30);
  const dailySaving = round2((t.habitSaving || 0) / 30);
  const dailyActual = round2(dailyTarget + dailySaving);
  return { dailyTarget, dailySaving, dailyActual };
}

export default function DailyCheckIn() {
  const { transactions, dailyLogs, toggleDayHabit, adjustHabitTarget } = useStore();
  const [dismissedToday, setDismissedToday] = useState<Record<string, boolean>>({});
  // Which rows have their "what did you actually spend / what's realistic"
  // form open — several can be open in parallel, one per habit.
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [spentInputs, setSpentInputs] = useState<Record<string, string>>({});
  const [lowestInputs, setLowestInputs] = useState<Record<string, string>>({});

  const today = todayKey();

  // dismissedToday used to live forever once a habit was answered — nothing
  // ever cleared it, so once you'd said yes/no for a habit it never asked
  // again, even the next real (or fast-forwarded) day. Clear it whenever the
  // day itself changes, so "answered" only means "answered for today".
  const lastSeenDay = useRef(today);
  if (lastSeenDay.current !== today) {
    lastSeenDay.current = today;
    if (Object.keys(dismissedToday).length) setDismissedToday({});
    if (Object.keys(openRows).length) setOpenRows({});
  }

  const dailyHabits = useMemo(() => transactions.filter((t) => t.habitTrackKey && t.habitTrackKey.endsWith(':daily')), [transactions]);

  // Every habit still waiting on an answer today — all of them at once, not
  // one at a time, so a fast-forward that skipped several days doesn't leave
  // you clicking through a sequence of separate popups.
  const pending = useMemo(() => {
    return dailyHabits.filter((t) => {
      const key = t.habitTrackKey!;
      const answeredYes = !!dailyLogs[today]?.[key];
      return !answeredYes && !dismissedToday[key];
    });
  }, [dailyHabits, dailyLogs, today, dismissedToday]);

  if (pending.length === 0) return null;

  function dismiss(trackKey: string) {
    setDismissedToday((d) => ({ ...d, [trackKey]: true }));
    setOpenRows((o) => ({ ...o, [trackKey]: false }));
  }

  function respondYes(t: Transaction) {
    toggleDayHabit(today, t.habitTrackKey!);
  }

  function openNoForm(t: Transaction) {
    const { dailyActual, dailyTarget } = habitFigures(t);
    const key = t.habitTrackKey!;
    setSpentInputs((s) => ({ ...s, [key]: String(dailyActual) }));
    setLowestInputs((l) => ({ ...l, [key]: String(dailyTarget) }));
    setOpenRows((o) => ({ ...o, [key]: true }));
  }

  function submitRecalibration(t: Transaction) {
    const key = t.habitTrackKey!;
    const { dailyActual, dailyTarget } = habitFigures(t);
    const newTarget = Math.max(0, parseFloat(lowestInputs[key]) || 0) || dailyTarget;
    const newMonthlyAmount = round2(newTarget * 30);
    const newMonthlySaving = round2(Math.max(0, (dailyActual - newTarget) * 30));
    adjustHabitTarget(key, newMonthlyAmount, newMonthlySaving);
    dismiss(key);
  }

  // Streak preview — computed as if every still-pending habit that already
  // got a "Yes" this render were logged, so the header number feels live as
  // you work through the list instead of only updating after the modal closes.
  const trackKeys = dailyHabits.map((t) => t.habitTrackKey!);
  const { current: streak, best } = computeStreak(dailyLogs, trackKeys);
  const justEarned = TROPHY_MILESTONES.find((tr) => tr.days === best);
  const trophies = earnedTrophies(best);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {pending.length === 1 ? "How'd today go?" : `How'd today go? (${pending.length} to check in on)`}
          </Text>
          {trophies.length > 0 && justEarned ? (
            <Card style={styles.trophyCard}>
              <Text style={styles.trophyText}>🎉 New trophy: {justEarned.icon} {justEarned.label} — {streak}-day streak!</Text>
            </Card>
          ) : null}

          <ScrollView style={styles.rowScroll} contentContainerStyle={{ paddingBottom: 4 }}>
            {pending.map((t) => {
              const key = t.habitTrackKey!;
              const { icon, rest } = splitIcon(t.name.replace(/\s*\((new plan|cancelled)\)$/, ''));
              const { dailyTarget, dailyActual } = habitFigures(t);
              const isOpen = !!openRows[key];
              const spentToday = Math.max(0, parseFloat(spentInputs[key] ?? '') || 0);
              const newTarget = Math.max(0, parseFloat(lowestInputs[key] ?? '') || 0);
              const missedAmount = round2(Math.max(0, spentToday - newTarget));

              return (
                <View key={key} style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowIcon}>{icon}</Text>
                    <Text style={styles.rowQuestion}>
                      Keep {rest.toLowerCase()} to {money(dailyTarget)} or under today?
                    </Text>
                  </View>

                  {!isOpen ? (
                    <View style={styles.answerRow}>
                      <Pressable style={[styles.answerBtn, styles.noBtn]} onPress={() => openNoForm(t)}>
                        <Text style={styles.noBtnText}>No</Text>
                      </Pressable>
                      <Pressable style={[styles.answerBtn, styles.yesBtn]} onPress={() => respondYes(t)}>
                        <Text style={styles.yesBtnText}>Yes ✓</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.missBox}>
                      <Text style={styles.missTitle}>You could've saved {money(missedAmount)} today</Text>

                      <Text style={styles.fieldLabel}>Actually spent today?</Text>
                      <TextInput
                        style={styles.input}
                        value={spentInputs[key] ?? ''}
                        onChangeText={(v) => setSpentInputs((s) => ({ ...s, [key]: v }))}
                        keyboardType="decimal-pad"
                        placeholder={String(dailyActual)}
                        placeholderTextColor={colors.inkFaint}
                      />

                      <Text style={styles.fieldLabel}>Realistic target going forward?</Text>
                      <TextInput
                        style={styles.input}
                        value={lowestInputs[key] ?? ''}
                        onChangeText={(v) => setLowestInputs((l) => ({ ...l, [key]: v }))}
                        keyboardType="decimal-pad"
                        placeholder={String(dailyTarget)}
                        placeholderTextColor={colors.inkFaint}
                      />

                      <PrimaryButton title="Set new target" onPress={() => submitRecalibration(t)} />
                      <Pressable onPress={() => dismiss(key)} hitSlop={8}>
                        <Text style={styles.skipText}>Skip for today</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.55)', justifyContent: 'center', padding: 22 },
  sheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 20, alignItems: 'stretch', maxHeight: '85%', width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, textAlign: 'center', marginBottom: 12 },
  trophyCard: { backgroundColor: colors.mint, marginBottom: 12, paddingVertical: 12, alignItems: 'center' },
  trophyText: { color: colors.accentDeep, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  rowScroll: { flexGrow: 0 },
  row: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 14 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rowIcon: { fontSize: 22 },
  rowQuestion: { flex: 1, fontSize: 14.5, color: colors.ink, fontFamily: fonts.sansMedium, fontWeight: '500', lineHeight: 19 },
  answerRow: { flexDirection: 'row', gap: 10 },
  answerBtn: { flex: 1, paddingVertical: 12, borderRadius: radii.sm, alignItems: 'center' },
  noBtn: { backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red },
  noBtnText: { color: colors.red, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14 },
  yesBtn: { backgroundColor: colors.accent },
  yesBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14 },
  missBox: { backgroundColor: colors.paperWarm, borderRadius: radii.md, padding: 14 },
  missTitle: { fontFamily: fonts.serif, fontSize: 15.5, color: colors.ink, textAlign: 'center', marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: colors.inkDim, fontFamily: fonts.sansSemiBold, fontWeight: '600', marginBottom: 6 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
    fontFamily: fonts.sans,
    textAlign: 'center',
    marginBottom: 12,
  },
  skipText: { marginTop: 10, color: colors.inkFaint, fontSize: 12.5, fontFamily: fonts.sans, textAlign: 'center' },
});
