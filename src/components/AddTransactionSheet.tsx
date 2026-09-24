import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from '../lib/alert';
import { colors, fonts, radii } from '../theme/theme';
import { Field, SelectField, CheckRow } from './fields';
import { PrimaryButton } from './ui';
import { useStore } from '../lib/store';
import { money } from '../lib/calculations';
import { parseBankCsv, ParsedRow } from '../lib/csvImport';
import { categorizeWithAI } from '../lib/aiCategorize';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, Frequency, Transaction, TxType } from '../lib/types';

const FREQ_OPTIONS_EXPENSE = ['Weekly', 'Fortnightly', 'Monthly', 'Annually'];
const FREQ_VALUES_EXPENSE: Frequency[] = ['weekly', 'fortnightly', 'monthly', 'annually'];
const FREQ_OPTIONS_INCOME = ['One-off', 'Weekly', 'Fortnightly', 'Monthly', 'Annually'];
const FREQ_VALUES_INCOME: (Frequency | null)[] = [null, 'weekly', 'fortnightly', 'monthly', 'annually'];

function freqToLabel(freq: Frequency | null, isIncome: boolean): string {
  const options = isIncome ? FREQ_OPTIONS_INCOME : FREQ_OPTIONS_EXPENSE;
  const values = isIncome ? FREQ_VALUES_INCOME : FREQ_VALUES_EXPENSE;
  const idx = values.indexOf(freq);
  return idx >= 0 ? options[idx] : 'Monthly';
}

type SheetTab = 'expense' | 'income' | 'import';

