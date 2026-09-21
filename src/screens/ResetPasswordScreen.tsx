import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { Field } from '../components/fields';
import { PrimaryButton } from '../components/ui';
import { useAuth } from '../lib/auth';

// Shown when the user arrives via a "reset your password" email link —
// Supabase has already handed them a temporary session for this one purpose.
export default function ResetPasswordScreen() {
  const { updatePassword, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match");
      return;
    }
    setBusy(true);
    const err = await updatePassword(password);
    setBusy(false);
    if (err) {
      Alert.alert("Couldn't update password", err);
    } else {
      Alert.alert('Password updated', "You're signed in with your new password.");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paperWarm }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Keep It</Text>
        <Text style={styles.tagline}>Choose a new password for your account.</Text>

        <Field label="New password" value={password} onChangeText={setPassword} placeholder="••••••••" keyboardType="default" secureTextEntry autoCapitalize="none" />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} placeholder="••••••••" keyboardType="default" secureTextEntry autoCapitalize="none" />

        {busy ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
        ) : (
          <PrimaryButton title="Update password" onPress={submit} />
        )}

        <Text style={styles.cancelLine} onPress={cancelPasswordRecovery}>
          Cancel and go back to sign in
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 60 },
  brand: { fontFamily: fonts.serif, fontSize: 32, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  tagline: { fontSize: 14, color: colors.inkDim, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  cancelLine: { textAlign: 'center', color: colors.inkFaint, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 13, marginTop: 18 },
});
