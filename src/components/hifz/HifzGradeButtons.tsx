import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import type { HifzGrade } from '@/lib/hifz';

interface Props {
  onGrade: (grade: HifzGrade) => void;
  disabled?: boolean;
}

// Self-rating row shown after a recall attempt — colour-tiered the same way
// ScoreGauge tiers an accuracy score (danger/brass/success), so "Again" reads
// as a setback, "Good" as solid progress, and "Easy" as a confident pass.
export function HifzGradeButtons({ onGrade, disabled }: Props) {
  const t = useTheme();
  const s = useStrings();
  const grades: { grade: HifzGrade; label: string; sublabel: string; color: string }[] = [
    { grade: 'again', label: s.hifzGradeAgain, sublabel: s.hifzGradeAgainSub, color: t.colors.danger },
    { grade: 'good', label: s.hifzGradeGood, sublabel: s.hifzGradeGoodSub, color: t.colors.brass },
    { grade: 'easy', label: s.hifzGradeEasy, sublabel: s.hifzGradeEasySub, color: t.colors.success },
  ];

  const handlePress = (grade: HifzGrade) => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onGrade(grade);
  };

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing(2) }}>
      {grades.map(g => (
        <Pressable
          key={g.grade}
          disabled={disabled}
          onPress={() => handlePress(g.grade)}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: t.spacing(3), borderRadius: t.radius.lg,
            alignItems: 'center', gap: 2,
            backgroundColor: t.colors.surfaceMuted,
            borderWidth: 1.5, borderColor: g.color,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            transform: [{ scale: pressed && !disabled ? t.pressedScale : 1 }],
          })}
        >
          <Text style={{ color: g.color, fontWeight: '800', fontSize: 14 }}>{g.label}</Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '600' }}>{g.sublabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}
