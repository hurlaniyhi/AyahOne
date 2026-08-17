import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';

interface Props {
  /** 7 values, oldest→newest, Monday-first to match weekday strip. */
  values: number[];
  labels: string[]; // 7 single-letter day labels
  todayIndex: number; // 0..6
  goal?: number; // optional reference line (verses/day)
}

// Small swatch + label pair, shared by both legend entries below so their
// spacing/typography can never drift apart.
function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(1.5) }}>
      {swatch}
      <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/**
 * Vertical bars per weekday: each bar's height is proportional to verses read.
 * The current day is highlighted with the accent color; a thin brass line
 * marks the daily goal when provided. A header names the card and states the
 * goal in numbers, and a small legend under the bars spells out what the
 * accent bar and the brass line mean — so the chart never needs a separate
 * explanation elsewhere. Replaces the Quranly-style pill row.
 */
export function StreakBars({ values, labels, todayIndex, goal }: Props) {
  const t = useTheme();
  const s = useStrings();
  const max = Math.max(goal ?? 0, ...values, 1);
  const trackHeight = 56;
  return (
    <View style={{
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 0.75, borderColor: t.colors.hairline,
      paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(3),
      gap: t.spacing(3),
    }}>
      {/* Header: names the card and states the goal in numbers, so the line
          drawn through the bars below already has a stated meaning before
          the reader even gets to the legend. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: t.colors.brass, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
          {s.streakThisWeek.toUpperCase()}
        </Text>
        {goal ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(1.5),
            paddingHorizontal: t.spacing(2.5), paddingVertical: 3,
            borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
          }}>
            <Ionicons name="flag-outline" size={11} color={t.colors.brass} />
            <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '700' }}>
              {goal} {s.versesPerDay}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: t.spacing(2) }}>
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
                  borderRadius: 7,
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

      {/* Legend: spells out what the accent bar and the brass line mean. */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing(4) }}>
        <LegendItem
          swatch={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent.primary }} />}
          label={s.streakToday}
        />
        {goal ? (
          <LegendItem
            swatch={<View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: t.colors.brass, opacity: 0.8 }} />}
            label={s.streakDailyGoal}
          />
        ) : null}
      </View>
    </View>
  );
}
