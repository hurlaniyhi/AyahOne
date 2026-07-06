import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

const BAR_COUNT = 5;
// Per-bar weighting so the equalizer reads as organic rather than uniform
// blocks moving in lockstep.
const BAR_WEIGHTS = [0.55, 0.85, 1, 0.8, 0.6];

interface Props {
  isRecording: boolean;
  durationMillis: number;
  /** dBFS level from expo-audio metering (roughly -60..0), when available. */
  metering?: number;
  disabled?: boolean;
  onPress: () => void;
}

export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Normalizes a dBFS metering value to a 0..1 loudness fraction. */
function levelFromMetering(dbfs: number): number {
  return Math.max(0, Math.min(1, (dbfs + 60) / 60));
}

export function RecordButton({ isRecording, durationMillis, metering, disabled, onPress }: Props) {
  const t = useTheme();
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const barValues = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.15))).current;
  const idleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!isRecording) {
      ring1.setValue(0);
      ring2.setValue(0);
      idleLoopRef.current?.stop();
      barValues.forEach(v => Animated.timing(v, { toValue: 0.15, duration: 200, useNativeDriver: false }).start());
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(ring1, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 1, duration: 1600, delay: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    );
    loop.start(() => { ring1.setValue(0); ring2.setValue(0); });
    return () => loop.stop();
  }, [isRecording, ring1, ring2, barValues]);

  // Drive the equalizer from real mic level when metering is available;
  // otherwise fall back to a gentle synthetic breathing animation so the
  // control still feels alive on platforms/configs without metering.
  useEffect(() => {
    if (!isRecording) return;
    if (typeof metering === 'number') {
      const level = levelFromMetering(metering);
      barValues.forEach((v, i) => {
        Animated.timing(v, {
          toValue: Math.max(0.12, level * BAR_WEIGHTS[i]),
          duration: 90,
          useNativeDriver: false,
        }).start();
      });
      return;
    }
    const anims = barValues.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.35 + 0.4 * BAR_WEIGHTS[i], duration: 420 + i * 60, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.15, duration: 420 + i * 60, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      ),
    );
    idleLoopRef.current = Animated.parallel(anims);
    idleLoopRef.current.start();
    return () => idleLoopRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, metering === undefined]);

  useEffect(() => {
    if (isRecording && typeof metering === 'number') {
      const level = levelFromMetering(metering);
      barValues.forEach((v, i) => {
        Animated.timing(v, { toValue: Math.max(0.12, level * BAR_WEIGHTS[i]), duration: 90, useNativeDriver: false }).start();
      });
    }
  }, [metering]);

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(press, { toValue: t.pressedScale, duration: 80, useNativeDriver: true }),
      Animated.timing(press, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const tint = isRecording ? t.colors.danger : t.accent.primary;
  const ring1Scale = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ring1Opacity = ring1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.35, 0.12, 0] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const ring2Opacity = ring2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.35, 0.12, 0] });

  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', width: 96, height: 96, borderRadius: 48,
          backgroundColor: tint, opacity: ring2Opacity, transform: [{ scale: ring2Scale }],
        }} />
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', width: 96, height: 96, borderRadius: 48,
          backgroundColor: tint, opacity: ring1Opacity, transform: [{ scale: ring1Scale }],
        }} />
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <Pressable
            onPress={handlePress}
            disabled={disabled}
            style={{
              width: 96, height: 96, borderRadius: 48,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: tint,
              opacity: disabled ? 0.5 : 1,
              shadowColor: tint, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
            }}
          >
            <Ionicons name={isRecording ? 'square' : 'mic'} size={isRecording ? 30 : 36} color={t.accent.onPrimary} />
          </Pressable>
        </Animated.View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {barValues.map((v, i) => (
            <Animated.View
              key={i}
              style={{
                width: 3.5,
                borderRadius: 2,
                backgroundColor: tint,
                height: v.interpolate({ inputRange: [0, 1], outputRange: [4, 22] }),
                opacity: isRecording ? 1 : 0.25,
              }}
            />
          ))}
        </View>
        <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {formatMs(durationMillis)}
        </Text>
      </View>
    </View>
  );
}
