// Lets the user open a "Spending by category" bucket and see exactly what's
// inside it — then either fix one transaction (tap it, which reuses the
// normal edit-transaction sheet) or move everything currently shown into a
// different category in one go, for when a whole batch got guessed wrong
// (e.g. a run of CSV-imported rows that should all be Subscriptions instead
// of Other).
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { PrimaryButton } from './ui';
import { SelectField } from './fields';
import { money } from '../lib/calculations';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, Transaction } from '../lib/types';

const ALL_CATEGORIES = Array.from(new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]));

export default function CategoryDrilldownModal({
  visible,
  category,
  transactions,
  onClose,
  onEditTransaction,
  onBulkRecategorize,
}: {
  visible: boolean;
  category: string | null;
  transactions: Transaction[];
  onClose: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onBulkRecategorize: (ids: number[], newCategory: string) => void;
}) {
  const [bulkTarget, setBulkTarget] = useState<string | null>(null);

  if (!category) return null;

  const rows = transactions
    .filter((t) => t.category === category)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const total = rows.reduce((s, t) => s + t.amount, 0);
  const categoryOptions = ALL_CATEGORIES.filter((c) => c !== category);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{category}</Text>
          <Text style={styles.subtitle}>
            {rows.length} transaction{rows.length === 1 ? '' : 's'} · {money(total)}
          </Text>

          <ScrollView style={styles.list}>
            {rows.map((t) => (
              <Pressable
                key={t.id}
                style={styles.row}
                onPress={() => {
                  onClose();
                  onEditTransaction(t);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={styles.rowDate}>{t.date}</Text>
                </View>
                <Text style={styles.rowAmt}>{money(t.amount)}</Text>
              </Pressable>
            ))}
            {rows.length === 0 ? <Text style={styles.empty}>Nothing in this category.</Text> : null}
          </ScrollView>

          {rows.length > 0 ? (
            <>
              <Text style={styles.hint}>Tap a transaction above to edit or recategorize just that one, or move everything shown here at once:</Text>
              <SelectField label="Move all these to…" value={bulkTarget || 'Choose a category'} options={categoryOptions} onChange={setBulkTarget} />
              <PrimaryButton
                title={bulkTarget ? `Move all ${rows.length} to ${bulkTarget}` : 'Move all'}
                disabled={!bulkTarget}
                onPress={() => {
                  if (!bulkTarget) return;
                  onBulkRecategorize(
                    rows.map((t) => t.id),
                    bulkTarget
                  );
                  setBulkTarget(null);
                  onClose();
                }}
              />
            </>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 20, maxHeight: '85%' },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkDim, marginTop: 2, marginBottom: 14 },
  list: { maxHeight: 300, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowName: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.ink },
  rowDate: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  rowAmt: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, fontWeight: '600', color: colors.ink, marginLeft: 8 },
  empty: { fontSize: 13, color: colors.inkFaint, paddingVertical: 20, textAlign: 'center' },
  hint: { fontSize: 12.5, color: colors.inkFaint, lineHeight: 18, marginBottom: 10 },
  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  closeBtnText: { fontSize: 14, color: colors.inkDim, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
});
