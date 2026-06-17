import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Sparkline } from './Sparkline';

interface Props {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  series?: number[];
  /** Color for icon + sparkline. Defaults to theme accent. */
  tint?: string;
  /** Compact mode hides the sparkline (used for cards that don't have history yet). */
  compact?: boolean;
}

/**
 * Horizontal "shelf" stat — icon + label + value + tiny sparkline.
 * Distinct from Quranly's colored square tiles by being monochrome, restful,
 * and information-dense.
 */
export function StatRow({ label, value, icon, series, tint, compact }: Props) {
  const t = useTheme();
  const accent = tint ?? t.accent.primary;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(3.5),
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 0.75, borderColor: t.colors.hairline,
      gap: t.spacing(3),
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: t.colors.surfaceMuted,
      }}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {!compact && series && series.length > 1 ? (
        <Sparkline values={series} color={accent} width={84} height={30} />
      ) : null}
    </View>
  );
}
