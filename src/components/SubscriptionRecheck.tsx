import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { PrimaryButton } from './ui';
import { useStore } from '../lib/store';
import { appNow, money } from '../lib/calculations';

// Subscriptions (Netflix, Disney+...) are never asked about by the daily
// check-in — that popup only covers everyday habits. Left alone, a tracked
// subscription's price just sits there forever even though plans go up
// every few months. This periodically re-asks "is it still $X/month?" for
// any subscription that hasn't been confirmed in a while, using the tracked
// transaction's own date as the "last confirmed" timestamp.
const RECHECK_DAYS = 90;

function splitIcon(name: string): { icon: string; rest: string } {
  const m = name.match(/^(\p{Extended_Pictographic}️?)\s+(.*)$/u);
  return m ? { icon: m[1], rest: m[2] } : { icon: '📺', rest: name };
}

export default function SubscriptionRecheck() {
  const { transactions, reconfirmSubscription } = useStore();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [stage, setStage] = useState<'ask' | 'update'>('ask');
  const [amountInput, setAmountInput] = useState('');

  const subs = useMemo(() => transactions.filter((t) => t.habitTrackKey && t.habitTrackKey.includes(':subscription')), [transactions]);

  const current = useMemo(() => {
    const now = appNow().getTime();
    return subs.find((t) => {
      const key = t.habitTrackKey!;
      if (dismissed[key]) return false;
      const daysSince = (now - new Date(t.date).getTime()) / 86400000;
      return daysSince >= RECHECK_DAYS;
    });
  }, [subs, dismissed]);

  if (!current) return null;

  const currentAmount = current.amount;
  const trackKey = current.habitTrackKey!;
  const { icon, rest } = splitIcon(current.name.replace(/\s*\((new plan|cancelled)\)$/, ''));

  function close() {
    setDismissed((d) => ({ ...d, [trackKey]: true }));
    setStage('ask');
    setAmountInput('');
  }

  function stillSame() {
    reconfirmSubscription(trackKey);
    close();
  }

  function priceChanged() {
    setAmountInput(String(currentAmount));
    setStage('update');
  }

  function submitNewAmount() {
    const parsed = Math.max(0, parseFloat(amountInput) || 0);
    reconfirmSubscription(trackKey, parsed);
    close();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={() => {}}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {stage === 'ask' ? (
            <>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.title}>Is {rest} still {money(current.amount)}/month?</Text>
              <Text style={styles.subtitle}>It's been a few months — plans creep up, worth a quick check.</Text>
              <View style={styles.row}>
                <Pressable style={[styles.answerBtn, styles.changedBtn]} onPress={priceChanged}>
                  <Text style={styles.changedBtnText}>It's changed</Text>
                </Pressable>
                <Pressable style={[styles.answerBtn, styles.sameBtn]} onPress={stillSame}>
                  <Text style={styles.sameBtnText}>Still the same ✓</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.icon}>{icon}</Text>
              <Text style={styles.title}>What's {rest} now, per month?</Text>
              <TextInput
                style={styles.input}
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="decimal-pad"
                placeholder={String(current.amount)}
                placeholderTextColor={colors.inkFaint}
              />
              <PrimaryButton title="Update" onPress={submitNewAmount} />
            </>
          )}
          <Pressable onPress={close} hitSlop={8}>
            <Text style={styles.skipText}>Ask me later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.55)', justifyContent: 'center', padding: 22 },
  sheet: { backgroundColor: colors.paper, borderRadius: radii.xl, padding: 22, alignItems: 'center' },
  icon: { fontSize: 34 },
  title: { fontFamily: fonts.serif, fontSize: 19, color: colors.ink, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.inkDim, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8, marginBottom: 6 },
  answerBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.sm, alignItems: 'center' },
  changedBtn: { backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red },
  changedBtnText: { color: colors.red, fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14 },
  sameBtn: { backgroundColor: colors.accent },
  sameBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontWeight: '600', fontSize: 14 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paperWarm,
    fontFamily: fonts.sans,
    textAlign: 'center',
    marginBottom: 14,
  },
  skipText: { marginTop: 10, color: colors.inkFaint, fontSize: 12.5, fontFamily: fonts.sans },
});
