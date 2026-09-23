import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { CustomHabit, CustomHabits, DailyLogs, Goal, HabitMode, MyLoan, Transaction } from './types';
import { FASTFORWARD_TEST_EMAIL, setDayOffset as setGlobalDayOffset, todayKey } from './calculations';

// Legacy unscoped keys — this is where data lived before accounts existed.
// Read once per device, on the very first login, then migrated to the cloud and cleared.
const LEGACY_TX_KEY = 'keepit_transactions';
const LEGACY_CH_KEY = 'keepit_custom_habits';
const LEGACY_DL_KEY = 'keepit_daily_logs';
const LEGACY_ML_KEY = 'keepit_myloan';
const LEGACY_GOAL_KEY = 'keepit_goal';

function scopedKey(base: string, userId: string) {
  return `${base}:${userId}`;
}

function migratedFlagKey(userId: string) {
  return `keepit_migrated:${userId}`;
}

interface Store {
  ready: boolean;
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: number) => void;
  adjustHabitTarget: (habitTrackKey: string, newAmount: number, newMonthlySaving: number) => void;
  customHabits: CustomHabits;
  addCustomHabit: (mode: HabitMode, habit: { key: string; label: string; now: number; then: number }) => void;
  dailyLogs: DailyLogs;
  toggleDayHabit: (dateKey: string, trackKey: string) => void;
  myLoan: MyLoan | null;
  saveMyLoan: (loan: MyLoan) => void;
  removeMyLoan: () => void;
  // What the onboarding question said the user is optimizing cash flow for.
  // null only until they've answered it once — the app gates on this.
  goal: Goal | null;
  saveGoal: (goal: Goal) => void;
  habitTrackKey: (key: string, mode: HabitMode, label: string) => string;
  isHabitTracked: (key: string, mode: HabitMode, label: string) => boolean;
  trackHabit: (opts: { key: string; mode: HabitMode; label: string; monthlySpend: number; monthlySaving: number }) => void;
  // Test-only: lets the one designated test account fast-forward what the
  // app considers "today" — everyone else gets canFastForward: false and
  // setDayOffset is a no-op for them.
  canFastForward: boolean;
  dayOffset: number;
  setDayOffset: (days: number) => void;
}

function dayOffsetKey(userId: string) {
  return `keepit_test_dayoffset:${userId}`;
}

const StoreContext = createContext<Store | null>(null);

export function habitTrackKeyFn(key: string, mode: HabitMode, label: string): string {
  return key === 'other' ? `other:${mode}:${label.toLowerCase()}` : `${key}:${mode}`;
}

