// Bank CSV exports are not one format — CommBank's classic NetBank export has
// no header row at all (just Date, Amount, Description, Balance in that
// order), while ANZ/Westpac/NAB and most others ship a header row but name
// their columns differently, and some split Debit/Credit into two columns
// instead of one signed Amount. Rather than hard-coding one bank's layout,
// this sniffs the header (if there is one) for keywords, and falls back to
// the CommBank headerless layout when nothing matches — then always shows
// the user a preview to fix up before anything is actually imported, since
// no amount of guessing covers every bank.

export interface ParsedRow {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number; // signed: negative = money out, positive = money in
  rawDate: string;
  category: string;
  type: 'income' | 'expense';
  include: boolean;
}

// ---------- CSV tokenizing (handles quoted fields with , and embedded newlines) ----------
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// ---------- Header / column detection ----------
interface ColumnMap {
  dateIdx: number;
  descIdx: number;
  amountIdx: number | null;
  debitIdx: number | null;
  creditIdx: number | null;
  // True for credit-card-style exports (detected via a "Card Member" column,
  // an Amex signature) where the sign convention is the OPPOSITE of a normal
  // bank transaction/checking account: a purchase posts as a POSITIVE amount
  // (it increases what you owe) and a payment/refund/credit posts negative.
  // A normal bank CSV is the other way round (negative = money out). Without
  // this, every real purchase in a credit-card export (Amazon, Uber, KFC...)
  // came out positive and got treated as "income" — which has no Shopping/
  // Eat out/etc categories to offer, so it silently fell into Other no
  // matter how good the keyword list or the AI was.
  creditCardSign: boolean;
}

const HEADER_HINTS = /date|amount|description|details|narrative|debit|credit|balance|reference/i;

function matchCol(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h.trim()));
    if (idx >= 0) return idx;
  }
  return -1;
}

// How "header-like" a row is — counts cells that mention a real column
// keyword (and aren't just a plain number). Used to pick out the actual
// header row from several candidates, not just trust row 0.
function headerScore(row: string[]): number {
  let hints = 0;
  for (const cell of row) {
    const c = cell.trim();
    if (c && HEADER_HINTS.test(c) && !/^-?\$?[\d,.]+$/.test(c)) hints++;
  }
  return hints;
}

// Some exports have MORE THAN ONE column with "date" in its name — e.g.
// "Effective Date" (often blank until the transaction settles) alongside
// "Entered Date" (always filled in). Just taking the first column whose
// header matches /date/ picked the blank one and silently dropped every
// single row, which looked like the whole file was "ignored". Instead,
// when there's more than one date-like column, actually try parsing a
// sample of real data rows in each candidate and keep whichever one
// produces the most valid dates.
function bestDateColumn(rows: string[][], headerRowIdx: number, headers: string[]): number {
  const candidates: number[] = [];
  headers.forEach((h, i) => {
    if (/date/.test(h)) candidates.push(i);
  });
  if (candidates.length <= 1) return candidates[0] ?? -1;
  const sample = rows.slice(headerRowIdx + 1, headerRowIdx + 1 + 20);
  let best = candidates[0];
  let bestCount = -1;
  for (const i of candidates) {
    const count = sample.filter((r) => parseDate(r[i] ?? '') !== null).length;
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  }
  return best;
}

