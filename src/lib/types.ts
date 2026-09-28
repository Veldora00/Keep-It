export type TxType = 'income' | 'expense';
export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'annually';

export interface Transaction {
  id: number;
  name: string;
  amount: number;
  category: string;
  recurring: boolean;
  frequency: Frequency | null;
  type: TxType;
  date: string;
  habitTrackKey?: string;
  habitSaving?: number;
  // Set only when an already-logged expense (e.g. a "Groceries" transaction)
  // gets turned into a tracked habit — the amount it had before, so
  // untracking can restore it instead of deleting the real expense record.
  preTrackAmount?: number;
}

export interface CustomHabit {
  key: string;
  label: string;
  now: number;
  then: number;
}

export interface CustomHabits {
  daily: CustomHabit[];
  subscription: CustomHabit[];
}

export interface MyLoan {
  balance: number;
  rate: number;
  term: number;
}

// What the user told the onboarding question they're optimizing cash flow
// for — used to tailor the copy the app shows them, nothing more.
export type GoalType = 'debt_free' | 'save_for' | 'custom';
export interface Goal {
  type: GoalType;
  label: string | null; // e.g. "a PS5" for save_for, or the custom goal text
  // Optional — how much the "save for"/custom goal costs. Lets the app say
  // "at this pace you'll have $X by [date]" instead of just naming the goal.
  targetAmount?: number | null;
}
export const GOAL_PRESETS: { type: GoalType; label: string; placeholder?: string }[] = [
  { type: 'debt_free', label: 'Be debt-free faster' },
  { type: 'save_for', label: 'Save for something', placeholder: 'e.g. a PS5, a phone, a holiday' },
  { type: 'custom', label: 'Something else', placeholder: "What's the goal?" },
];

// Shared short description of a goal — used anywhere the app names what the
// user is optimizing for (Tools' "Your goal" card, Home's savings hero, etc).
export function goalSummary(goal: Goal): string {
  const amountSuffix = goal.targetAmount ? ` ($${Math.round(goal.targetAmount).toLocaleString('en-AU')})` : '';
  if (goal.type === 'debt_free') return 'Being debt-free faster';
  if (goal.type === 'save_for') return `Saving for ${goal.label || 'something'}${amountSuffix}`;
  return `${goal.label || 'Something else'}${amountSuffix}`;
}

export type DailyLogs = Record<string, Record<string, boolean>>;

// A CSV import (especially a credit-card export) records a purchase and its
// later refund/return as two separate transactions — same merchant name,
// same amount, opposite direction (an expense charge and an income credit).
// That's a correct ledger entry, but it isn't real spending: the money came
// straight back. Left alone, this double-counts in spending totals and the
// category breakdown, AND makes a one-off purchase-then-refund look like a
// "recurring habit" just because the same merchant name appears twice.
// This matches purchases to refunds by exact name+amount (so it never nets
// out two genuinely separate purchases that merely cost the same), pairing
// off duplicates one-to-one rather than letting one refund cancel every
// expense with that name.
export function computeRefundedExpenseIds(transactions: Transaction[]): Set<number> {
  const incomeRemaining = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'income') continue;
    const key = `${t.name.trim().toLowerCase()}|${t.amount.toFixed(2)}`;
    incomeRemaining.set(key, (incomeRemaining.get(key) || 0) + 1);
  }
  const refundedIds = new Set<number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = `${t.name.trim().toLowerCase()}|${t.amount.toFixed(2)}`;
    const remaining = incomeRemaining.get(key) || 0;
    if (remaining > 0) {
      refundedIds.add(t.id);
      incomeRemaining.set(key, remaining - 1);
    }
  }
  return refundedIds;
}

export interface RecurringCandidate {
  key: string;
  name: string;
  type: TxType;
  category: string;
  amount: number;
  frequency: Frequency;
}

