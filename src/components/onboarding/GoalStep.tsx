import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/Button';
import { Halo, StepHeader, OnbFooter, withAlpha, type OnbNav } from './parts';

// Preset daily targets — mirror the settings/goal-edit choices so a habit set
// here carries straight into the home goal ring.
const GOAL_PRESETS = [5, 10, 20, 50, 100];

// Commitment step — the user picks a daily verse goal that seeds their streak
// and the home progress ring. Selecting a preset commits live to the store.
export function GoalStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  const goal = useAppStore(st => st.dailyGoalVerses);
  const setDailyGoal = useAppStore(st => st.setDailyGoal);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing(6) }}>
        <View style={{ alignItems: 'center' }}>
          <Halo size={200}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: t.accent.primary, fontSize: 52, fontWeight: '900' }}>{goal}</Text>
              <Text style={{ color: t.colors.brass, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
                {s.versesPerDay}
              </Text>
            </View>
          </Halo>
        </View>

        <StepHeader eyebrow={s.onbGoalEyebrow} title={s.onbGoalTitle} subtitle={s.onbGoalSubtitle} />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: t.spacing(2) }}>
          {GOAL_PRESETS.map(n => {
            const active = goal === n;
            return (
              <Pressable
                key={n}
                onPress={() => setDailyGoal(n)}
                style={{
                  paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3),
                  borderRadius: t.radius.pill,
                  backgroundColor: active ? t.accent.primary : withAlpha(t.accent.primary, t.mode === 'dark' ? 0.14 : 0.08),
                  borderWidth: 1.25,
                  borderColor: active ? t.accent.primary : 'transparent',
                }}
              >
                <Text style={{
                  color: active ? t.accent.onPrimary : t.colors.text,
                  fontWeight: '800', fontSize: 16,
                }}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <OnbFooter>
        <Button label={s.onbContinue} onPress={nav.next} right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />} />
      </OnbFooter>
    </View>
  );
}