function txFromRow(row: any): Transaction {
  return {
    id: Number(row.id),
    name: row.name,
    amount: Number(row.amount),
    category: row.category,
    recurring: row.recurring,
    frequency: row.frequency,
    type: row.type,
    date: row.date,
    habitTrackKey: row.habit_track_key ?? undefined,
    habitSaving: row.habit_saving != null ? Number(row.habit_saving) : undefined,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const canFastForward = userEmail === FASTFORWARD_TEST_EMAIL;

  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customHabits, setCustomHabits] = useState<CustomHabits>({ daily: [], subscription: [] });
  const [dailyLogs, setDailyLogs] = useState<DailyLogs>({});
  const [myLoan, setMyLoan] = useState<MyLoan | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [dayOffset, setDayOffsetState] = useState(0);

  // Only the designated test account ever gets a non-zero offset, and it's
  // reset the moment a different account signs in on this device.
  useEffect(() => {
    if (!userId || !canFastForward) {
      setDayOffsetState(0);
      setGlobalDayOffset(0);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(dayOffsetKey(userId)).then((raw) => {
      if (cancelled) return;
      const n = raw ? parseInt(raw, 10) || 0 : 0;
      setDayOffsetState(n);
      setGlobalDayOffset(n);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, canFastForward]);

  const setDayOffset = useCallback(
    (days: number) => {
      if (!userId || !canFastForward) return;
      const clamped = Math.max(0, Math.round(days) || 0);
      setDayOffsetState(clamped);
      setGlobalDayOffset(clamped);
      AsyncStorage.setItem(dayOffsetKey(userId), String(clamped)).catch(() => {});
    },
    [userId, canFastForward]
  );

  // Load + (first time) migrate whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setCustomHabits({ daily: [], subscription: [] });
      setDailyLogs({});
      setMyLoan(null);
      setGoal(null);
      setReady(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setReady(false);
      try {
        const alreadyMigrated = await AsyncStorage.getItem(migratedFlagKey(userId));
        if (!alreadyMigrated) {
          await migrateLegacyLocalData(userId);
          await AsyncStorage.setItem(migratedFlagKey(userId), 'true');
        }

        const [{ data: txRows }, { data: chRows }, { data: dlRows }, { data: mlRows }, { data: goalRow }] = await Promise.all([
          supabase.from('keepit_transactions').select('*').order('date', { ascending: false }),
          supabase.from('keepit_custom_habits').select('*'),
          supabase.from('keepit_daily_logs').select('*'),
          supabase.from('keepit_myloan').select('*').maybeSingle(),
          supabase.from('keepit_goal').select('*').maybeSingle(),
        ]);

        if (cancelled) return;

        const nextTx = (txRows ?? []).map(txFromRow);
        const nextCh: CustomHabits = { daily: [], subscription: [] };
        (chRows ?? []).forEach((r: any) => {
          const habit: CustomHabit = { key: r.key, label: r.label, now: Number(r.now_amount), then: Number(r.then_amount) };
          (nextCh[r.mode as HabitMode] as CustomHabit[]).push(habit);
        });
        const nextDl: DailyLogs = {};
        (dlRows ?? []).forEach((r: any) => {
          if (!nextDl[r.date_key]) nextDl[r.date_key] = {};
          nextDl[r.date_key][r.track_key] = !!r.tracked;
        });
        const nextMl: MyLoan | null = mlRows ? { balance: Number(mlRows.balance), rate: Number(mlRows.rate), term: Number(mlRows.term) } : null;
        const nextGoal: Goal | null = goalRow ? { type: goalRow.goal_type, label: goalRow.goal_label ?? null } : null;

        setTransactions(nextTx);
        setCustomHabits(nextCh);
        setDailyLogs(nextDl);
        setMyLoan(nextMl);
        setGoal(nextGoal);

        await Promise.all([
          AsyncStorage.setItem(scopedKey(LEGACY_TX_KEY, userId), JSON.stringify(nextTx)),
          AsyncStorage.setItem(scopedKey(LEGACY_CH_KEY, userId), JSON.stringify(nextCh)),
          AsyncStorage.setItem(scopedKey(LEGACY_DL_KEY, userId), JSON.stringify(nextDl)),
          nextMl
            ? AsyncStorage.setItem(scopedKey(LEGACY_ML_KEY, userId), JSON.stringify(nextMl))
            : AsyncStorage.removeItem(scopedKey(LEGACY_ML_KEY, userId)),
          nextGoal
            ? AsyncStorage.setItem(scopedKey(LEGACY_GOAL_KEY, userId), JSON.stringify(nextGoal))
            : AsyncStorage.removeItem(scopedKey(LEGACY_GOAL_KEY, userId)),
        ]);
      } catch (e) {
        // Cloud fetch failed (offline, etc) — fall back to this device's last synced cache.
        try {
          const [txRaw, chRaw, dlRaw, mlRaw, goalRaw] = await Promise.all([
            AsyncStorage.getItem(scopedKey(LEGACY_TX_KEY, userId)),
            AsyncStorage.getItem(scopedKey(LEGACY_CH_KEY, userId)),
            AsyncStorage.getItem(scopedKey(LEGACY_DL_KEY, userId)),
            AsyncStorage.getItem(scopedKey(LEGACY_ML_KEY, userId)),
            AsyncStorage.getItem(scopedKey(LEGACY_GOAL_KEY, userId)),
          ]);
          if (!cancelled) {
            if (txRaw) setTransactions(JSON.parse(txRaw));
            if (chRaw) setCustomHabits(JSON.parse(chRaw));
            if (dlRaw) setDailyLogs(JSON.parse(dlRaw));
            if (mlRaw) setMyLoan(JSON.parse(mlRaw));
            if (goalRaw) setGoal(JSON.parse(goalRaw));
          }
        } catch {
          // best effort
        }
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const cacheTx = useCallback(
    (next: Transaction[]) => {
      if (userId) AsyncStorage.setItem(scopedKey(LEGACY_TX_KEY, userId), JSON.stringify(next)).catch(() => {});
    },
    [userId]
  );

  const addTransaction = useCallback(
    (tx: Transaction) => {
      const next = [tx, ...transactions];
      setTransactions(next);
      cacheTx(next);
      if (userId) {
        supabase
          .from('keepit_transactions')
          .insert({
            id: tx.id,
            user_id: userId,
            name: tx.name,
            amount: tx.amount,
            category: tx.category,
            recurring: tx.recurring,
            frequency: tx.frequency,
            type: tx.type,
            date: tx.date,
            habit_track_key: tx.habitTrackKey ?? null,
            habit_saving: tx.habitSaving ?? null,
          })
          .then(() => {});
      }
    },
    [transactions, cacheTx, userId]
  );

  // Recalibrate a tracked habit's target: updates the recurring transaction that
  // represents it in place, so future month-pace / interest-saved math uses the
  // new number instead of insert-a-new-row-every-time.
  const adjustHabitTarget = useCallback(
    (habitTrackKey: string, newAmount: number, newMonthlySaving: number) => {
      const next = transactions.map((t) =>
        t.habitTrackKey === habitTrackKey ? { ...t, amount: newAmount, habitSaving: newMonthlySaving } : t
      );
      setTransactions(next);
      cacheTx(next);
      const row = next.find((t) => t.habitTrackKey === habitTrackKey);
      if (userId && row) {
        supabase
          .from('keepit_transactions')
          .update({ amount: newAmount, habit_saving: newMonthlySaving })
          .eq('user_id', userId)
          .eq('id', row.id)
          .then(() => {});
      }
    },
    [transactions, cacheTx, userId]
  );

  const deleteTransaction = useCallback(
    (id: number) => {
      const next = transactions.filter((t) => t.id !== id);
      setTransactions(next);
      cacheTx(next);
      if (userId) {
        supabase.from('keepit_transactions').delete().eq('user_id', userId).eq('id', id).then(() => {});
      }
    },
    [transactions, cacheTx, userId]
  );

  const addCustomHabit = useCallback(
    (mode: HabitMode, habit: { key: string; label: string; now: number; then: number }) => {
      const next: CustomHabits = { ...customHabits, [mode]: [...customHabits[mode], habit] };
      setCustomHabits(next);
      if (userId) {
        AsyncStorage.setItem(scopedKey(LEGACY_CH_KEY, userId), JSON.stringify(next)).catch(() => {});
        supabase
          .from('keepit_custom_habits')
          .insert({ user_id: userId, mode, key: habit.key, label: habit.label, now_amount: habit.now, then_amount: habit.then })
          .then(() => {});
      }
    },
    [customHabits, userId]
  );

  const toggleDayHabit = useCallback(
    (dateKey: string, trackKey: string) => {
      const day = { ...(dailyLogs[dateKey] || {}) };
      const willBeTracked = !day[trackKey];
      day[trackKey] = willBeTracked;
      const next = { ...dailyLogs };
      if (!Object.values(day).some(Boolean)) {
        delete next[dateKey];
      } else {
        next[dateKey] = day;
      }
      setDailyLogs(next);
      if (userId) {
        AsyncStorage.setItem(scopedKey(LEGACY_DL_KEY, userId), JSON.stringify(next)).catch(() => {});
        if (willBeTracked) {
          supabase
            .from('keepit_daily_logs')
            .upsert({ user_id: userId, date_key: dateKey, track_key: trackKey, tracked: true, updated_at: new Date().toISOString() })
            .then(() => {});
        } else {
          supabase.from('keepit_daily_logs').delete().eq('user_id', userId).eq('date_key', dateKey).eq('track_key', trackKey).then(() => {});
        }
      }
    },
    [dailyLogs, userId]
  );

  const saveMyLoanFn = useCallback(
    (loan: MyLoan) => {
      setMyLoan(loan);
      if (userId) {
        AsyncStorage.setItem(scopedKey(LEGACY_ML_KEY, userId), JSON.stringify(loan)).catch(() => {});
        supabase
          .from('keepit_myloan')
          .upsert({ user_id: userId, balance: loan.balance, rate: loan.rate, term: loan.term, updated_at: new Date().toISOString() })
          .then(() => {});
      }
    },
    [userId]
  );

  const removeMyLoan = useCallback(() => {
    setMyLoan(null);
    if (userId) {
      AsyncStorage.removeItem(scopedKey(LEGACY_ML_KEY, userId)).catch(() => {});
      supabase.from('keepit_myloan').delete().eq('user_id', userId).then(() => {});
    }
  }, [userId]);

  const saveGoalFn = useCallback(
    (g: Goal) => {
      setGoal(g);
      if (userId) {
        AsyncStorage.setItem(scopedKey(LEGACY_GOAL_KEY, userId), JSON.stringify(g)).catch(() => {});
        supabase
          .from('keepit_goal')
          .upsert({ user_id: userId, goal_type: g.type, goal_label: g.label, updated_at: new Date().toISOString() })
          .then(() => {});
      }
    },
    [userId]
  );

  const habitTrackKey = useCallback(habitTrackKeyFn, []);

  const isHabitTracked = useCallback(
    (key: string, mode: HabitMode, label: string) => {
      const trackKey = habitTrackKeyFn(key, mode, label);
      return transactions.some((t) => t.habitTrackKey === trackKey);
    },
    [transactions]
  );

  const trackHabit = useCallback(
    (opts: { key: string; mode: HabitMode; label: string; monthlySpend: number; monthlySaving: number }) => {
      const { key, mode, label, monthlySpend, monthlySaving } = opts;
      if (isHabitTracked(key, mode, label)) return;
      const trackKey = habitTrackKeyFn(key, mode, label);
      const tx: Transaction = {
        id: Date.now(),
        name: `${label} (${monthlySpend > 0 ? 'new plan' : 'cancelled'})`,
        amount: monthlySpend,
        category: mode === 'subscription' ? 'Subscriptions' : 'Other',
        recurring: true,
        frequency: 'monthly',
        type: 'expense',
        date: new Date().toISOString(),
        habitTrackKey: trackKey,
        habitSaving: monthlySaving,
      };
      addTransaction(tx);

      // Committing to a daily habit right now already covers today — mark today
      // done immediately so the "did you keep to it?" check-in only starts
      // asking from tomorrow, instead of firing the instant it's tracked.
      if (mode === 'daily') {
        const today = todayKey();
        const day = { ...(dailyLogs[today] || {}), [trackKey]: true };
        const next = { ...dailyLogs, [today]: day };
        setDailyLogs(next);
        if (userId) {
          AsyncStorage.setItem(scopedKey(LEGACY_DL_KEY, userId), JSON.stringify(next)).catch(() => {});
          supabase
            .from('keepit_daily_logs')
            .upsert({ user_id: userId, date_key: today, track_key: trackKey, tracked: true, updated_at: new Date().toISOString() })
            .then(() => {});
        }
      }
    },
    [addTransaction, isHabitTracked, dailyLogs, userId]
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      transactions,
      addTransaction,
      deleteTransaction,
      adjustHabitTarget,
      customHabits,
      addCustomHabit,
      dailyLogs,
      toggleDayHabit,
      myLoan,
      saveMyLoan: saveMyLoanFn,
      removeMyLoan,
      goal,
      saveGoal: saveGoalFn,
      habitTrackKey,
      isHabitTracked,
      trackHabit,
      canFastForward,
      dayOffset,
      setDayOffset,
    }),
    [
      ready,
      transactions,
      addTransaction,
      deleteTransaction,
      adjustHabitTarget,
      customHabits,
      addCustomHabit,
      dailyLogs,
      toggleDayHabit,
      myLoan,
      saveMyLoanFn,
      removeMyLoan,
      goal,
      saveGoalFn,
      habitTrackKey,
      isHabitTracked,
      trackHabit,
      canFastForward,
      dayOffset,
      setDayOffset,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// One-time, per-device: push whatever was saved locally before accounts existed
// up to this user's brand-new cloud account, so nothing from testing gets lost.
async function migrateLegacyLocalData(userId: string) {
  try {
    const [txRaw, chRaw, dlRaw, mlRaw] = await Promise.all([
      AsyncStorage.getItem(LEGACY_TX_KEY),
      AsyncStorage.getItem(LEGACY_CH_KEY),
      AsyncStorage.getItem(LEGACY_DL_KEY),
      AsyncStorage.getItem(LEGACY_ML_KEY),
    ]);

    if (txRaw) {
      const txs: Transaction[] = JSON.parse(txRaw);
      if (txs.length) {
        await supabase.from('keepit_transactions').upsert(
          txs.map((t) => ({
            id: t.id,
            user_id: userId,
            name: t.name,
            amount: t.amount,
            category: t.category,
            recurring: t.recurring,
            frequency: t.frequency,
            type: t.type,
            date: t.date,
            habit_track_key: t.habitTrackKey ?? null,
            habit_saving: t.habitSaving ?? null,
          }))
        );
      }
    }

    if (chRaw) {
      const ch: CustomHabits = JSON.parse(chRaw);
      const rows: any[] = [];
      (['daily', 'subscription'] as HabitMode[]).forEach((mode) => {
        (ch[mode] || []).forEach((h) => {
          rows.push({ user_id: userId, mode, key: h.key, label: h.label, now_amount: h.now, then_amount: h.then });
        });
      });
      if (rows.length) await supabase.from('keepit_custom_habits').insert(rows);
    }

    if (dlRaw) {
      const dl: DailyLogs = JSON.parse(dlRaw);
      const rows: any[] = [];
      Object.entries(dl).forEach(([dateKey, tracks]) => {
        Object.entries(tracks).forEach(([trackKey, tracked]) => {
          if (tracked) rows.push({ user_id: userId, date_key: dateKey, track_key: trackKey, tracked: true });
        });
      });
      if (rows.length) await supabase.from('keepit_daily_logs').upsert(rows);
    }

    if (mlRaw) {
      const ml: MyLoan = JSON.parse(mlRaw);
      await supabase.from('keepit_myloan').upsert({ user_id: userId, balance: ml.balance, rate: ml.rate, term: ml.term });
    }

    // Clear the legacy unscoped keys so a second account on the same device
    // never re-migrates the first account's data.
    await Promise.all([
      AsyncStorage.removeItem(LEGACY_TX_KEY),
      AsyncStorage.removeItem(LEGACY_CH_KEY),
      AsyncStorage.removeItem(LEGACY_DL_KEY),
      AsyncStorage.removeItem(LEGACY_ML_KEY),
    ]);
  } catch (e) {
    // If migration fails, leave the legacy keys in place so we can retry next launch.
  }
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
