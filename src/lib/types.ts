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
}
export const GOAL_PRESETS: { type: GoalType; label: string; placeholder?: string }[] = [
  { type: 'debt_free', label: 'Be debt-free faster' },
  { type: 'save_for', label: 'Save for something', placeholder: 'e.g. a PS5, a phone, a holiday' },
  { type: 'custom', label: 'Something else', placeholder: "What's the goal?" },
];

// Shared short description of a goal — used anywhere the app names what the
// user is optimizing for (Tools' "Your goal" card, Home's savings hero, etc).
export function goalSummary(goal: Goal): string {
  if (goal.type === 'debt_free') return 'Being debt-free faster';
  if (goal.type === 'save_for') return `Saving for ${goal.label || 'something'}`;
  return goal.label || 'Something else';
}

export type DailyLogs = Record<string, Record<string, boolean>>;

export const EXPENSE_CATEGORIES = [
  'Housing',
  'Groceries',
  'Transport',
  'Subscriptions',
  'Entertainment',
  'Utilities',
  'Savings',
  'Other',
];
export const INCOME_CATEGORIES = [
  'Salary/Wages',
  'Side hustle/Freelance',
  'Centrelink/Government payment',
  'Investment/Interest',
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
