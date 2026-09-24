import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, categoryColors } from '../theme/theme';
import { Card, Chip, EmptyState, HeroResult, PrimaryButton, SectionLabel, SectionLabelRow, PageTitle } from '../components/ui';
import { CheckRow, Field } from '../components/fields';
import AddTransactionSheet from '../components/AddTransactionSheet';
import LoanSheet from '../components/LoanSheet';
import TrackedImpactModal, { TrackedImpact } from '../components/TrackedImpactModal';
import { useStore, habitTrackKeyFn } from '../lib/store';
import { appNow, computeExtraImpact, formatTerm, money, monthlyEquivalent, round2, FREQUENCY_LABELS, FREQUENCY_NOUN } from '../lib/calculations';
import { Goal, HABIT_LABELS, HABIT_PRESET_KEYS, HABITS, HabitMode, MyLoan, SUBSCRIPTIONS, Transaction } from '../lib/types';

type HabitFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly';
const FREQUENCY_OPTIONS: HabitFrequency[] = ['daily', 'weekly', 'fortnightly', 'monthly'];

// "In about 4 months" hides that you're not starting from zero — this spells
// out the remaining time down to the day, not just the nearest month.
function formatMonthsDays(totalMonths: number): string {
  const totalDays = Math.max(0, Math.round(totalMonths * 30));
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  if (months <= 0) return `${days} day${days === 1 ? '' : 's'}`;
  if (days === 0) return `${months} month${months === 1 ? '' : 's'}`;
  return `${months} month${months === 1 ? '' : 's'} and ${days} day${days === 1 ? '' : 's'}`;
}

// Debt-free (or no goal answered yet) keeps the loan-payoff framing; any
// other goal cares about a savings pile, not interest saved, so it gets a
// simple "here's what you've saved, and when you'll get there" projection
// toward that goal instead — `savedSoFar` is what's actually accrued from
// tracked habits to date, not just the future pace.
function goalProjectionDetail(monthlyAmount: number, goal: Goal | null, myLoan: MyLoan | null, savedSoFar: number): string {
  if (goal && goal.type !== 'debt_free') {
    const target = goal.label || 'your goal';
    if (goal.targetAmount && goal.targetAmount > 0) {
      const remaining = Math.max(0, goal.targetAmount - savedSoFar);
      if (remaining <= 0) {
        return `You've saved ${money(savedSoFar)} — that's enough for ${target}!`;
      }
      if (monthlyAmount > 0) {
        const monthsNeeded = remaining / monthlyAmount;
        return `You've saved ${money(savedSoFar)} so far. At this pace, you'll have ${money(goal.targetAmount)} for ${target} in about ${formatMonthsDays(
          monthsNeeded
        )}.`;
      }
      return `You've saved ${money(savedSoFar)} toward ${target} so far — ${money(remaining)} to go once you track a habit.`;
    }
    if (monthlyAmount > 0) {
      return `At this rate, that's ${money(monthlyAmount * 3)} toward ${target} in 3 months, or ${money(monthlyAmount * 12)} in a year.`;
    }
    return savedSoFar > 0 ? `You've saved ${money(savedSoFar)} toward ${target} so far.` : `Track a habit to start saving toward ${target}.`;
  }
  if (myLoan) {
    const impact = computeExtraImpact(myLoan.balance, myLoan.rate, myLoan.term, 0, monthlyAmount, 'monthly');
    return impact.interestSaved > 0
      ? `Based on your loan, paying this in would save ${money(impact.interestSaved)} in interest and clear it ${
          impact.monthsSaved === 0 ? 'sooner' : formatTerm(impact.monthsSaved / 12, true) + ' sooner'
        }.`
      : `Based on your loan, ${money(monthlyAmount)}/mo isn't quite enough yet to show a real interest saving — try a bit more.`;
  }
  return `That's ${money(monthlyAmount * 12)}/year — add your loan above to see what it works out to in interest saved.`;
}

function getPreset(mode: HabitMode, key: string, customHabits: { daily: any[]; subscription: any[] }) {
  const presets = mode === 'daily' ? HABITS : SUBSCRIPTIONS;
  if (key in presets) return presets[key];
  const custom = (customHabits[mode] || []).find((c) => c.key === key);
  return custom ? { now: custom.now, then: custom.then } : { now: 0, then: 0 };
}

