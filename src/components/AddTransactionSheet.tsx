import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../lib/alert';
import { colors, fonts, radii } from '../theme/theme';
import { Field, SelectField, CheckRow } from './fields';
import { PrimaryButton, TypeToggle } from './ui';
import { useStore } from '../lib/store';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, Frequency, TxType } from '../lib/types';

const FREQ_OPTIONS_EXPENSE = ['Weekly', 'Fortnightly', 'Monthly', 'Annually'];
const FREQ_VALUES_EXPENSE: Frequency[] = ['weekly', 'fortnightly', 'monthly', 'annually'];
const FREQ_OPTIONS_INCOME = ['One-off', 'Weekly', 'Fortnightly', 'Monthly', 'Annually'];
const FREQ_VALUES_INCOME: (Frequency | null)[] = [null, 'weekly', 'fortnightly', 'monthly', 'annually'];

export default function AddTransactionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { addTransaction } = useStore();
  const [type, setType] = useState<TxType>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [recurring, setRecurring] = useState(false);
  const [freqLabel, setFreqLabel] = useState('Monthly');

  useEffect(() => {
    if (visible) {
      setType('expense');
      setCategory(EXPENSE_CATEGORIES[0]);
      setRecurring(false);
      setFreqLabel('Monthly');
      setName('');
      setAmount('');
    }
  }, [visible]);

  function onTypeChange(v: 'left' | 'right') {
    const t: TxType = v === 'left' ? 'expense' : 'income';
    setType(t);
    setCategory(t === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
    setRecurring(false);
    setFreqLabel(t === 'income' ? 'Monthly' : 'Monthly');
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
            <Text style={styles.title}>Add transaction</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <TypeToggle leftLabel="Expense" rightLabel="Income" active={type === 'expense' ? 'left' : 'right'} onChange={onTypeChange} />

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

          <PrimaryButton title="Add transaction" onPress={submit} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, maxHeight: '88%' },
  handle: { width: 36, height: 4, backgroundColor: colors.lineStrong, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  close: { fontSize: 18, color: colors.ink, width: 40, height: 40, textAlign: 'center', textAlignVertical: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lineStrong, overflow: 'hidden', lineHeight: 40 },
});
