import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/theme';
import GoalPicker from '../components/GoalPicker';
import { useStore } from '../lib/store';
import { Goal } from '../lib/types';

// Shown once, right after a brand-new sign-in has no saved goal yet.
// Nothing else in the app renders until this is answered, so every
// tracked habit and suggestion after this point has a goal to point at.
export default function GoalOnboardingScreen() {
  const { saveGoal } = useStore();

  function submit(goal: Goal) {
    saveGoal(goal);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paperWarm }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Keep It</Text>
        <Text style={styles.title}>What do you want to optimize your cash flow for?</Text>
        <Text style={styles.subtitle}>This just shapes how we talk about your progress — you can change it anytime in Tools.</Text>
        <GoalPicker onSave={submit} saveLabel="Let's go" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 60 },
  brand: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, textAlign: 'center', marginBottom: 18 },
  title: { fontFamily: fonts.serif, fontSize: 21, color: colors.ink, textAlign: 'center', marginBottom: 8, lineHeight: 27 },
  subtitle: { fontSize: 13, color: colors.inkDim, textAlign: 'center', marginBottom: 24, lineHeight: 18 },
});
