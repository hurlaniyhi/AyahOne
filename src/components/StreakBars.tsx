import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  /** 7 values, oldest→newest, Monday-first to match weekday strip. */
  values: number[];
  labels: string[]; // 7 single-letter day labels
  todayIndex: number; // 0..6
  goal?: number; // optional reference line (verses/day)
}

/**
 * Vertical bars per weekday: each bar's height is proportional to verses read.
 * The current day is highlighted with the accent color; a thin dashed line
 * marks the daily goal when provided. Replaces the Quranly-style pill row.
 */
export function StreakBars({ values, labels, todayIndex, goal }: Props) {
  const t = useTheme();
  const max = Math.max(goal ?? 0, ...values, 1);
  const trackHeight = 56;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(3),
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 0.75, borderColor: t.colors.hairline,
      gap: t.spacing(2),
    }}>
      {labels.map((d, i) => {
        const v = values[i] ?? 0;
        const isToday = i === todayIndex;
        const filled = Math.max(2, Math.round((v / max) * trackHeight));
        const goalY = goal ? Math.round((goal / max) * trackHeight) : 0;
        return (
          <View key={i} style={{ alignItems: 'center', gap: t.spacing(1.5), flex: 1 }}>
            <View style={{
              width: 14, height: trackHeight,
              borderRadius: 8,
              backgroundColor: t.colors.surfaceMuted,
              justifyContent: 'flex-end',
              overflow: 'hidden',
            }}>
              {goal ? (
                <View style={{
                  position: 'absolute', left: 0, right: 0, bottom: goalY,
                  height: 1, backgroundColor: t.colors.brass, opacity: 0.55,
                }} />
              ) : null}
              <View style={{
                height: filled,
                borderTopLeftRadius: 7, borderTopRightRadius: 7,
                borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
                backgroundColor: isToday ? t.accent.primary : t.colors.border,
              }} />
            </View>
            <Text style={{
              color: isToday ? t.colors.text : t.colors.textMuted,
              fontSize: 11, fontWeight: isToday ? '700' : '500',
            }}>{d}</Text>
          </View>
        );
      })}
    </View>
  );
}
