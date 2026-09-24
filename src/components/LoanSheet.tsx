import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../lib/alert';
import { colors, fonts, radii } from '../theme/theme';
import { Field } from './fields';
import { PrimaryButton } from './ui';
import { useStore } from '../lib/store';

export default function LoanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { myLoan, saveMyLoan, removeMyLoan } = useStore();
  const [balance, setBalance] = useState('');
  const [rate, setRate] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (visible) {
      setBalance(myLoan ? String(myLoan.balance) : '');
      setRate(myLoan ? String(myLoan.rate) : '');
      setTerm(myLoan ? String(myLoan.term) : '');
    }
  }, [visible, myLoan]);

  function submit() {
    const b = parseFloat(balance);
    const r = parseFloat(rate);
    const t = parseFloat(term);
    if (!b || !r || !t) {
      Alert.alert('Fill in all three fields');
      return;
    }
    saveMyLoan({ balance: b, rate: r, term: t });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Your loan</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Field label="Remaining loan amount" value={balance} onChangeText={setBalance} placeholder="e.g. 500000" />
          <Field label="Interest rate (%)" value={rate} onChangeText={setRate} placeholder="e.g. 6.5" />
          <Field label="Term remaining (years)" value={term} onChangeText={setTerm} placeholder="e.g. 25" />
          <PrimaryButton title="Save" onPress={submit} />
          {myLoan ? (
            <Pressable
              style={styles.removeBtn}
              onPress={() => {
                removeMyLoan();
                onClose();
              }}
            >
              <Text style={styles.removeText}>Remove loan</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(22,26,32,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 },
  handle: { width: 36, height: 4, backgroundColor: colors.lineStrong, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  close: { fontSize: 18, color: colors.ink, width: 40, height: 40, textAlign: 'center', textAlignVertical: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lineStrong, overflow: 'hidden', lineHeight: 40 },
  removeBtn: { marginTop: 12, alignItems: 'center' },
  removeText: { color: colors.red, fontSize: 14, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
});
