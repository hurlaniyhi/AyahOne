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

// Self-rating grid shown after a recall attempt — a 2x2 layout gives each of
// the four grades enough room for a label + sub-label, unlike a cramped
// single row of four. Colour runs danger -> brass -> accent -> success so
// severity reads at a glance without needing to parse the text.
export function HifzGradeButtons({ onGrade, disabled }: Props) {
  const t = useTheme();
  const s = useStrings();
  const grades: { grade: HifzGrade; label: string; sublabel: string; color: string }[] = [
    { grade: 'forgotten', label: s.hifzGradeForgotten, sublabel: s.hifzGradeForgottenSub, color: t.colors.danger },
    { grade: 'difficult', label: s.hifzGradeDifficult, sublabel: s.hifzGradeDifficultSub, color: t.colors.brass },
    { grade: 'good', label: s.hifzGradeGood, sublabel: s.hifzGradeGoodSub, color: t.accent.primary },
    { grade: 'easy', label: s.hifzGradeEasy, sublabel: s.hifzGradeEasySub, color: t.colors.success },
  ];

  const handlePress = (grade: HifzGrade) => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onGrade(grade);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2) }}>
      {grades.map(g => (
        <Pressable
          key={g.grade}
          disabled={disabled}
          onPress={() => handlePress(g.grade)}
          style={({ pressed }) => ({
            flexBasis: '48%', flexGrow: 1,
            paddingVertical: t.spacing(3), borderRadius: t.radius.lg,
            alignItems: 'center', gap: 2,
            backgroundColor: t.colors.surfaceMuted,
            borderWidth: 1.5, borderColor: g.color,
            opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
            transform: [{ scale: pressed && !disabled ? t.pressedScale : 1 }],
          })}
        >
          <Text style={{ color: g.color, fontWeight: '800', fontSize: 15 }}>{g.label}</Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>{g.sublabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}