// CSV-imported transactions never carry the `recurring` flag — that's a
// manual, per-transaction toggle (set by hand in the add/edit sheet, or by
// the Home "everyday habit" switches). That meant Forecast only ever saw
// hand-flagged items and never noticed a salary, a subscription, or a
// regular investment transfer that came in through an import, even though
// the exact same name+amount shows up every payslip. This detects that
// repetition straight from history instead of requiring the user to flag
// anything: group same-name, same-direction transactions, and when 3+ of
// them land at a roughly consistent interval (weekly/fortnightly/monthly/
// annually, +/-35% tolerance on the gap) with a similar amount (within 20%
// of the median), treat it as a detected recurring item. Read-only — it
// never mutates a transaction or writes `recurring: true` anywhere; callers
// combine this with the manually-flagged list for projections/display.
export function detectRecurringCandidates(transactions: Transaction[]): RecurringCandidate[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.category === 'Transfers') continue; // moving between your own accounts isn't a recurring bill or income
    const key = `${t.type}|${t.name.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const candidates: RecurringCandidate[] = [];
  for (const [key, txs] of groups) {
    if (txs.length < 3) continue;
    const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const amounts = [...sorted.map((t) => t.amount)].sort((a, b) => a - b);
    const medianAmount = amounts[Math.floor(amounts.length / 2)];
    if (!(medianAmount > 0)) continue;
    const consistentAmount = sorted.every((t) => Math.abs(t.amount - medianAmount) / medianAmount <= 0.2);
    if (!consistentAmount) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000;
      if (days > 0) gaps.push(days);
    }
    if (gaps.length === 0) continue;
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];
    if (!(medianGap > 0)) continue;
    const consistentGap = gaps.every((g) => Math.abs(g - medianGap) / medianGap <= 0.35);
    if (!consistentGap) continue;

    let frequency: Frequency;
    if (medianGap <= 10) frequency = 'weekly';
    else if (medianGap <= 20) frequency = 'fortnightly';
    else if (medianGap <= 45) frequency = 'monthly';
    else if (medianGap <= 400) frequency = 'annually';
    else continue;

    const mostRecent = sorted[sorted.length - 1];
    candidates.push({ key, name: mostRecent.name, type: mostRecent.type, category: mostRecent.category, amount: medianAmount, frequency });
  }
  return candidates;
}

export const EXPENSE_CATEGORIES = [
  'Housing',
  'Groceries',
  'Eat out',
  'Transport',
  'Subscriptions',
  'Entertainment',
  'Utilities',
  'Shopping',
  'Fees & Charges',
  'Transfers',
  'Savings',
  'Other',
];
export const INCOME_CATEGORIES = [
  'Salary/Wages',
  'Side hustle/Freelance',
  'Centrelink/Government payment',
  'Investment/Interest',
  'Transfers',
  'Gift',
  'Other',
];

export type HabitMode = 'daily' | 'subscription';

export interface HabitPreset {
  now: number;
  then: number;
  unit: string;
}

// Presets are a realistic downgrade, not an all-or-nothing ask.
export const HABITS: Record<string, HabitPreset> = {
  coffee: { now: 6, then: 4, unit: 'day' },
  lunch: { now: 15, then: 10, unit: 'day' },
  smoke: { now: 26, then: 10, unit: 'day' },
  other: { now: 10, then: 5, unit: 'day' },
};
// Current Australian monthly plan prices (Canstar, Spotify — Sep 2026).
export const SUBSCRIPTIONS: Record<string, HabitPreset> = {
  netflix: { now: 20.99, then: 9.99, unit: 'mo' },
  disney: { now: 17.99, then: 9.99, unit: 'mo' },
  spotify: { now: 15.99, then: 0, unit: 'mo' },
  other: { now: 15, then: 0, unit: 'mo' },
};
export const HABIT_LABELS: Record<string, string> = {
  coffee: '☕ Coffee',
  lunch: '🥡 Lunch out',
  smoke: '🚬 Cigarettes/Vapes',
  netflix: '🎬 Netflix',
  disney: '🏰 Disney+',
  spotify: '🎵 Spotify',
};
export const HABIT_PRESET_KEYS: Record<HabitMode, string[]> = {
  daily: ['coffee', 'lunch', 'smoke'],
  subscription: ['netflix', 'disney', 'spotify'],
};

// Real current Australian averages (Canstar/RBA, money.com.au 2026 data).
export const LOAN_PRESETS = {
  mortgage: { balance: 731000, rate: 6.62, term: 30, balloon: 0, hasBalloon: false },
  car: { balance: 34282, rate: 9.07, term: 5, balloon: 10300, hasBalloon: false },
  personal: { balance: 18169, rate: 13.87, term: 3, balloon: 0, hasBalloon: false },
};
export type LoanType = keyof typeof LOAN_PRESETS;

export const BC_PRESETS = {
  mortgage: { rate: 6, term: 30, buffer: 3, deposit: 60000, depositLabel: 'Deposit available', priceLabel: 'Maximum property price', showDeposit: true },
  car: { rate: 9, term: 6, buffer: 0, deposit: 5000, depositLabel: 'Trade-in / deposit', priceLabel: 'Maximum car price', showDeposit: true },
  personal: { rate: 12, term: 5, buffer: 0, deposit: 0, depositLabel: 'Deposit available', priceLabel: 'Maximum loan amount', showDeposit: false },
};
export type BcType = keyof typeof BC_PRESETS;
