import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { useTodayStats } from '@/store/selectors';
import { formatDuration, formatNumber } from '@/lib/format';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Brass starburst medallion — eight-point star inside a beaded ring with
 * radiating rays. The whole group counter-rotates slowly behind the badge.
 */
function StarburstMedallion({ size, brass, emerald, parchment }: { size: number; brass: string; emerald: string; parchment: string }) {
  const c = size / 2;
  const rings = [c * 0.92, c * 0.78];
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <Svg width={size} height={size}>
      {rays.map((rot, i) => (
        <G key={i} rotation={rot} origin={`${c}, ${c}`}>
          <Line x1={c} y1={c * 0.06} x2={c} y2={c * 0.22} stroke={brass} strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
        </G>
      ))}
      <Circle cx={c} cy={c} r={rings[0]} stroke={brass} strokeWidth={1} fill="none" opacity={0.5} />
      <Circle cx={c} cy={c} r={rings[1]} stroke={brass} strokeWidth={0.75} fill="none" opacity={0.35} strokeDasharray="2 4" />
      {[0, 45].map(rot => {
        const r = c * 0.62;
        const pts = `${c},${c - r} ${c + r},${c} ${c},${c + r} ${c - r},${c}`;
        return <G key={rot} rotation={rot} origin={`${c}, ${c}`}><Path d={`M${pts}Z`} fill={emerald} opacity={rot === 0 ? 0.95 : 0.85} /></G>;
      })}
      <Circle cx={c} cy={c} r={c * 0.18} fill={parchment} stroke={brass} strokeWidth={1.5} />
      <Circle cx={c} cy={c} r={c * 0.08} fill={brass} />
    </Svg>
  );
}

interface StatPillProps { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: string; }
function StatPill({ icon, label, value, tint }: StatPillProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: t.spacing(2) }}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={{ color: t.colors.text, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

export function GoalCelebrationModal() {
  const t = useTheme();
  const s = useStrings();
  const visible = useAppStore(st => st.celebrationVisible);
  const dismiss = useAppStore(st => st.dismissGoalCelebration);
  const goal = useAppStore(st => st.dailyGoalVerses);
  const today = useTodayStats();
  const hideHasanat = useAppStore(st => st.settings.hideHasanat);

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const ribbon = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    fade.setValue(0); scale.setValue(0.85); ribbon.setValue(0);
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(ribbon, { toValue: 1, duration: 520, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, fade, scale, ribbon, spin]);

  const close = () => {
    Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => dismiss());
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ribbonScale = ribbon.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: 'rgba(6, 47, 42, 0.55)', alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) }}>
        <Pressable onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={{
          transform: [{ scale }], width: '100%', maxWidth: 380,
          backgroundColor: t.colors.surfaceElevated,
          borderRadius: t.radius.xl, borderWidth: 1, borderColor: t.colors.brass,
          paddingHorizontal: t.spacing(5), paddingTop: t.spacing(7), paddingBottom: t.spacing(5),
          alignItems: 'center', gap: t.spacing(3),
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18,
        }}>
          <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', transform: [{ rotate }] }}>
              <StarburstMedallion size={160} brass={t.colors.brass} emerald={t.accent.primary} parchment={t.colors.surfaceElevated} />
            </Animated.View>
            <View style={{
              width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.accent.primary, borderWidth: 2, borderColor: t.colors.brass,
            }}>
              <Ionicons name="checkmark" size={28} color={t.accent.onPrimary} />
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: ribbonScale }], alignItems: 'center', gap: 4 }}>
            <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 0.3 }}>
              {s.dailyGoalAchieved}
            </Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 14, textAlign: 'center' }}>
              {s.dailyGoalAchievedSubtitle}
            </Text>
          </Animated.View>

          <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: t.colors.hairline, marginVertical: t.spacing(1) }} />

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.lg, paddingVertical: t.spacing(1) }}>
            <StatPill icon="book-outline" label={s.versesShort ?? 'Verses'} value={`${today.verses}/${goal}`} tint={t.accent.primary} />
            {!hideHasanat && (
              <>
                <View style={{ width: 1, marginVertical: 10, backgroundColor: t.colors.hairline }} />
                <StatPill icon="sparkles" label={s.hasanatShort ?? 'Hasanat'} value={formatNumber(today.hasanat)} tint={t.colors.brass} />
              </>
            )}
            <View style={{ width: 1, marginVertical: 10, backgroundColor: t.colors.hairline }} />
            <StatPill icon="time-outline" label={s.timeShort ?? 'Time'} value={formatDuration(today.timeSec)} tint={t.colors.tileBlue} />
          </View>

          <Text style={{ color: t.colors.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: t.spacing(2), marginTop: t.spacing(1) }}>
            {s.goalCelebrationQuote}
          </Text>

          <Pressable onPress={close} style={({ pressed }) => ({
            alignSelf: 'stretch', marginTop: t.spacing(2),
            backgroundColor: t.accent.primary, borderRadius: t.radius.pill,
            paddingVertical: t.spacing(3.5), alignItems: 'center',
            opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
            <Text style={{ color: t.accent.onPrimary, fontWeight: '800', fontSize: 16, letterSpacing: 0.4 }}>
              {s.alhamdulillah}
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
