import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';
import { Chip, PageTitle } from '../components/ui';
import GrowthCalc from './tools/GrowthCalc';
import LoanPayoffCalc from './tools/LoanPayoffCalc';
import BorrowCalc from './tools/BorrowCalc';
import TaxCalc from './tools/TaxCalc';

const TABS = [
  { key: 'loan', label: 'Loan payoff' },
  { key: 'borrow', label: 'Borrowing capacity' },
  { key: 'tax', label: 'Take-home pay' },
  { key: 'growth', label: 'Savings growth' },
];

export default function ToolsScreen() {
  const [tab, setTab] = useState('loan');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paperWarm }} contentContainerStyle={styles.screen}>
      <PageTitle>Tools</PageTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
        {TABS.map((t) => (
          <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      {tab === 'loan' ? <LoanPayoffCalc /> : null}
      {tab === 'borrow' ? <BorrowCalc /> : null}
      {tab === 'tax' ? <TaxCalc /> : null}
      {tab === 'growth' ? <GrowthCalc /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, paddingTop: 20, paddingBottom: 110, maxWidth: 520, width: '100%', alignSelf: 'center' },
  picker: { marginBottom: 16 },
});
