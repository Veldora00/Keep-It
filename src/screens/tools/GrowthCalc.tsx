import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme/theme';
import { Field, FieldGrid, SelectField } from '../../components/fields';
import { Notice } from '../../components/ui';
import { money } from '../../lib/calculations';

export default function GrowthCalc() {
  const [amount, setAmount] = useState('2500');
  const [rate, setRate] = useState('6');
  const [years, setYears] = useState('3');
  const [mode, setMode] = useState('Growth');

  const result = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const y = parseFloat(years) || 0;
    const grown = a * Math.pow(1 + r / 100, y);
    const gain = grown - a;
    if (mode === 'Growth') {
      return {
        label: 'This amount could grow to',
        amt: money(grown),
        detail: `That's ${money(gain)} of compound growth over ${y} year${y === 1 ? '' : 's'} at ${r}% p.a.`,
      };
    }
    return {
      label: 'This could reduce your interest by',
      amt: money(gain),
      detail: `Keeping ${money(a)} in an offset at ${r}% p.a. for ${y} year${y === 1 ? '' : 's'} — an approximation, not a full amortisation schedule.`,
    };
  }, [amount, rate, years, mode]);

  return (
    <View style={styles.card}>
      <FieldGrid>
        <Field label="Amount" value={amount} onChangeText={setAmount} />
        <Field label="Annual rate (%)" value={rate} onChangeText={setRate} />
        <Field label="Years" value={years} onChangeText={setYears} />
        <SelectField label="Mode" value={mode} options={['Growth', 'Offset (interest avoided)']} onChange={setMode} />
      </FieldGrid>
      <View style={styles.result}>
        <Text style={styles.rLbl}>{result.label}</Text>
        <Text style={styles.rAmt}>{result.amt}</Text>
        <Text style={styles.rDetail}>{result.detail}</Text>
      </View>
      <Notice>General information only, based on the numbers you enter — not financial advice and doesn't account for your personal circumstances.</Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: 22 },
  result: { marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.line },
  rLbl: { fontSize: 13, color: colors.inkDim },
  rAmt: { fontFamily: fonts.serif, fontSize: 38, color: colors.accentDeep, marginVertical: 4 },
  rDetail: { fontSize: 13, color: colors.inkFaint, lineHeight: 19 },
});
