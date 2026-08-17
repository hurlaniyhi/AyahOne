import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
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
  // Whether the goal is being entered as a free-form number rather than one
  // of the presets — seeded from the current goal so a value carried in from
  // a previous run of this step (back/forward navigation) shows the input
  // pre-filled instead of no chip active at all.
  const [customMode, setCustomMode] = useState(() => !GOAL_PRESETS.includes(goal));
  const [customText, setCustomText] = useState(() => (!GOAL_PRESETS.includes(goal) ? String(goal) : ''));

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
            const active = !customMode && goal === n;
            return (
              <Pressable
                key={n}
                onPress={() => { setDailyGoal(n); setCustomMode(false); setCustomText(''); }}
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
          {/* A verse goal outside the presets has no chip of its own
              otherwise — tapping this reveals a plain number field instead of
              forcing a fixed count. */}
          <Pressable
            onPress={() => { setCustomMode(true); if (!customText) setCustomText(String(goal)); }}
            style={{
              paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3),
              borderRadius: t.radius.pill,
              backgroundColor: customMode ? t.accent.primary : withAlpha(t.accent.primary, t.mode === 'dark' ? 0.14 : 0.08),
              borderWidth: 1.25,
              borderColor: customMode ? t.accent.primary : 'transparent',
            }}
          >
            <Text style={{
              color: customMode ? t.accent.onPrimary : t.colors.text,
              fontWeight: '800', fontSize: 16,
            }}>
              {s.goalCustomLabel}
            </Text>
          </Pressable>
        </View>

        {customMode && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: t.spacing(2) }}>
            <TextInput
              value={customText}
              onChangeText={txt => {
                const digits = txt.replace(/[^0-9]/g, '');
                setCustomText(digits);
                const n = parseInt(digits, 10);
                if (n > 0) setDailyGoal(n);
              }}
              placeholder={s.goalCustomPlaceholder}
              placeholderTextColor={t.colors.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={{
                width: 120, textAlign: 'center',
                backgroundColor: withAlpha(t.accent.primary, t.mode === 'dark' ? 0.14 : 0.08),
                borderWidth: 1.25, borderColor: t.accent.primary,
                borderRadius: t.radius.pill,
                paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(3),
                color: t.colors.text, fontSize: 16, fontWeight: '800',
              }}
            />
            <Text style={{ color: t.colors.textMuted, fontWeight: '600' }}>{s.versesPerDay}</Text>
          </View>
        )}
      </View>

      <OnbFooter>
        <Button label={s.onbContinue} onPress={nav.next} right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />} />
      </OnbFooter>
    </View>
  );
}
