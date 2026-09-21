import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { Chip, PageTitle, SectionLabel } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import { appNow } from '../lib/calculations';
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
  const { session, signOut } = useAuth();
  const { canFastForward, dayOffset, setDayOffset } = useStore();

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

      {canFastForward ? (
        <>
          <SectionLabel>Testing — this account only</SectionLabel>
          <Text style={styles.testHint}>
            Simulated today: {appNow().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
            {dayOffset > 0 ? ` (+${dayOffset} day${dayOffset === 1 ? '' : 's'})` : ' (real time)'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
            <Chip label="+1 day" onPress={() => setDayOffset(dayOffset + 1)} />
            <Chip label="+7 days" onPress={() => setDayOffset(dayOffset + 7)} />
            <Chip label="+30 days" onPress={() => setDayOffset(dayOffset + 30)} />
            <Chip label="Reset to today" onPress={() => setDayOffset(0)} />
          </ScrollView>
        </>
      ) : null}

      <SectionLabel>Account</SectionLabel>
      <Text style={styles.email}>{session?.user?.email}</Text>
      <Pressable
        style={styles.signOutBtn}
        onPress={() =>
          Alert.alert('Sign out?', 'Your data stays saved in the cloud — sign back in any time.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
          ])
        }
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, paddingTop: 20, paddingBottom: 110, maxWidth: 520, width: '100%', alignSelf: 'center' },
  picker: { marginBottom: 16 },
  testHint: { fontSize: 13, color: colors.inkDim, fontFamily: fonts.sans, marginBottom: 10 },
  email: { fontSize: 13.5, color: colors.inkDim, fontFamily: fonts.sans, marginBottom: 12 },
  signOutBtn: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radii.sm, paddingVertical: 13, alignItems: 'center', marginBottom: 20 },
  signOutText: { color: colors.red, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14.5 },
});
