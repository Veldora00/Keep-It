import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { Field } from '../components/fields';
import { PrimaryButton, TypeToggle } from '../components/ui';
import { useAuth } from '../lib/auth';

type Mode = 'password' | 'magic';

export default function AuthScreen() {
  const { signUpWithPassword, signInWithPassword, sendMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  async function submitPassword() {
    if (!email.trim() || !password) {
      Alert.alert('Enter your email and password');
      return;
    }
    setBusy(true);
    const err = isSignUp
      ? await signUpWithPassword(email.trim(), password)
      : await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (err) {
      Alert.alert(isSignUp ? "Couldn't sign up" : "Couldn't sign in", err);
    } else if (isSignUp) {
      Alert.alert('Check your email', 'Confirm your email to finish signing up, then sign in.');
      setIsSignUp(false);
    }
  }

  async function submitMagicLink() {
    if (!email.trim()) {
      Alert.alert('Enter your email');
      return;
    }
    setBusy(true);
    const err = await sendMagicLink(email.trim());
    setBusy(false);
    if (err) {
      Alert.alert("Couldn't send link", err);
    } else {
      setLinkSent(true);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paperWarm }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Keep It</Text>
        <Text style={styles.tagline}>Sign in to keep your data synced across devices.</Text>

        <TypeToggle
          leftLabel="Password"
          rightLabel="Magic link"
          active={mode === 'password' ? 'left' : 'right'}
          onChange={(v) => {
            setMode(v === 'left' ? 'password' : 'magic');
            setLinkSent(false);
          }}
        />

        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="default" />

        {mode === 'password' ? (
          <>
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" keyboardType="default" />
            {busy ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
            ) : (
              <PrimaryButton title={isSignUp ? 'Create account' : 'Sign in'} onPress={submitPassword} />
            )}
            <Text style={styles.switchLine} onPress={() => setIsSignUp((v) => !v)}>
              {isSignUp ? 'Already have an account? Sign in' : "New here? Create an account"}
            </Text>
          </>
        ) : (
          <>
            {linkSent ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  We sent a sign-in link to {email.trim()}. Open it on this phone to finish signing in.
                </Text>
              </View>
            ) : busy ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
            ) : (
              <PrimaryButton title="Send magic link" onPress={submitMagicLink} />
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 60 },
  brand: { fontFamily: fonts.serif, fontSize: 32, color: colors.ink, textAlign: 'center', marginBottom: 8 },
  tagline: { fontSize: 14, color: colors.inkDim, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  switchLine: { textAlign: 'center', color: colors.accentDeep, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 13.5, marginTop: 16 },
  notice: { backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: 16, marginTop: 4 },
  noticeText: { fontSize: 13.5, color: colors.accentDeep, lineHeight: 19 },
});
