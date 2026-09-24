import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let listener: ((state: AlertState | null) => void) | null = null;

// Drop-in replacement for React Native's Alert.alert. react-native-web's
// Alert.alert is a documented no-op (see node_modules/react-native-web/src/
// exports/Alert/index.js — `static alert() {}`), so every confirm dialog in
// this app — "Reset everything?", "Sign out?", every form-validation
// message — silently did nothing on the web build the whole time. This
// renders a real Modal instead, so it behaves the same on web as native.
// Same call signature as RN's Alert.alert, so call sites don't change —
// just the import.
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const finalButtons = buttons && buttons.length ? buttons : [{ text: 'OK' }];
    listener?.({ title, message, buttons: finalButtons });
  },
};

// Mounted once, near the app root, so it's available regardless of auth state.
export function GlobalAlertHost() {
  const [state, setState] = useState<AlertState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  if (!state) return null;

  function handlePress(btn: AlertButton) {
    setState(null);
    btn.onPress?.();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setState(null)}>
      <Pressable style={styles.overlay} onPress={() => setState(null)}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
          <View style={styles.buttonRow}>
            {state.buttons.map((btn, i) => (
              <Pressable
                key={i}
                style={[styles.button, btn.style === 'destructive' && styles.destructiveButton, btn.style === 'cancel' && styles.cancelButton]}
                onPress={() => handlePress(btn)}
              >
                <Text
                  style={[styles.buttonText, btn.style === 'destructive' && styles.destructiveButtonText, btn.style === 'cancel' && styles.cancelButtonText]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.55)', justifyContent: 'center', padding: 22 },
  sheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 22, width: '100%', maxWidth: 380, alignSelf: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 13.5, color: colors.inkDim, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 13, borderRadius: radii.sm, alignItems: 'center', backgroundColor: colors.accent },
  buttonText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14 },
  cancelButton: { backgroundColor: colors.paperWarm, borderWidth: 1, borderColor: colors.lineStrong },
  cancelButtonText: { color: colors.inkDim },
  destructiveButton: { backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red },
  destructiveButtonText: { color: colors.red },
});
