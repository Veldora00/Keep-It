import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { Chip, PrimaryButton } from './ui';
import { Field } from './fields';
import { Goal, GOAL_PRESETS, GoalType } from '../lib/types';

// Shared "what are you optimizing cash flow for" picker — used both as the
// first-login onboarding screen and as the inline "change goal" editor in
// Tools. Picking a preset tags the goal type; save_for/custom also collect
// a short label so the rest of the app can say "toward a PS5" instead of
// just "toward your goal".
export default function GoalPicker({
  initialGoal,
  onSave,
  saveLabel = 'Save',
}: {
  initialGoal?: Goal | null;
  onSave: (goal: Goal) => void;
  saveLabel?: string;
}) {
  const [type, setType] = useState<GoalType>(initialGoal?.type || 'debt_free');
  const [label, setLabel] = useState(initialGoal?.label || '');

  const needsLabel = type === 'save_for' || type === 'custom';
  const preset = GOAL_PRESETS.find((g) => g.type === type)!;
  const canSave = !needsLabel || label.trim().length > 0;

  return (
    <View>
      <View style={styles.optionList}>
        {GOAL_PRESETS.map((g) => (
          <Chip
            key={g.type}
            label={g.label}
            active={type === g.type}
            onPress={() => {
              setType(g.type);
              if (g.type === 'debt_free') setLabel('');
            }}
          />
        ))}
      </View>

      {needsLabel ? (
        <Field
          label={type === 'save_for' ? "What are you saving for?" : 'What is it?'}
          value={label}
          onChangeText={setLabel}
          placeholder={preset.placeholder}
          keyboardType="default"
        />
      ) : null}

      <PrimaryButton
        title={saveLabel}
        disabled={!canSave}
        onPress={() => onSave({ type, label: needsLabel ? label.trim() : null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  optionList: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginBottom: 6 },
});