function detectColumns(rows: string[][]): { map: ColumnMap; startRow: number } {
  // Some exports prepend a line or two before the real header — an account
  // name, "Transactions from X to Y", a blank-ish disclaimer row. Trusting
  // only rows[0] meant a single stray leading row derailed column detection
  // for the *entire* file (wrong columns → every date/amount fails to parse
  // → the import looks like it "just stops"). Scan the first several rows
  // instead and use whichever one most looks like an actual header.
  const scanLimit = Math.min(rows.length, 5);
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < scanLimit; i++) {
    const score = headerScore(rows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) {
    const headers = rows[bestIdx].map((h) => h.toLowerCase());
    const dateIdx = bestDateColumn(rows, bestIdx, headers);
    const descIdx = matchCol(headers, [/^description$/, /description|narrative|details|reference|merchant/]);
    const amountIdx = matchCol(headers, [/^amount$/, /amount/]);
    const debitIdx = matchCol(headers, [/debit|withdrawal|money out/]);
    const creditIdx = matchCol(headers, [/credit|deposit|money in/]);
    const creditCardSign = headers.some((h) => /card\s*member|cardholder/.test(h));
    // Only trust this as the real header if it actually named a date column
    // plus some way to get an amount — a title row that merely contains the
    // word "date" in passing shouldn't count.
    if (dateIdx >= 0 && (amountIdx >= 0 || debitIdx >= 0 || creditIdx >= 0)) {
      return {
        map: {
          dateIdx,
          descIdx: descIdx >= 0 ? descIdx : 2,
          amountIdx: amountIdx >= 0 ? amountIdx : null,
          debitIdx: debitIdx >= 0 ? debitIdx : null,
          creditIdx: creditIdx >= 0 ? creditIdx : null,
          creditCardSign,
        },
        startRow: bestIdx + 1,
      };
    }
  }
  // No trustworthy header found — assume the classic CommBank NetBank
  // layout (Date, Amount, Description, Balance) with no header row at all.
  // Any stray leading rows are naturally skipped further down since they
  // won't parse as a valid date + amount.
  return {
    map: { dateIdx: 0, amountIdx: 1, descIdx: 2, debitIdx: null, creditIdx: null, creditCardSign: false },
    startRow: 0,
  };
}

