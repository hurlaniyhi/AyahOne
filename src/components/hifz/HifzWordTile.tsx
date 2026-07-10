import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  word: string;
  revealed: boolean;
  active?: boolean;
  fontSize: number;
  fontFamily?: string;
  onPress: () => void;
}

// Rendered as a nested <Text> (not a Pressable/View), same technique as
// WordFeedbackChip (src/components/recitation/WordFeedbackChip.tsx) — the
// parent's single RTL <Text> keeps correct Arabic word order automatically
// via the platform's own bidi algorithm, which a row of separately-measured
// View chips could not reproduce.
export function HifzWordTile({ word, revealed, active, fontSize, fontFamily, onPress }: Props) {
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
        // Karaoke word-sync highlight is a color/weight change only — never
        // a background or box, since that would require switching this off
        // the single-<Text> structure the RTL word-ordering comment above
        // depends on.
        color: active ? t.accent.primary : (revealed ? t.colors.text : t.colors.textMuted),
        fontWeight: active ? '800' : undefined,
        opacity: revealed ? 1 : 0.55,
      }}
    >
      {revealed ? word : masked}
    </Text>
  );
}
