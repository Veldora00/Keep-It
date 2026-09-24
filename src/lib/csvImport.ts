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
}

const HEADER_HINTS = /date|amount|description|details|narrative|debit|credit|balance|reference/i;

function looksLikeHeader(row: string[]): boolean {
  return row.some((cell) => HEADER_HINTS.test(cell.trim()) && !/^-?\$?[\d,.]+$/.test(cell.trim()));
}

function matchCol(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(h.trim()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function detectColumns(rows: string[][]): { map: ColumnMap; startRow: number } {
  const first = rows[0] || [];
  if (looksLikeHeader(first)) {
    const headers = first.map((h) => h.toLowerCase());
    const dateIdx = matchCol(headers, [/^date$/, /date/]);
    const descIdx = matchCol(headers, [/^description$/, /description|narrative|details|reference|merchant/]);
    const amountIdx = matchCol(headers, [/^amount$/, /amount/]);
    const debitIdx = matchCol(headers, [/debit|withdrawal|money out/]);
    const creditIdx = matchCol(headers, [/credit|deposit|money in/]);
    return {
      map: {
        dateIdx: dateIdx >= 0 ? dateIdx : 0,
        descIdx: descIdx >= 0 ? descIdx : 2,
        amountIdx: amountIdx >= 0 ? amountIdx : null,
        debitIdx: debitIdx >= 0 ? debitIdx : null,
        creditIdx: creditIdx >= 0 ? creditIdx : null,
      },
      startRow: 1,
    };
  }
  // No header — assume the classic CommBank NetBank export layout:
  // Date, Amount, Description, Balance.
  return {
    map: { dateIdx: 0, amountIdx: 1, descIdx: 2, debitIdx: null, creditIdx: null },
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
const CATEGORY_KEYWORDS: { category: string; pattern: RegExp }[] = [
  { category: 'Groceries', pattern: /woolworths|coles|aldi|\biga\b|foodworks|harris farm/i },
  { category: 'Transport', pattern: /uber|didi|opal|myki|fuel|bp\b|caltex|shell|ampol|7-?eleven|linkt|toll/i },
  { category: 'Subscriptions', pattern: /netflix|spotify|disney|stan\b|amazon prime|youtube premium|apple\.com\/bill|kayo/i },
  { category: 'Utilities', pattern: /energy|electricity|agl|origin|telstra|optus|vodafone|water corp|gas\b/i },
  { category: 'Housing', pattern: /rent|mortgage|strata|real estate/i },
  { category: 'Entertainment', pattern: /cinema|event cinemas|ticketek|ticketmaster|hoyts/i },
];
function guessExpenseCategory(description: string): string {
  const found = CATEGORY_KEYWORDS.find((k) => k.pattern.test(description));
  return found ? found.category : 'Other';
}
function guessIncomeCategory(description: string): string {
  return /salary|payroll|wages|employer/i.test(description) ? 'Salary/Wages' : 'Other';
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
    if (map.amountIdx != null) {
      amount = parseAmount(r[map.amountIdx] ?? '');
    } else if (map.debitIdx != null || map.creditIdx != null) {
      const debit = map.debitIdx != null ? parseAmount(r[map.debitIdx] ?? '') : null;
      const credit = map.creditIdx != null ? parseAmount(r[map.creditIdx] ?? '') : null;
      if (credit) amount = Math.abs(credit);
      else if (debit) amount = -Math.abs(debit);
    }
    if (!date || amount == null || amount === 0) continue;

    const type: 'income' | 'expense' = amount > 0 ? 'income' : 'expense';
    const category = type === 'income' ? guessIncomeCategory(description) : guessExpenseCategory(description);
    out.push({ date, description, amount, rawDate, category, type, include: true });
  }
  return { rows: out, columnsFound: out.length > 0 };
}