// Pass `editingTx` to reuse this same sheet for editing an existing
// transaction in place (same id) instead of always creating a new one —
// e.g. a salary that changed, without having to delete and redo the whole
// entry just to fix one number. Editing never shows the "Import" tab —
// that only makes sense from a blank "+".
export default function AddTransactionSheet({
  visible,
  onClose,
  editingTx,
}: {
  visible: boolean;
  onClose: () => void;
  editingTx?: Transaction | null;
}) {
  const { addTransaction, updateTransaction } = useStore();
  const [tab, setTab] = useState<SheetTab>('expense');
  const [type, setType] = useState<TxType>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [recurring, setRecurring] = useState(false);
  const [freqLabel, setFreqLabel] = useState('Monthly');

  useEffect(() => {
    if (!visible) return;
    if (editingTx) {
      setTab(editingTx.type);
      setType(editingTx.type);
      setName(editingTx.type === 'expense' ? editingTx.name : '');
      setAmount(String(editingTx.amount));
      setCategory(editingTx.category);
      setRecurring(editingTx.recurring);
      setFreqLabel(freqToLabel(editingTx.frequency, editingTx.type === 'income'));
    } else {
      setTab('expense');
      setType('expense');
      setCategory(EXPENSE_CATEGORIES[0]);
      setRecurring(false);
      setFreqLabel('Monthly');
      setName('');
      setAmount('');
    }
  }, [visible, editingTx]);

  function changeTab(next: SheetTab) {
    setTab(next);
    if (next === 'import') return;
    setType(next);
    setCategory(next === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setRecurring(false);
    setFreqLabel('Monthly');
  }

  function submit() {
    const amt = parseFloat(amount);
    const nm = type === 'income' ? category : name.trim();
    if (!nm || !amt || amt <= 0) {
      Alert.alert(type === 'income' ? 'Enter an amount' : 'Enter a name and an amount');
      return;
    }
    let freq: Frequency | null = null;
    let isRecurring = false;
    if (type === 'income') {
      const idx = FREQ_OPTIONS_INCOME.indexOf(freqLabel);
      freq = FREQ_VALUES_INCOME[idx] ?? null;
      isRecurring = !!freq;
    } else {
      isRecurring = recurring;
      if (isRecurring) {
        const idx = FREQ_OPTIONS_EXPENSE.indexOf(freqLabel);
        freq = FREQ_VALUES_EXPENSE[idx] ?? 'monthly';
      }
    }
    if (editingTx) {
      updateTransaction({
        ...editingTx,
        name: nm,
        amount: amt,
        category,
        recurring: isRecurring,
        frequency: freq,
        type,
      });
    } else {
      addTransaction({
        id: Date.now(),
        name: nm,
        amount: amt,
        category,
        recurring: isRecurring,
        frequency: freq,
        type,
        date: new Date().toISOString(),
      });
    }
    onClose();
  }

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const freqOptions = type === 'income' ? FREQ_OPTIONS_INCOME : FREQ_OPTIONS_EXPENSE;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>{editingTx ? 'Edit transaction' : tab === 'import' ? 'Add your statement' : 'Add transaction'}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {!editingTx ? (
            <View style={styles.tabRow}>
              <Pressable style={[styles.tabBtn, tab === 'expense' && styles.tabBtnExpenseActive]} onPress={() => changeTab('expense')}>
                <Text style={[styles.tabBtnText, tab === 'expense' && styles.tabBtnExpenseActiveText]}>Expense</Text>
              </Pressable>
              <Pressable style={[styles.tabBtn, tab === 'income' && styles.tabBtnIncomeActive]} onPress={() => changeTab('income')}>
                <Text style={[styles.tabBtnText, tab === 'income' && styles.tabBtnIncomeActiveText]}>Income</Text>
              </Pressable>
              <Pressable style={[styles.tabBtn, tab === 'import' && styles.tabBtnImportActive]} onPress={() => changeTab('import')}>
                <Text style={[styles.tabBtnText, tab === 'import' && styles.tabBtnImportActiveText]}>Add statement</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'import' ? (
            <CsvImportBody onDone={onClose} />
          ) : (
            <>
              {type === 'expense' ? (
                <Field label="What's it for" value={name} onChangeText={setName} placeholder="e.g. Groceries, Rent" keyboardType="default" />
              ) : null}
              <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" />
              <SelectField label="Category" value={category} options={categories} onChange={setCategory} />

              {type === 'expense' ? (
                <CheckRow label="Repeats" checked={recurring} onToggle={() => setRecurring(!recurring)} />
              ) : null}
              {(type === 'expense' && recurring) || type === 'income' ? (
                <SelectField label="How often" value={freqLabel} options={freqOptions} onChange={setFreqLabel} />
              ) : null}

              <PrimaryButton title={editingTx ? 'Save changes' : 'Add transaction'} onPress={submit} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// The CSV-import half of the "+" sheet — picking a file, reviewing/fixing
// the parsed rows, and bulk-adding them. See csvImport.ts for how it copes
// with different bank layouts (CommBank's headerless export vs a bank that
// ships a header row vs one that splits Debit/Credit into two columns).
function CsvImportBody({ onDone }: { onDone: () => void }) {
  const { addTransactions } = useStore();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // AI categorization runs in the background after the keyword-guessed rows
  // are already on screen — never blocks the review list from showing up,
  // and quietly upgrades any row the user hasn't touched yet when it lands.
  const [aiStatus, setAiStatus] = useState<'idle' | 'checking' | 'done' | 'unavailable'>('idle');
  const editedRowsRef = React.useRef<Set<number>>(new Set());

  function reset() {
    setRows(null);
    setFileName('');
    setError('');
    setBusy(false);
    setAiStatus('idle');
    editedRowsRef.current = new Set();
  }

  async function runAiCategorize(parsedRows: ParsedRow[]) {
    setAiStatus('checking');
    const items = parsedRows.map((r, i) => ({ id: String(i), description: r.description, type: r.type, amount: r.amount }));
    const outcome = await categorizeWithAI(items);
    if (!outcome.ok) {
      // Every batch failed — say so honestly instead of showing "double
      // checked" text for a call that never actually reached the model.
      // See devtools console for the underlying error (CORS, missing
      // OPENAI_API_KEY secret, an OpenAI error, etc).
      if (outcome.firstError) console.warn('[CsvImportBody] AI categorization unavailable:', outcome.firstError);
      setAiStatus('unavailable');
      return;
    }
    if (outcome.results.size > 0) {
      setRows((prev) =>
        prev
          ? prev.map((r, i) => {
              if (editedRowsRef.current.has(i)) return r; // don't clobber a manual fix
              const aiCategory = outcome.results.get(String(i));
              return aiCategory ? { ...r, category: aiCategory } : r;
            })
          : prev
      );
    }
    setAiStatus('done');
  }

  async function pickFile() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      setBusy(true);
      const text = await fetch(asset.uri).then((r) => r.text());
      const parsed = parseBankCsv(text);
      if (parsed.rows.length === 0) {
        setError("Couldn't find any transactions in that file — is it a bank transaction export?");
        setBusy(false);
        return;
      }
      setFileName(asset.name || 'statement.csv');
      setRows(parsed.rows);
      setBusy(false);
      runAiCategorize(parsed.rows);
    } catch (e) {
      setError('Could not read that file. Try exporting a fresh CSV from your bank and pick it again.');
      setBusy(false);
    }
  }

  function toggleRow(i: number) {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, include: !r.include } : r)) : prev));
  }

  function setCategory(i: number, category: string) {
    editedRowsRef.current.add(i);
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, category } : r)) : prev));
  }

  function doImport() {
    if (!rows) return;
    const included = rows.filter((r) => r.include);
    if (included.length === 0) return;
    const now = Date.now();
    const txs: Transaction[] = included.map((r, i) => ({
      id: now + i,
      name: r.description,
      amount: Math.abs(r.amount),
      category: r.category,
      recurring: false,
      frequency: null,
      type: r.type,
      date: new Date(r.date).toISOString(),
    }));
    addTransactions(txs);
    reset();
    onDone();
  }

  const includedCount = rows ? rows.filter((r) => r.include).length : 0;

  if (!rows) {
    return (
      <>
        <Text style={styles.helpText}>
          Export your transaction history as a CSV from your bank's website (most have an "Export" button above the
          transaction list — CommBank's is under NetBank on desktop, not the app) and pick the file below. Nothing gets
          added until you review it on the next screen.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton title={busy ? 'Reading file…' : 'Choose CSV file'} onPress={pickFile} disabled={busy} />
      </>
    );
  }

  return (
    <>
      <Text style={styles.helpText}>
        {fileName} — found {rows.length} transaction{rows.length === 1 ? '' : 's'}. Untick anything that shouldn't be
        imported, and fix a category if the guess is wrong.
        {aiStatus === 'checking' ? ' 🤖 Double-checking categories with AI…' : ''}
        {aiStatus === 'done' ? ' 🤖 Categories double-checked with AI.' : ''}
        {aiStatus === 'unavailable' ? ' AI check unavailable right now — using keyword-guessed categories below.' : ''}
      </Text>
      <ScrollView style={styles.rowScroll}>
        {rows.map((r, i) => (
          <View key={i} style={[styles.row, !r.include && styles.rowExcluded]}>
            <Pressable style={[styles.checkbox, r.include && styles.checkboxChecked]} onPress={() => toggleRow(i)} hitSlop={8}>
              {r.include ? <Text style={styles.checkmark}>✓</Text> : null}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowDesc} numberOfLines={1}>
                {r.description}
              </Text>
              <Text style={styles.rowMeta}>{r.date}</Text>
              {r.include ? (
                <View style={styles.catPicker}>
                  <SelectField
                    label=""
                    value={r.category}
                    options={r.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
                    onChange={(v) => setCategory(i, v)}
                  />
                </View>
              ) : null}
            </View>
            <Text style={[styles.rowAmt, { color: r.type === 'income' ? colors.accentDeep : colors.red }]}>
              {r.type === 'income' ? '+' : '-'}
              {money(Math.abs(r.amount))}
            </Text>
          </View>
        ))}
      </ScrollView>
      <PrimaryButton
        title={includedCount > 0 ? `Import ${includedCount} transaction${includedCount === 1 ? '' : 's'}` : 'Nothing selected'}
        onPress={doImport}
        disabled={includedCount === 0}
      />
      <Pressable onPress={reset} hitSlop={8}>
        <Text style={styles.pickAnother}>Pick a different file</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, maxHeight: '88%' },
  handle: { width: 36, height: 4, backgroundColor: colors.lineStrong, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  close: { fontSize: 18, color: colors.ink, width: 40, height: 40, textAlign: 'center', textAlignVertical: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lineStrong, overflow: 'hidden', lineHeight: 40 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 11, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paperWarm, alignItems: 'center' },
  tabBtnText: { fontSize: 13, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.inkDim },
  tabBtnExpenseActive: { backgroundColor: colors.redSoft, borderColor: colors.red },
  tabBtnExpenseActiveText: { color: colors.red },
  tabBtnIncomeActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tabBtnIncomeActiveText: { color: colors.accentDeep },
  tabBtnImportActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabBtnImportActiveText: { color: '#fff' },
  helpText: { fontSize: 13, color: colors.inkDim, lineHeight: 19, marginBottom: 16 },
  errorText: { fontSize: 13, color: colors.red, marginBottom: 12 },
  rowScroll: { maxHeight: 340, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowExcluded: { opacity: 0.4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#fff', fontSize: 13, fontFamily: fonts.sansBold, fontWeight: '700' },
  rowDesc: { fontSize: 14, fontFamily: fonts.sansMedium, fontWeight: '500', color: colors.ink },
  rowMeta: { fontSize: 11.5, color: colors.inkFaint, marginTop: 1, marginBottom: 4 },
  rowAmt: { fontSize: 14, fontFamily: fonts.sansSemiBold, fontWeight: '600', marginTop: 2 },
  catPicker: { maxWidth: 220 },
  pickAnother: { fontSize: 12.5, color: colors.inkFaint, textAlign: 'center', marginTop: 10 },
});
