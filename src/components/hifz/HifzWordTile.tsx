import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  word: string;
  revealed: boolean;
  fontSize: number;
  fontFamily?: string;
  onPress: () => void;
}

// Rendered as a nested <Text> (not a Pressable/View), same technique as
// WordFeedbackChip (src/components/recitation/WordFeedbackChip.tsx) — the
// parent's single RTL <Text> keeps correct Arabic word order automatically
// via the platform's own bidi algorithm, which a row of separately-measured
// View chips could not reproduce.
export function HifzWordTile({ word, revealed, fontSize, fontFamily, onPress }: Props) {
  const t = useTheme();
  // Tatweel (ـ, U+0640) is the natural Arabic "blank line" glyph — it joins
  // cursively like any other letter, so the masked run reads as a redacted
  // word rather than a row of foreign dashes.
  const masked = 'ـ'.repeat(Math.max(3, word.length));

  return (
    <Text
      onPress={onPress}
      suppressHighlighting
      style={{
        fontSize, fontFamily,
        color: revealed ? t.colors.text : t.colors.textMuted,
        opacity: revealed ? 1 : 0.55,
      }}
    >
      {revealed ? word : masked}
    </Text>
  );
}