// ---------- Date parsing: DD/MM/YYYY (AU default), ISO, and DD-MM-YYYY ----------
function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // ISO
  if (m) return isoFrom(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); // DD/MM/YYYY or DD-MM-YYYY
  if (m) {
    let [, a, b, y] = m;
    let year = Number(y);
    if (year < 100) year += 2000;
    let day = Number(a);
    let month = Number(b);
    // If the first number can't be a day (>31) but the second can, or the
    // first can't be a month (>12) while the "day" slot is <=12 and the
    // second is >12, swap — handles the rare US-formatted export.
    if (day > 31 && month <= 31) [day, month] = [month, day];
    else if (month > 12 && day <= 12) [day, month] = [month, day];
    return isoFrom(year, month, day);
  }
  return null;
}
function isoFrom(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'); // "(12.34)" style negatives
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ---------- Category guessing from the description text ----------
// Checked BEFORE the general keyword list on both sides (expense and
// income) because it's the most reliable, bank-format-independent signal
// there is: "Transfer to/from ... [bank] app" and PayID lines are money
// moving between your own accounts, not real spending or real income, and
// they'd otherwise dominate the "Other" bucket (and, worse, show up as
// fake "everyday habit" candidates on Home — see expenseHabitCandidates).
const TRANSFER_PATTERN = /\btransfer (to|from)\b|\bpayid\b|\bmember net transfer\b/i;
// Bank/card fees are a distinct thing from a subscription (a fee isn't a
// service you chose to sign up for) — giving them their own category keeps
// them out of "Other" without stretching what "Subscriptions" means.
const FEE_PATTERN = /\b(card|account|monthly|service|dishonour|late)\s+fee\b|\bfee\b.*\bcard\b|dishonour|overdrawn/i;

const CATEGORY_KEYWORDS: { category: string; pattern: RegExp }[] = [
  { category: 'Groceries', pattern: /woolworths|coles|aldi|\biga\b|foodworks|harris farm|fresh city|farmers market|greengrocer/i },
  // Checked before Transport so "UBER EATS" lands here and not on the plain
  // "uber" match below (which is meant for Uber the rideshare trip).
  {
    category: 'Eat out',
    pattern:
      /kfc|mcdonald|hungry jacks?|domino'?s?|subway|guzman|nando'?s?|grill'?d|oporto|red rooster|uber\s*eats|menulog|doordash|deliveroo|\bcafe\b|\bbakery\b|\bsushi\b|\bpizza\b|\bkebab\b|\bbbq\b|restaurant/i,
  },
  // \bdidi\b (not bare "didi") so a merchant like "DIDIT" (e.g. the Didit
  // identity-verification service) doesn't false-match the Didi rideshare
  // keyword just because it starts with the same four letters.
  { category: 'Transport', pattern: /uber|\bdidi\b|opal|myki|fuel|\bbp\b|caltex|shell|ampol|7-?eleven|linkt|toll/i },
  {
    category: 'Subscriptions',
    pattern:
      /netflix|spotify|disney|stan\b|amazon prime|youtube premium|apple\.com\/bill|kayo|telegram premium|google\s*\*|google play|discord nitro|icloud|chatgpt|openai/i,
  },
  { category: 'Utilities', pattern: /energy|electricity|agl|origin|telstra|optus|vodafone|water corp|gas\b/i },
  { category: 'Housing', pattern: /rent|mortgage|strata|real estate/i },
  { category: 'Entertainment', pattern: /cinema|event cinemas|ticketek|ticketmaster|hoyts/i },
  {
    category: 'Shopping',
    pattern:
      /amazon(?!\s*prime)|ebay|kmart|target|big\s*w|jb\s*hi-?fi|officeworks|bunnings|new balance|ray-?ban|allbids|\bnike\b|\badidas\b|cotton on|\bmyer\b|david jones/i,
  },
];
function guessExpenseCategory(description: string): string {
  if (TRANSFER_PATTERN.test(description)) return 'Transfers';
  if (FEE_PATTERN.test(description)) return 'Fees & Charges';
  const found = CATEGORY_KEYWORDS.find((k) => k.pattern.test(description));
  return found ? found.category : 'Other';
}
function guessIncomeCategory(description: string): string {
  if (TRANSFER_PATTERN.test(description)) return 'Transfers';
  if (/salary|payroll|wages|employer/i.test(description)) return 'Salary/Wages';
  if (/interest/i.test(description)) return 'Investment/Interest';
  return 'Other';
}

export interface ImportResult {
  rows: ParsedRow[];
  columnsFound: boolean;
}

export function parseBankCsv(text: string): ImportResult {
  const rows = parseCsvText(text);
  if (rows.length === 0) return { rows: [], columnsFound: false };
  const { map, startRow } = detectColumns(rows);

  const out: ParsedRow[] = [];
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const rawDate = r[map.dateIdx] ?? '';
    const date = parseDate(rawDate);
    const description = (r[map.descIdx] ?? '').trim() || 'Transaction';

    let amount: number | null = null;
    // A debit/credit split is already unambiguous (credit column = money in,
    // debit column = money out), so the credit-card sign flip below only
    // applies to the single signed "Amount" column case.
    let usedSplitColumns = false;
    if (map.amountIdx != null) {
      amount = parseAmount(r[map.amountIdx] ?? '');
    } else if (map.debitIdx != null || map.creditIdx != null) {
      usedSplitColumns = true;
      const debit = map.debitIdx != null ? parseAmount(r[map.debitIdx] ?? '') : null;
      const credit = map.creditIdx != null ? parseAmount(r[map.creditIdx] ?? '') : null;
      if (credit) amount = Math.abs(credit);
      else if (debit) amount = -Math.abs(debit);
    }
    if (!date || amount == null || amount === 0) continue;

    // Credit-card exports (Amex etc) post a purchase as POSITIVE (it adds to
    // what you owe) and a payment/refund as negative — the opposite of a
    // normal bank account, where negative is money leaving. Flip which sign
    // means "expense" for those files so real purchases don't get funnelled
    // into the income category list (which has no Shopping/Eat out/etc and
    // silently dumps everything into Other).
    const isExpense = map.creditCardSign && !usedSplitColumns ? amount > 0 : amount < 0;
    const type: 'income' | 'expense' = isExpense ? 'expense' : 'income';
    const category = type === 'income' ? guessIncomeCategory(description) : guessExpenseCategory(description);
    out.push({ date, description, amount, rawDate, category, type, include: true });
  }
  return { rows: out, columnsFound: out.length > 0 };
}
