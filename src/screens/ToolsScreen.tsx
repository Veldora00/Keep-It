import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../lib/alert';
import { colors, fonts, radii } from '../theme/theme';
import { Card, Chip, PageTitle, SectionLabel } from '../components/ui';
import GoalPicker from '../components/GoalPicker';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import { appNow } from '../lib/calculations';
import { goalSummary } from '../lib/types';
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
  const { canFastForward, dayOffset, setDayOffset, resetTestLogs, resetAllData, goal, saveGoal } = useStore();
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);

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

      <SectionLabel>Your goal</SectionLabel>
      <Card style={styles.goalCard}>
        <Text style={styles.goalText}>{goal ? goalSummary(goal) : 'Not set'}</Text>
        <Pressable onPress={() => setGoalEditorOpen(true)}>
          <Text style={styles.goalEdit}>Edit</Text>
        </Pressable>
      </Card>

      <Modal visible={goalEditorOpen} animationType="slide" transparent onRequestClose={() => setGoalEditorOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>What are you optimizing for?</Text>
            <GoalPicker
              initialGoal={goal}
              saveLabel="Save"
              onSave={(g) => {
                saveGoal(g);
                setGoalEditorOpen(false);
              }}
            />
            <Pressable onPress={() => setGoalEditorOpen(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
            <Chip
              label="Reset to today"
              onPress={() => {
                setDayOffset(0);
                resetTestLogs();
              }}
            />
          </ScrollView>

          <Pressable
            style={styles.dangerBtn}
            onPress={() =>
              Alert.alert(
                'Reset everything?',
                'This wipes every habit, log, loan, and goal on this test account — there\'s no undo.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset everything', style: 'destructive', onPress: () => resetAllData() },
                ]
              )
            }
          >
            <Text style={styles.dangerBtnText}>Reset everything (admin only)</Text>
          </Pressable>
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
  dangerBtn: { borderWidth: 1, borderColor: colors.red, backgroundColor: colors.redSoft, borderRadius: radii.sm, paddingVertical: 12, alignItems: 'center', marginBottom: 20 },
  dangerBtnText: { color: colors.red, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 13.5 },
  goalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 20 },
  goalText: { fontSize: 14.5, color: colors.ink, fontFamily: fonts.sansSemiBold, fontWeight: '600', flexShrink: 1, paddingRight: 12 },
  goalEdit: { fontSize: 14, color: colors.accentDeep, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.paper, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: 22, paddingBottom: 32 },
  modalTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, marginBottom: 16 },
  modalCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  modalCancelText: { color: colors.inkDim, fontFamily: fonts.sans, fontSize: 14 },
});
