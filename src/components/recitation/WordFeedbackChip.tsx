import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { WordStatus } from '@/lib/recitationAi';

interface Props {
  word: string;
  status: WordStatus;
  fontSize: number;
  fontFamily?: string;
  onPress?: () => void;
}

// Rendered as a nested <Text> (not a Pressable/View) so it participates in
// the same bidi text layout as its siblings — the parent's single RTL <Text>
// keeps correct Arabic word order automatically, exactly like the tajweed
// rule spans in the reader (see src/lib/tajweed.ts render usage).
export function WordFeedbackChip({ word, status, fontSize, fontFamily, onPress }: Props) {
  const t = useTheme();
  const style = (() => {
    switch (status) {
      case 'mispronounced':
        return { color: t.colors.text, textDecorationLine: 'underline' as const, textDecorationStyle: 'dotted' as const, textDecorationColor: t.colors.brass };
      case 'missed':
        return { color: t.colors.textMuted, textDecorationLine: 'line-through' as const, textDecorationColor: t.colors.textMuted, opacity: 0.7 };
      case 'unclear':
        return { color: t.colors.text, textDecorationLine: 'underline' as const, textDecorationStyle: 'dashed' as const, textDecorationColor: t.accent.primary };
      default:
        return { color: t.colors.text };
    }
  })();

  return (
    <Text
      onPress={status === 'correct' ? undefined : onPress}
      suppressHighlighting={false}
      style={{ fontSize, fontFamily, ...style }}
    >
      {word}
    </Text>
  );
}
