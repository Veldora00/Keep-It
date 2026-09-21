import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, categoryColors } from '../theme/theme';
import { Card, Chip, EmptyState, HeroResult, PrimaryButton, SectionLabel, SectionLabelRow, PageTitle } from '../components/ui';
import { CheckRow, Field, FieldGrid } from '../components/fields';
import AddTransactionSheet from '../components/AddTransactionSheet';
import LoanSheet from '../components/LoanSheet';
import { useStore, habitTrackKeyFn } from '../lib/store';
import { computeExtraImpact, formatTerm, money } from '../lib/calculations';
import { HABIT_LABELS, HABIT_PRESET_KEYS, HABITS, HabitMode, SUBSCRIPTIONS } from '../lib/types';

function getPreset(mode: HabitMode, key: string, customHabits: { daily: any[]; subscription: any[] }) {
  const presets = mode === 'daily' ? HABITS : SUBSCRIPTIONS;
  if (key in presets) return presets[key];
  const custom = (customHabits[mode] || []).find((c) => c.key === key);
  return custom ? { now: custom.now, then: custom.then } : { now: 0, then: 0 };
}

export default function HomeScreen() {
  const store = useStore();
  const { transactions, myLoan, customHabits, deleteTransaction } = store;

  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [loanSheetOpen, setLoanSheetOpen] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  const [habitMode, setHabitModeState] = useState<HabitMode>('daily');
  const [selectedHabitKey, setSelectedHabitKey] = useState('coffee');
  const [habitNone, setHabitNone] = useState(false);
  const [customName, setCustomName] = useState('');
  const initial = getPreset('daily', 'coffee', customHabits);
  const [nowStr, setNowStr] = useState(String(initial.now));
  const [thenStr, setThenStr] = useState(String(initial.then));

  function selectHabit(mode: HabitMode, key: string) {
    setHabitModeState(mode);
    setSelectedHabitKey(key);
    setHabitNone(false);
    const preset = getPreset(mode, key, customHabits);
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
      const preset = getPreset(habitMode, selectedHabitKey, customHabits);
      setNowStr(String(preset.now));
      setThenStr(String(preset.then));
    }
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
  const monthlySaving = habitMode === 'daily' ? saving * 30 : saving;
  const label = currentHabitLabel();
  const tracked = store.isHabitTracked(selectedHabitKey, habitMode, label);

  const habitDetail = useMemo(() => {
    if (saving <= 0) {
      return habitNone
        ? "Nothing to save here — you're already not spending on this."
        : habitMode === 'daily'
        ? 'Try spending less than you do now to see the saving.'
        : 'Pick a cheaper plan (or $0 to cancel) to see the saving.';
    }
    if (myLoan) {
      const impact = computeExtraImpact(myLoan.balance, myLoan.rate, myLoan.term, 0, monthlySaving, 'monthly');
      return impact.interestSaved > 0
        ? `Based on your loan, paying this in would save ${money(impact.interestSaved)} in interest and clear it ${
            impact.monthsSaved === 0 ? 'sooner' : formatTerm(impact.monthsSaved / 12, true) + ' sooner'
          }.`
        : `Based on your loan, ${money(monthlySaving)}/mo isn't quite enough yet to show a real interest saving — try a bit more.`;
    }
    return `That's ${money(monthlySaving * 12)}/year — add your loan above to see what it works out to in interest saved.`;
  }, [saving, habitNone, habitMode, monthlySaving, myLoan]);

  // ---------- Combined "You're saving" hero ----------
  const savingsHero = useMemo(() => {
    const trackedTxs = transactions.filter((t) => t.habitTrackKey);
    const trackedTotal = trackedTxs.reduce((s, t) => s + (t.habitSaving || 0), 0);
    const previewCounts = !tracked && monthlySaving > 0 && !(selectedHabitKey === 'other' && !customName.trim());
    const total = trackedTotal + (previewCounts ? monthlySaving : 0);
    if (total <= 0) return null;
    let detail: string;
    if (myLoan && total > 0) {
      const impact = computeExtraImpact(myLoan.balance, myLoan.rate, myLoan.term, 0, total, 'monthly');
      detail =
        impact.interestSaved > 0
          ? `Based on your loan, paying this in would save ${money(impact.interestSaved)} in interest and clear it ${
              impact.monthsSaved === 0 ? 'sooner' : formatTerm(impact.monthsSaved / 12, true) + ' sooner'
            }.`
          : `Based on your loan, ${money(total)}/mo isn't quite enough yet to show a real interest saving — track another habit.`;
    } else {
      detail = `That's ${money(total * 12)}/year — add your loan to see what it works out to in interest saved.`;
    }
    return { total, detail };
  }, [transactions, tracked, monthlySaving, selectedHabitKey, customName, myLoan]);

  function trackHabit() {
    if (habitNone) return;
    if (now - then <= 0) return;
    if (tracked) return;
    store.trackHabit({ key: selectedHabitKey, mode: habitMode, label, now, then });
  }

  const trackBtnLabel = habitNone
    ? "Nothing to track — you don't do this"
    : tracked
    ? '✓ Tracking — already in your spending'
    : 'Track this — add to my monthly spending';
  const trackBtnDisabled = habitNone || tracked;

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
            <SectionLabel style={{ marginTop: 0 }}>You're saving</SectionLabel>
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

          <FieldGrid>
            <Field
              label={habitMode === 'daily' ? 'You spend now (per day)' : 'Your current plan (per month)'}
              value={nowStr}
              onChangeText={setNowStr}
            />
            <Field
              label={habitMode === 'daily' ? 'Try spending (per day)' : 'Downgrade to, or cancel (per month)'}
              value={thenStr}
              onChangeText={setThenStr}
            />
          </FieldGrid>

          <PrimaryButton
            title={selectedHabitKey === 'other' && customName.trim() ? 'Save this custom habit, then track it' : trackBtnLabel}
            onPress={() => {
              if (selectedHabitKey === 'other' && customName.trim() && !customList.some((c) => c.label === customName.trim())) {
                confirmCustomHabit();
              }
              trackHabit();
            }}
            disabled={trackBtnDisabled}
          />
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
        {transactions.length === 0 ? (
          <EmptyState small text="Nothing added yet — tap + to log your first transaction" />
        ) : (
          <View>
            {recentList.map((t) => (
              <View key={t.id} style={styles.txItem}>
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
                <Pressable onPress={() => deleteTransaction(t.id)} hitSlop={8}>
                  <Text style={styles.txDelete}>×</Text>
                </Pressable>
              </View>
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

      <Pressable style={styles.fab} onPress={() => setTxSheetOpen(true)}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <AddTransactionSheet visible={txSheetOpen} onClose={() => setTxSheetOpen(false)} />
      <LoanSheet visible={loanSheetOpen} onClose={() => setLoanSheetOpen(false)} />
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
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
});
