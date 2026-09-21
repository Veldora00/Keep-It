// All finance math ported 1:1 from the original web app so every number the
// app produces matches exactly what was already validated there.

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-AU');
}

export function formatTerm(years: number, short?: boolean): string {
  if (years < 1) {
    const m = Math.round(years * 12);
    return short ? `${m} mth${m === 1 ? '' : 's'}` : `${m} month${m === 1 ? '' : 's'}`;
  }
  const wholeYears = Math.floor(years);
  const remMonths = Math.round((years - wholeYears) * 12);
  let out = short ? `${wholeYears}y` : `${wholeYears} year${wholeYears === 1 ? '' : 's'}`;
  if (remMonths > 0) out += short ? ` ${remMonths}m` : ` ${remMonths} month${remMonths === 1 ? '' : 's'}`;
  return out;
}

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  annually: 'Annually',
};
export const FREQUENCY_PER_YEAR: Record<string, number> = {
  daily: 365,
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  annually: 1,
};
// The noun to slot into "per ___" labels next to a habit/subscription cost field.
export const FREQUENCY_NOUN: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  fortnightly: 'fortnight',
  monthly: 'month',
  annually: 'year',
};
export function monthlyEquivalent(amount: number, frequency: string | null | undefined): number {
  return (amount * (FREQUENCY_PER_YEAR[frequency || 'monthly'] || 12)) / 12;
}

// ---------- Loan payoff ----------
export function regularPayment(principal: number, monthlyRate: number, n: number, balloon: number): number {
  if (monthlyRate === 0) return (principal - balloon) / n;
  const g = Math.pow(1 + monthlyRate, n);
  return (monthlyRate * (principal * g - balloon)) / (g - 1);
}

export interface AmortResult {
  months: number;
  interest: number;
  balances: number[];
  finalBalance: number;
}

export function amortSchedule(
  balance: number,
  monthlyRate: number,
  payment: number,
  maxMonths: number,
  targetBalance?: number
): AmortResult {
  targetBalance = targetBalance || 0;
  let bal = balance;
  let months = 0;
  let interest = 0;
  const balances = [bal];
  while (bal > targetBalance + 0.01 && months < maxMonths) {
    const int = bal * monthlyRate;
    const princ = Math.min(payment - int, bal - targetBalance);
    if (princ <= 0) {
      months = maxMonths;
      break;
    }
    bal -= princ;
    interest += int;
    months++;
    balances.push(bal);
  }
  return { months, interest, balances, finalBalance: bal };
}

export interface ExtraImpact {
  basePayment: number;
  baseResult: AmortResult;
  withExtraResult: AmortResult;
  monthsSaved: number;
  interestSaved: number;
  newBalanceOrPayment: number;
  newBalanceLbl: string;
}

// mode 'once' = lump sum today; 'monthly' = extra added to every repayment.
export function computeExtraImpact(
  balance: number,
  ratePct: number,
  termYears: number,
  balloon: number,
  extra: number,
  mode: 'once' | 'monthly'
): ExtraImpact {
  const termMonths = Math.round(termYears * 12);
  const monthlyRate = ratePct / 100 / 12;
  const basePayment = regularPayment(balance, monthlyRate, termMonths, balloon);
  const baseResult = amortSchedule(balance, monthlyRate, basePayment, termMonths, balloon);

  let withExtraResult: AmortResult;
  let newBalanceOrPayment: number;
  let newBalanceLbl: string;
  if (mode === 'once') {
    const newBalance = Math.max(balance - extra, 0);
    withExtraResult = amortSchedule(newBalance, monthlyRate, basePayment, termMonths, balloon);
    newBalanceOrPayment = newBalance;
    newBalanceLbl = 'New balance';
  } else {
    const newPayment = basePayment + extra;
    withExtraResult = amortSchedule(balance, monthlyRate, newPayment, termMonths, balloon);
    newBalanceOrPayment = newPayment;
    newBalanceLbl = 'New monthly repayment';
  }

  const monthsSaved = Math.max(0, baseResult.months - withExtraResult.months);
  const interestSaved = Math.max(0, baseResult.interest - withExtraResult.interest);
  return { basePayment, baseResult, withExtraResult, monthsSaved, interestSaved, newBalanceOrPayment, newBalanceLbl };
}

// ---------- Income tax (2026-27 ATO resident brackets) ----------
export function calcIncomeTax(income: number): number {
  const brackets = [
    { upTo: 18200, rate: 0, base: 0 },
    { upTo: 45000, rate: 0.15, base: 0 },
    { upTo: 135000, rate: 0.3, base: 4020 },
    { upTo: 190000, rate: 0.37, base: 31020 },
    { upTo: Infinity, rate: 0.45, base: 51370 },
  ];
  const bracketStart = [18200, 18200, 45000, 135000, 190000];
  for (let i = 0; i < brackets.length; i++) {
    if (income <= brackets[i].upTo) {
      return brackets[i].base + (income - bracketStart[i]) * brackets[i].rate;
    }
  }
  return 0;
}

export function calcMedicareLevy(income: number): number {
  if (income <= 27222) return 0;
  if (income <= 34027) return (income - 27222) * 0.1;
  return income * 0.02;
}

export function calcHelp(income: number): number {
  const threshold = 69528;
  if (income <= threshold) return 0;
  return (income - threshold) * 0.15;
}

// ---------- Streaks & trophies ----------
export function dateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayKey(): string {
  return dateKeyFromDate(new Date());
}

// A "win" day is any day at least one of the given habit track-keys was logged done.
// Counts the current run ending today (or yesterday, so missing today doesn't
// zero the streak out from under someone mid-check-in) and the best run ever.
export function computeStreak(
  dailyLogs: Record<string, Record<string, boolean>>,
  trackKeys: string[]
): { current: number; best: number } {
  if (trackKeys.length === 0) return { current: 0, best: 0 };
  const isWin = (key: string) => {
    const log = dailyLogs[key];
    return !!log && trackKeys.some((tk) => log[tk]);
  };

  const cursor = new Date();
  // If today isn't logged yet, don't break the streak — start counting from yesterday.
  if (!isWin(dateKeyFromDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (isWin(dateKeyFromDate(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Best-ever run: scan every logged date once.
  const allDays = Object.keys(dailyLogs)
    .filter((k) => isWin(k))
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of allDays) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (prev) {
      const diffDays = Math.round((dt.getTime() - prev.getTime()) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = dt;
  }
  best = Math.max(best, current);
  return { current, best };
}

export interface Trophy {
  days: number;
  label: string;
  icon: string;
}
export const TROPHY_MILESTONES: Trophy[] = [
  { days: 3, label: '3-day streak', icon: '🔥' },
  { days: 7, label: '1 week', icon: '⭐' },
  { days: 14, label: '2 weeks', icon: '🥉' },
  { days: 30, label: '1 month', icon: '🥈' },
  { days: 60, label: '2 months', icon: '🥇' },
  { days: 100, label: '100 days', icon: '🏆' },
  { days: 365, label: '1 year', icon: '👑' },
];
export function earnedTrophies(bestStreak: number): Trophy[] {
  return TROPHY_MILESTONES.filter((t) => bestStreak >= t.days);
}
export function nextTrophy(bestStreak: number): Trophy | null {
  return TROPHY_MILESTONES.find((t) => bestStreak < t.days) ?? null;
}

// ---------- Borrowing capacity ----------
export function maxLoanForPayment(payment: number, monthlyRate: number, termMonths: number): number {
  if (monthlyRate === 0) return payment * termMonths;
  return (payment * (1 - Math.pow(1 + monthlyRate, -termMonths))) / monthlyRate;
}
