import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomHabits, DailyLogs, HabitMode, MyLoan, Transaction } from './types';

const STORAGE_KEY = 'keepit_transactions';
const CUSTOM_HABITS_KEY = 'keepit_custom_habits';
const DAILY_LOG_KEY = 'keepit_daily_logs';
const MYLOAN_KEY = 'keepit_myloan';

interface Store {
  ready: boolean;
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: number) => void;
  customHabits: CustomHabits;
  addCustomHabit: (mode: HabitMode, habit: { key: string; label: string; now: number; then: number }) => void;
  dailyLogs: DailyLogs;
  toggleDayHabit: (dateKey: string, trackKey: string) => void;
  myLoan: MyLoan | null;
  saveMyLoan: (loan: MyLoan) => void;
  removeMyLoan: () => void;
  habitTrackKey: (key: string, mode: HabitMode, label: string) => string;
  isHabitTracked: (key: string, mode: HabitMode, label: string) => boolean;
  trackHabit: (opts: { key: string; mode: HabitMode; label: string; now: number; then: number }) => void;
}

const StoreContext = createContext<Store | null>(null);

export function habitTrackKeyFn(key: string, mode: HabitMode, label: string): string {
  return key === 'other' ? `other:${mode}:${label.toLowerCase()}` : `${key}:${mode}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customHabits, setCustomHabits] = useState<CustomHabits>({ daily: [], subscription: [] });
  const [dailyLogs, setDailyLogs] = useState<DailyLogs>({});
  const [myLoan, setMyLoan] = useState<MyLoan | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [txRaw, chRaw, dlRaw, mlRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(CUSTOM_HABITS_KEY),
          AsyncStorage.getItem(DAILY_LOG_KEY),
          AsyncStorage.getItem(MYLOAN_KEY),
        ]);
        if (txRaw) setTransactions(JSON.parse(txRaw));
        if (chRaw) {
          const parsed = JSON.parse(chRaw);
          if (parsed && parsed.daily && parsed.subscription) setCustomHabits(parsed);
        }
        if (dlRaw) setDailyLogs(JSON.parse(dlRaw));
        if (mlRaw) setMyLoan(JSON.parse(mlRaw));
      } catch (e) {
        // best-effort load
      }
      setReady(true);
    })();
  }, []);

  const persistTx = useCallback((next: Transaction[]) => {
    setTransactions(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addTransaction = useCallback(
    (tx: Transaction) => {
      persistTx([tx, ...transactions]);
    },
    [transactions, persistTx]
  );

  const deleteTransaction = useCallback(
    (id: number) => {
      persistTx(transactions.filter((t) => t.id !== id));
    },
    [transactions, persistTx]
  );

  const addCustomHabit = useCallback(
    (mode: HabitMode, habit: { key: string; label: string; now: number; then: number }) => {
      const next: CustomHabits = { ...customHabits, [mode]: [...customHabits[mode], habit] };
      setCustomHabits(next);
      AsyncStorage.setItem(CUSTOM_HABITS_KEY, JSON.stringify(next)).catch(() => {});
    },
    [customHabits]
  );

  const toggleDayHabit = useCallback(
    (dateKey: string, trackKey: string) => {
      const day = { ...(dailyLogs[dateKey] || {}) };
      day[trackKey] = !day[trackKey];
      const next = { ...dailyLogs };
      if (!Object.values(day).some(Boolean)) {
        delete next[dateKey];
      } else {
        next[dateKey] = day;
      }
      setDailyLogs(next);
      AsyncStorage.setItem(DAILY_LOG_KEY, JSON.stringify(next)).catch(() => {});
    },
    [dailyLogs]
  );

  const saveMyLoanFn = useCallback((loan: MyLoan) => {
    setMyLoan(loan);
    AsyncStorage.setItem(MYLOAN_KEY, JSON.stringify(loan)).catch(() => {});
  }, []);

  const removeMyLoan = useCallback(() => {
    setMyLoan(null);
    AsyncStorage.removeItem(MYLOAN_KEY).catch(() => {});
  }, []);

  const habitTrackKey = useCallback(habitTrackKeyFn, []);

  const isHabitTracked = useCallback(
    (key: string, mode: HabitMode, label: string) => {
      const trackKey = habitTrackKeyFn(key, mode, label);
      return transactions.some((t) => t.habitTrackKey === trackKey);
    },
    [transactions]
  );

  const trackHabit = useCallback(
    (opts: { key: string; mode: HabitMode; label: string; now: number; then: number }) => {
      const { key, mode, label, now, then } = opts;
      if (isHabitTracked(key, mode, label)) return;
      const monthlySaving = mode === 'daily' ? (now - then) * 30 : now - then;
      const monthlySpend = mode === 'daily' ? then * 30 : then;
      const tx: Transaction = {
        id: Date.now(),
        name: `${label} (${monthlySpend > 0 ? 'new plan' : 'cancelled'})`,
        amount: monthlySpend,
        category: mode === 'subscription' ? 'Subscriptions' : 'Other',
        recurring: true,
        frequency: 'monthly',
        type: 'expense',
        date: new Date().toISOString(),
        habitTrackKey: habitTrackKeyFn(key, mode, label),
        habitSaving: monthlySaving,
      };
      persistTx([tx, ...transactions]);
    },
    [transactions, persistTx, isHabitTracked]
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      transactions,
      addTransaction,
      deleteTransaction,
      customHabits,
      addCustomHabit,
      dailyLogs,
      toggleDayHabit,
      myLoan,
      saveMyLoan: saveMyLoanFn,
      removeMyLoan,
      habitTrackKey,
      isHabitTracked,
      trackHabit,
    }),
    [
      ready,
      transactions,
      addTransaction,
      deleteTransaction,
      customHabits,
      addCustomHabit,
      dailyLogs,
      toggleDayHabit,
      myLoan,
      saveMyLoanFn,
      removeMyLoan,
      habitTrackKey,
      isHabitTracked,
      trackHabit,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