// Once a habit is actually tracked, its real ongoing numbers live on the
// tracked transaction (and get updated there by the daily check-in's
// recalibration) — not on the static preset. Without this, the editor kept
// showing the original preset ("you spend $6") even after you'd told the
// check-in your real target was $4.
function trackedOverride(mode: HabitMode, key: string, transactions: Transaction[]): { now: number; then: number } | null {
  if (key === 'other') return null;
  const trackKey = habitTrackKeyFn(key, mode, '');
  const tx = transactions.find((t) => t.habitTrackKey === trackKey);
  if (!tx) return null;
  const monthlyThen = tx.amount;
  const monthlyNow = monthlyThen + (tx.habitSaving || 0);
  return mode === 'daily'
    ? { now: round2(monthlyNow / 30), then: round2(monthlyThen / 30) }
    : { now: round2(monthlyNow), then: round2(monthlyThen) };
}

export default function HomeScreen() {
  const store = useStore();
  const { transactions, dailyLogs, myLoan, customHabits, deleteTransaction, goal } = store;

  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [loanSheetOpen, setLoanSheetOpen] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [trackedImpact, setTrackedImpact] = useState<TrackedImpact | null>(null);

  const [habitMode, setHabitModeState] = useState<HabitMode>('daily');
  const [selectedHabitKey, setSelectedHabitKey] = useState('coffee');
  const [habitNone, setHabitNone] = useState(false);
  const [customName, setCustomName] = useState('');
  const initial = trackedOverride('daily', 'coffee', transactions) || getPreset('daily', 'coffee', customHabits);
  const [nowStr, setNowStr] = useState(String(initial.now));
  const [thenStr, setThenStr] = useState(String(initial.then));
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [cutChoice, setCutChoice] = useState<'20' | '40' | 'custom' | null>(null);
  const [cutCustomOpen, setCutCustomOpen] = useState(false);

  function selectHabit(mode: HabitMode, key: string) {
    setHabitModeState(mode);
    setSelectedHabitKey(key);
    setHabitNone(false);
    setFrequency(mode === 'daily' ? 'daily' : 'monthly');
    setCutChoice(null);
    setCutCustomOpen(false);
    const preset = trackedOverride(mode, key, transactions) || getPreset(mode, key, customHabits);
    setNowStr(String(preset.now));
    setThenStr(String(preset.then));
    if (key !== 'other') setCustomName('');
  }

  function toggleHabitNone() {
    const next = !habitNone;
    setHabitNone(next);
    if (next) {
      setNowStr('0');
      setThenStr('0');
    } else {
      const preset = trackedOverride(habitMode, selectedHabitKey, transactions) || getPreset(habitMode, selectedHabitKey, customHabits);
      setNowStr(String(preset.now));
      setThenStr(String(preset.then));
    }
  }

  function applyCut(pct: number, choice: '20' | '40') {
    setThenStr(String(Math.max(0, Math.round(now * (1 - pct)))));
    setCutChoice(choice);
    setCutCustomOpen(false);
  }

  function currentHabitLabel(): string {
    if (selectedHabitKey === 'other') {
      return customName.trim() || (habitMode === 'daily' ? 'Custom habit' : 'Custom subscription');
    }
    const custom = (customHabits[habitMode] || []).find((c) => c.key === selectedHabitKey);
    if (custom) return custom.label;
    return HABIT_LABELS[selectedHabitKey] || selectedHabitKey;
  }

  function confirmCustomHabit() {
    const label = customName.trim();
    if (!label) return;
    const now = parseFloat(nowStr) || 0;
    const then = parseFloat(thenStr) || 0;
    const key = 'custom_' + Date.now();
    store.addCustomHabit(habitMode, { key, label, now, then });
    setSelectedHabitKey(key);
    setNowStr(String(now));
    setThenStr(String(then));
  }

  const now = parseFloat(nowStr) || 0;
  const then = parseFloat(thenStr) || 0;
  const saving = Math.max(0, now - then);
  const monthlySaving = monthlyEquivalent(saving, frequency);
  const freqNoun = FREQUENCY_NOUN[frequency];
  const label = currentHabitLabel();
  const tracked = store.isHabitTracked(selectedHabitKey, habitMode, label);

  // What's actually accrued so far from tracked habits — daily habits count
  // each day actually logged done; subscriptions accrue continuously since
  // the day they were tracked. This is what makes the goal projection say
  // "you've saved $X so far" instead of projecting from zero every time.
  const lifetimeSaved = useMemo(() => {
    const now = appNow().getTime();
    let total = 0;
    for (const t of transactions) {
      if (!t.habitTrackKey || !t.habitSaving) continue;
      if (t.habitTrackKey.endsWith(':daily')) {
        const daysLogged = Object.values(dailyLogs).filter((day) => day[t.habitTrackKey!]).length;
        total += daysLogged * (t.habitSaving / 30);
      } else {
        const elapsedDays = Math.max(0, (now - new Date(t.date).getTime()) / 86400000);
        total += elapsedDays * (t.habitSaving / 30);
      }
    }
    return round2(total);
  }, [transactions, dailyLogs]);

  const habitDetail = useMemo(() => {
    if (saving <= 0) {
      return habitNone
        ? "Nothing to save here — you're already not spending on this."
        : habitMode === 'daily'
        ? 'Try spending less than you do now to see the saving.'
        : 'Pick a cheaper plan (or $0 to cancel) to see the saving.';
    }
    return goalProjectionDetail(monthlySaving, goal, myLoan, lifetimeSaved);
  }, [saving, habitNone, habitMode, monthlySaving, myLoan, goal, lifetimeSaved]);

  // ---------- Combined "You're saving" hero ----------
  const savingsHero = useMemo(() => {
    const trackedTxs = transactions.filter((t) => t.habitTrackKey);
    const trackedTotal = trackedTxs.reduce((s, t) => s + (t.habitSaving || 0), 0);
    const previewCounts = !tracked && monthlySaving > 0 && !(selectedHabitKey === 'other' && !customName.trim());
    const total = trackedTotal + (previewCounts ? monthlySaving : 0);
    if (total <= 0) return null;
    const detail = goalProjectionDetail(total, goal, myLoan, lifetimeSaved);
    return { total, detail };
  }, [transactions, tracked, monthlySaving, selectedHabitKey, customName, myLoan, goal, lifetimeSaved]);

  function trackHabit() {
    if (habitNone) return;
    if (now - then <= 0) return;
    if (tracked) return;
    const monthlySpend = monthlyEquivalent(then, frequency);
    store.trackHabit({ key: selectedHabitKey, mode: habitMode, label, monthlySpend, monthlySaving });
    setTrackedImpact({
      label,
      monthlySaving,
      impact: myLoan ? computeExtraImpact(myLoan.balance, myLoan.rate, myLoan.term, 0, monthlySaving, 'monthly') : null,
    });
  }

  function untrackHabit() {
    const trackKey = habitTrackKeyFn(selectedHabitKey, habitMode, label);
    const tx = transactions.find((t) => t.habitTrackKey === trackKey);
    if (tx) deleteTransaction(tx.id);
  }

  const trackBtnLabel = habitNone
    ? "Nothing to track — you don't do this"
    : tracked
    ? '✓ Tracking — tap to stop'
    : 'Track this — add to my monthly spending';
  const trackBtnDisabled = habitNone;

  // ---------- Balance / recent / categories ----------
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const recentList = showAllRecent ? transactions : transactions.slice(0, 5);

  const byCategory: Record<string, number> = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => (byCategory[t.category] = (byCategory[t.category] || 0) + t.amount));
  const catTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const pickerKeys = HABIT_PRESET_KEYS[habitMode];
  const customList = customHabits[habitMode] || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paperWarm }}>
      <ScrollView contentContainerStyle={styles.screen}>
        <PageTitle>Home</PageTitle>

        {savingsHero ? (
          <>
            <SectionLabel style={{ marginTop: 0 }}>
              {goal && goal.type !== 'debt_free' ? `You're saving — toward ${goal.label || 'your goal'}` : "You're saving"}
            </SectionLabel>
            <HeroResult variant="g-green" label="Every month" amount={money(savingsHero.total) + '/mo'} sub={savingsHero.detail} />
          </>
        ) : null}

        <SectionLabel style={savingsHero ? undefined : { marginTop: 0 }}>Everyday habit</SectionLabel>
        <Card style={styles.habitCard}>
          <View style={styles.habitModeToggle}>
            <Pressable
              style={[styles.habitModeBtn, habitMode === 'daily' && styles.habitModeBtnExpenseActive]}
              onPress={() => selectHabit('daily', 'coffee')}
            >
              <Text style={[styles.habitModeText, habitMode === 'daily' && styles.habitModeExpenseActiveText]}>Everyday habit</Text>
            </Pressable>
            <Pressable
              style={[styles.habitModeBtn, habitMode === 'subscription' && styles.habitModeBtnIncomeActive]}
              onPress={() => selectHabit('subscription', 'netflix')}
            >
              <Text style={[styles.habitModeText, habitMode === 'subscription' && styles.habitModeIncomeActiveText]}>Subscriptions</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {pickerKeys.map((k) => (
              <Chip key={k} label={HABIT_LABELS[k]} active={selectedHabitKey === k} onPress={() => selectHabit(habitMode, k)} />
            ))}
            {customList.map((c) => (
              <Chip key={c.key} label={`✏️ ${c.label}`} active={selectedHabitKey === c.key} onPress={() => selectHabit(habitMode, c.key)} />
            ))}
            <Chip label="➕ Other" active={selectedHabitKey === 'other'} onPress={() => selectHabit(habitMode, 'other')} />
          </ScrollView>

          {selectedHabitKey === 'other' ? (
            <Field
              label="What is it called?"
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Uber Eats, Gym membership"
              keyboardType="default"
            />
          ) : null}

          <HeroResult variant="g-green" label="You'd save" amount={money(monthlySaving) + '/mo'} sub={habitDetail} style={{ marginBottom: 12 }} />

          <CheckRow label="I don't do this" checked={habitNone} onToggle={toggleHabitNone} />

          <View style={styles.freqRow}>
            {FREQUENCY_OPTIONS.map((f) => (
              <Chip key={f} label={FREQUENCY_LABELS[f]} active={frequency === f} onPress={() => setFrequency(f)} />
            ))}
          </View>

          <View style={styles.spendEditor}>
            <Field
              label={habitMode === 'daily' ? `You spend now (per ${freqNoun})` : `Your current plan (per ${freqNoun})`}
              value={nowStr}
              onChangeText={(v) => {
                setNowStr(v);
                setCutChoice(null);
              }}
            />

            <View style={styles.editorDivider} />

            <Text style={styles.cutLabel}>
              {habitMode === 'daily' ? `Try spending (per ${freqNoun})` : `Downgrade to, or cancel (per ${freqNoun})`}
            </Text>
            <View style={styles.cutRow}>
              <Pressable
                style={[styles.cutBtn, cutChoice === '20' && styles.cutBtnActive]}
                onPress={() => applyCut(0.2, '20')}
              >
                <Text style={[styles.cutBtnText, cutChoice === '20' && styles.cutBtnTextActive]}>20% less</Text>
                <Text style={[styles.cutBtnAmt, cutChoice === '20' && styles.cutBtnTextActive]}>{money(now * 0.8)}</Text>
              </Pressable>
              <Pressable
                style={[styles.cutBtn, cutChoice === '40' && styles.cutBtnActive]}
                onPress={() => applyCut(0.4, '40')}
              >
                <Text style={[styles.cutBtnText, cutChoice === '40' && styles.cutBtnTextActive]}>40% less</Text>
                <Text style={[styles.cutBtnAmt, cutChoice === '40' && styles.cutBtnTextActive]}>{money(now * 0.6)}</Text>
              </Pressable>
              <Pressable
                style={[styles.cutBtn, cutChoice === 'custom' && styles.cutBtnActive]}
                onPress={() => {
                  setCutChoice('custom');
                  setCutCustomOpen(true);
                }}
              >
                <Text style={[styles.cutBtnText, cutChoice === 'custom' && styles.cutBtnTextActive]}>Custom</Text>
                <Text style={[styles.cutBtnAmt, cutChoice === 'custom' && styles.cutBtnTextActive]}>Your number</Text>
              </Pressable>
            </View>

            {cutCustomOpen ? (
              <Field label={`Your number (per ${freqNoun})`} value={thenStr} onChangeText={setThenStr} />
            ) : (
              <Text style={styles.cutPreview}>
                {saving > 0
                  ? `That's ${money(then)} per ${freqNoun} — a saving of ${money(saving)} per ${freqNoun}.`
                  : `Pick a lower amount above to see your saving.`}
              </Text>
            )}
          </View>

          <PrimaryButton
            title={selectedHabitKey === 'other' && customName.trim() ? 'Save this custom habit, then track it' : trackBtnLabel}
            onPress={() => {
              if (tracked) {
                untrackHabit();
                return;
              }
              if (selectedHabitKey === 'other' && customName.trim() && !customList.some((c) => c.label === customName.trim())) {
                confirmCustomHabit();
              }
              trackHabit();
            }}
            disabled={trackBtnDisabled}
          />
          {tracked ? <Text style={styles.untrackHint}>Tap again to stop tracking this habit.</Text> : null}
        </Card>

        {myLoan ? (
          <Pressable style={styles.loanCard} onPress={() => setLoanSheetOpen(true)}>
            <View>
              <Text style={styles.loanCardTitle}>{money(myLoan.balance)} loan at {myLoan.rate}%</Text>
              <Text style={styles.loanCardSub}>Used to work out the interest saved above</Text>
            </View>
            <View style={styles.loanCardBtn}>
              <Text style={styles.loanCardBtnText}>Edit</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable style={styles.loanCard} onPress={() => setLoanSheetOpen(true)}>
            <View>
              <Text style={styles.loanCardTitle}>Add your loan</Text>
              <Text style={styles.loanCardSub}>Optional — see habits in real interest saved, not just dollars</Text>
            </View>
            <View style={styles.loanCardBtn}>
              <Text style={styles.loanCardBtnText}>Add</Text>
            </View>
          </Pressable>
        )}

        <SectionLabel>Your balance</SectionLabel>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLbl}>Current balance</Text>
          <Text style={styles.balanceAmt}>{money(balance)}</Text>
          <Text style={styles.balanceSub}>
            {transactions.length ? `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} logged` : 'Add your first transaction to get started'}
          </Text>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>Income this month</Text>
            <Text style={[styles.statAmt, { color: colors.accentDeep }]}>{money(income)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLbl}>Spent this month</Text>
            <Text style={[styles.statAmt, { color: colors.red }]}>{money(expense)}</Text>
          </View>
        </View>

        <SectionLabelRow label="Recent" action={transactions.length > 5 ? (showAllRecent ? 'Show less' : 'Show all') : undefined} onPress={() => setShowAllRecent(!showAllRecent)} />
        {transactions.length > 0 ? <Text style={styles.editHint}>Tap any transaction to edit it — like when your salary changes.</Text> : null}
        {transactions.length === 0 ? (
          <EmptyState small text="Nothing added yet — tap + to log your first transaction" />
        ) : (
          <View>
            {recentList.map((t) => (
              <Pressable
                key={t.id}
                style={styles.txItem}
                onPress={() => {
                  setEditingTx(t);
                  setTxSheetOpen(true);
                }}
              >
                <View style={[styles.txIcon, { backgroundColor: t.type === 'income' ? colors.accentSoft : colors.redSoft }]}>
                  <Text>{t.type === 'income' ? '↓' : '↑'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txName}>{t.name}</Text>
                  <Text style={styles.txMeta}>
                    {t.category}
                    {t.recurring ? ` · ${t.frequency ? t.frequency[0].toUpperCase() + t.frequency.slice(1) : 'Monthly'}` : ''}
                  </Text>
                </View>
                <Text style={[styles.txAmt, { color: t.type === 'income' ? colors.accentDeep : colors.red }]}>
                  {t.type === 'income' ? '+' : '-'}
                  {money(t.amount)}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteTransaction(t.id);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.txDelete}>×</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        <SectionLabel>Spending by category</SectionLabel>
        {sortedCats.length === 0 ? (
          <EmptyState small text="No expenses logged yet" />
        ) : (
          <View>
            {sortedCats.map(([cat, amt], i) => (
              <View key={cat} style={{ marginBottom: 12 }}>
                <View style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: categoryColors[i % categoryColors.length] }]} />
                  <Text style={styles.catName}>{cat}</Text>
                  <Text style={styles.catAmt}>{money(amt)}</Text>
                </View>
                <View style={styles.catBarTrack}>
                  <View
                    style={[
                      styles.catBarFill,
                      { width: `${Math.round((amt / catTotal) * 100)}%` as `${number}%`, backgroundColor: categoryColors[i % categoryColors.length] },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        hitSlop={8}
        onPress={() => setTxSheetOpen(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <AddTransactionSheet
        visible={txSheetOpen}
        editingTx={editingTx}
        onClose={() => {
          setTxSheetOpen(false);
          setEditingTx(null);
        }}
      />
      <LoanSheet visible={loanSheetOpen} onClose={() => setLoanSheetOpen(false)} />
      <TrackedImpactModal visible={!!trackedImpact} data={trackedImpact} onClose={() => setTrackedImpact(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, paddingTop: 20, paddingBottom: 110, maxWidth: 520, width: '100%', alignSelf: 'center' },
  habitCard: { marginBottom: 18 },
  habitModeToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  habitModeBtn: { flex: 1, paddingVertical: 11, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paperWarm, alignItems: 'center' },
  habitModeBtnExpenseActive: { backgroundColor: colors.redSoft, borderColor: colors.red },
  habitModeBtnIncomeActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  habitModeText: { fontSize: 14, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  habitModeExpenseActiveText: { color: colors.red },
  habitModeIncomeActiveText: { color: colors.accentDeep },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  // Groups "you spend now" + "try spending" into one visually distinct block
  // (its own card, its own background) instead of the two fields just
  // floating loose against the page — that's what was reading as cramped.
  spendEditor: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 16,
  },
  editorDivider: { height: 1, backgroundColor: colors.line, marginTop: -2, marginBottom: 14 },
  cutLabel: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim, marginBottom: 8, marginTop: 2 },
  cutRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cutBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: colors.paperWarm,
  },
  cutBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  cutBtnText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  cutBtnAmt: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.ink, marginTop: 2 },
  cutBtnTextActive: { color: '#fff' },
  cutPreview: { fontSize: 12.5, color: colors.inkFaint, marginBottom: 14, lineHeight: 17 },
  untrackHint: { fontSize: 11.5, color: colors.inkFaint, textAlign: 'center', marginTop: 8 },
  loanCard: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  loanCardTitle: { fontSize: 14, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.ink },
  loanCardSub: { fontSize: 12.5, color: colors.inkFaint, marginTop: 2 },
  loanCardBtn: { borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.lineStrong },
  loanCardBtnText: { fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.accentDeep },
  balanceCard: { backgroundColor: colors.mint, borderRadius: radii.xxl, padding: 28, paddingHorizontal: 24, marginBottom: 18 },
  balanceLbl: { fontSize: 13, color: colors.accentDeep, fontFamily: fonts.sansSemiBold, fontWeight: '600', marginBottom: 6 },
  balanceAmt: { fontFamily: fonts.serif, fontSize: 40, color: colors.ink },
  balanceSub: { fontSize: 13, color: colors.inkDim, marginTop: 6 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 16 },
  statLbl: { fontSize: 12, color: colors.inkFaint, marginBottom: 4 },
  statAmt: { fontFamily: fonts.serif, fontSize: 22 },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  txIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txName: { fontSize: 14.5, fontFamily: fonts.sansMedium, fontWeight: '500', color: colors.ink },
  txMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  txAmt: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  txDelete: { color: colors.inkFaint, fontSize: 20, paddingHorizontal: 6 },
  editHint: { fontSize: 11.5, color: colors.inkFaint, marginTop: -6, marginBottom: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: 14.5, color: colors.ink },
  catAmt: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.ink },
  catBarTrack: { height: 6, backgroundColor: colors.line, borderRadius: 4, overflow: 'hidden', marginTop: 6 },
  catBarFill: { height: '100%', borderRadius: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.paperWarm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { backgroundColor: colors.inkDim, transform: [{ scale: 0.94 }] },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
});
