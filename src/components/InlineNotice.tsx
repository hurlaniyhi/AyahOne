import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

// Friendly banner for warning/error states across the app's audio features —
// never surfaces raw native/JS error text, just a calm, actionable message
// that matches the rest of the screen's visual language.
export function InlineNotice({ tone, icon, text }: { tone: 'warning' | 'danger'; icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const t = useTheme();
  const color = tone === 'danger' ? t.colors.danger : t.colors.brass;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing(2),
      paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(3),
      borderRadius: t.radius.md, backgroundColor: t.colors.surfaceMuted,
      borderLeftWidth: 3, borderLeftColor: color,
    }}>
      <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={{ color: t.colors.text, fontSize: 13, lineHeight: 19, flex: 1 }}>{text}</Text>
    </View>
  );
}
