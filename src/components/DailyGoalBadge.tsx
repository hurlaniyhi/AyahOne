import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { useTodayStats } from '@/store/selectors';

// Converts a #RRGGBB hex to an rgba() string so the same accent/brass colour
// can be layered at varying opacities across light and dark themes.
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export interface GoalBadgeState {
  met: boolean;   // today's verse count has reached (or passed) the goal
  extra: number;  // verses read beyond the goal (0 when exactly met / not met)
}

// Pure met/extra computation behind the badge. Exposed so the logic can be
// unit-tested without a React renderer (mirrors selectors' weekdaySeriesFor).
export function goalBadgeState(verses: number, goal: number): GoalBadgeState {
  const met = verses >= goal;
  return { met, extra: Math.max(0, verses - goal) };
}

// Shown on the reading page once the reader has met (or exceeded) today's verse
// goal. It confirms completion with a brass-ringed checkmark medallion and
// surfaces how many verses have been read *beyond* the goal, so continued
// reading past the target still feels acknowledged and rewarding.
export function DailyGoalBadge() {
  const t = useTheme();
  const s = useStrings();
  const goal = useAppStore(st => st.dailyGoalVerses);
  const today = useTodayStats();
  const { met, extra } = goalBadgeState(today.verses, goal);

  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!met) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    // Gentle, continuous breathing pulse on the medallion — subtle enough to
    // read as "alive/celebratory" without distracting from the verse itself.
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [met, enter, pulse]);

  if (!met) return null;

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
      <View style={{
        borderRadius: t.radius.lg, overflow: 'hidden',
        borderWidth: 1, borderColor: withAlpha(t.colors.brass, 0.55),
        shadowColor: t.accent.primary,
        shadowOpacity: t.mode === 'dark' ? 0.3 : 0.14,
        shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
      }}>
        <LinearGradient
          colors={[
            withAlpha(t.accent.primary, t.mode === 'dark' ? 0.30 : 0.16),
            withAlpha(t.accent.primary, t.mode === 'dark' ? 0.08 : 0.04),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3), padding: t.spacing(3) }}
        >
          <Animated.View style={{
            width: 44, height: 44, borderRadius: 22,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: t.accent.primary,
            borderWidth: 1.5, borderColor: t.colors.brass,
            transform: [{ scale: badgeScale }],
            shadowColor: t.accent.primary,
            shadowOpacity: 0.45, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 5,
          }}>
            <Ionicons name="checkmark-sharp" size={24} color={t.accent.onPrimary} />
          </Animated.View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 15, letterSpacing: 0.2 }}>
              {s.goalCompleteTitle}
            </Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {s.goalCompleteSubtitle}
            </Text>
          </View>

          {extra > 0 && (
            <View style={{
              alignItems: 'center', justifyContent: 'center',
              minWidth: 52,
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1.5),
              borderRadius: t.radius.pill,
              backgroundColor: withAlpha(t.colors.brass, t.mode === 'dark' ? 0.22 : 0.16),
              borderWidth: 0.75, borderColor: withAlpha(t.colors.brass, 0.5),
            }}>
              <Text style={{ color: t.colors.brass, fontWeight: '800', fontSize: 16, lineHeight: 19 }}>
                +{extra}
              </Text>
              <Text style={{ color: t.colors.brass, fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {s.goalCompleteBeyond}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </Animated.View>
  );
}
