import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { Card, HeroMini, PopIn, PrimaryButton } from './ui';
import { useStore } from '../lib/store';
import { computeExtraImpact, computeStreak, earnedTrophies, money, round2, todayKey, TROPHY_MILESTONES } from '../lib/calculations';

function splitIcon(name: string): { icon: string; rest: string } {
  const m = name.match(/^(\p{Extended_Pictographic}️?)\s+(.*)$/u);
  return m ? { icon: m[1], rest: m[2] } : { icon: '💡', rest: name };
}

export default function DailyCheckIn() {
  const { transactions, dailyLogs, toggleDayHabit, adjustHabitTarget, myLoan } = useStore();
  const [dismissedToday, setDismissedToday] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<'ask' | 'reward' | 'miss'>('ask');
  const [spentInput, setSpentInput] = useState('');
  const [lowestInput, setLowestInput] = useState('');
  const [revealStreak, setRevealStreak] = useState(0);
  const [revealTrophy, setRevealTrophy] = useState<string | null>(null);

  const today = todayKey();

  // dismissedToday used to live forever once a habit was answered — nothing
  // ever cleared it, so once you'd said yes/no for a habit it never asked
  // again, even the next real (or fast-forwarded) day. Clear it whenever the
  // day itself changes, so "answered" only means "answered for today".
  const lastSeenDay = useRef(today);
  if (lastSeenDay.current !== today) {
    lastSeenDay.current = today;
    if (Object.keys(dismissedToday).length) setDismissedToday({});
  }

  const dailyHabits = useMemo(() => transactions.filter((t) => t.habitTrackKey && t.habitTrackKey.endsWith(':daily')), [transactions]);

  const current = useMemo(() => {
    return dailyHabits.find((t) => {
      const key = t.habitTrackKey!;
      const answeredYes = !!dailyLogs[today]?.[key];
      return !answeredYes && !dismissedToday[key];
    });
  }, [dailyHabits, dailyLogs, today, dismissedToday]);

  if (!current) return null;

  const trackKey = current.habitTrackKey!;
  const { icon, rest } = splitIcon(current.name.replace(/\s*\((new plan|cancelled)\)$/, ''));
  const dailyTarget = round2(current.amount / 30);
  const dailySaving = round2((current.habitSaving || 0) / 30);
  const dailyActual = round2(dailyTarget + dailySaving);

  function respondYes() {
    toggleDayHabit(today, trackKey);
    const trackKeys = dailyHabits.map((t) => t.habitTrackKey!);
    // dailyLogs hasn't re-rendered with today's entry yet in this closure, so
    // compute the streak as if today were already a win.
    const projectedLogs = { ...dailyLogs, [today]: { ...(dailyLogs[today] || {}), [trackKey]: true } };
    const { current: streak, best } = computeStreak(projectedLogs, trackKeys);
    const justEarned = TROPHY_MILESTONES.find((t) => t.days === best);
    setRevealStreak(streak);
    setRevealTrophy(justEarned ? `${justEarned.icon} ${justEarned.label}` : null);
    setStage('reward');
  }

  function respondNo() {
    setSpentInput(String(dailyActual));
    setLowestInput(String(dailyTarget));
    setStage('miss');
  }

  // Live "you could've saved" figure — today's actual spend minus the
  // realistic target the user is setting, recomputed as either field changes
  // instead of frozen at the moment the popup opened.
  const spentToday = Math.max(0, parseFloat(spentInput) || 0);
  const newTarget = Math.max(0, parseFloat(lowestInput) || 0);
  const missedAmount = round2(Math.max(0, spentToday - newTarget));

  function submitRecalibration() {
    const newDailyTarget = newTarget || dailyTarget;
    const newMonthlyAmount = round2(newDailyTarget * 30);
    const newMonthlySaving = round2(Math.max(0, (dailyActual - newDailyTarget) * 30));
    adjustHabitTarget(trackKey, newMonthlyAmount, newMonthlySaving);
    close();
  }

  function close() {
    setDismissedToday((d) => ({ ...d, [trackKey]: true }));
    setStage('ask');
    setSpentInput('');
    setLowestInput('');
  }

  const monthPace = (current.habitSaving || 0);
  const impact = myLoan ? computeExtraImpact(myLoan.balance, myLoan.rate, myLoan.term, 0, monthPace, 'monthly') : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={() => {}}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {stage === 'ask' && (
            <>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.title}>Did you keep {rest.toLowerCase()} to {money(dailyTarget)} or under today?</Text>
              <View style={styles.row}>
                <Pressable style={[styles.answerBtn, styles.noBtn]} onPress={respondNo}>
                  <Text style={styles.noBtnText}>No</Text>
                </Pressable>
                <Pressable style={[styles.answerBtn, styles.yesBtn]} onPress={respondYes}>
                  <Text style={styles.yesBtnText}>Yes ✓</Text>
                </Pressable>
              </View>
            </>
          )}

          {stage === 'reward' && (
            <>
              <PopIn style={styles.iconWrap}>
                <Text style={styles.icon}>🔥</Text>
              </PopIn>
              <Text style={styles.title}>{revealStreak}-day streak</Text>
              <Text style={styles.subtitle}>Nice work sticking to it today.</Text>
              <View style={styles.row}>
                <HeroMini variant="g-green" label="Saved today" amount={money(dailySaving)} animateValue={dailySaving} style={styles.heroFlex} />
                <HeroMini
                  variant="g-blue"
                  label={impact && impact.interestSaved > 0 ? 'Interest saved' : 'At this pace / mo'}
                  amount={impact && impact.interestSaved > 0 ? money(impact.interestSaved) : money(monthPace)}
                  animateValue={impact && impact.interestSaved > 0 ? impact.interestSaved : monthPace}
                  animateDelay={120}
                  style={styles.heroFlex}
                />
              </View>
              {revealTrophy ? (
                <PopIn delay={400} style={styles.trophyCardWrap}>
                  <Card style={styles.trophyCard}>
                    <Text style={styles.trophyText}>New trophy unlocked: {revealTrophy}</Text>
                  </Card>
                </PopIn>
              ) : null}
              <PrimaryButton title="Keep going" onPress={close} />
            </>
          )}

          {stage === 'miss' && (
            <>
              <Text style={styles.icon}>😬</Text>
              <Text style={styles.title}>You could've saved {money(missedAmount)} today</Text>
              <Text style={styles.subtitle}>No stress — two quick things.</Text>

              <Text style={styles.fieldLabel}>How much did you actually spend on {rest.toLowerCase()} today?</Text>
              <TextInput
                style={styles.input}
                value={spentInput}
                onChangeText={setSpentInput}
                keyboardType="decimal-pad"
                placeholder={String(dailyActual)}
                placeholderTextColor={colors.inkFaint}
              />

              <Text style={styles.fieldLabel}>What's a realistic target to aim for going forward?</Text>
              <TextInput
                style={styles.input}
                value={lowestInput}
                onChangeText={setLowestInput}
                keyboardType="decimal-pad"
                placeholder={String(dailyTarget)}
                placeholderTextColor={colors.inkFaint}
              />

              <PrimaryButton title="Set new target" onPress={submitRecalibration} />
              <Pressable onPress={close} hitSlop={8}>
                <Text style={styles.skipText}>Skip for today</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.55)', justifyContent: 'center', padding: 22 },
  sheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 22, alignItems: 'center' },
  icon: { fontSize: 34 },
  iconWrap: { marginBottom: 10 },
  trophyCardWrap: { width: '100%' },
  title: { fontFamily: fonts.serif, fontSize: 19, color: colors.ink, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.inkDim, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  heroFlex: { flex: 1 },
  answerBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.sm, alignItems: 'center' },
  noBtn: { backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red },
  noBtnText: { color: colors.red, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 15 },
  yesBtn: { backgroundColor: colors.accent },
  yesBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 15 },
  trophyCard: { width: '100%', backgroundColor: colors.mint, marginTop: 14, marginBottom: 4, paddingVertical: 12, alignItems: 'center' },
  trophyText: { color: colors.accentDeep, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14 },
  fieldLabel: { fontSize: 12.5, color: colors.inkDim, fontFamily: fonts.sansSemiBold, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 6, marginTop: 2 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paperWarm,
    fontFamily: fonts.sans,
    textAlign: 'center',
    marginBottom: 14,
  },
  skipText: { marginTop: 14, color: colors.inkFaint, fontSize: 12.5, fontFamily: fonts.sans },
});
