import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';

const KAHF_TOTAL_AYAH = 110;

/**
 * Brass arabesque ring — two interlocking eight-point stars inside a beaded
 * ring with radiating rays. Mirrors the geometry language of the goal
 * medallion but with a denser, more devotional silhouette so the Kahf
 * celebration reads as a distinct, weekly milestone.
 */
function NoorMedallion({ size, brass, emerald }: { size: number; brass: string; emerald: string }) {
  const c = size / 2;
  const r = c * 0.88;
  const star = (rot: number) => {
    const half = r * 0.62;
    const pts = [
      { x: c, y: c - half }, { x: c + half, y: c }, { x: c, y: c + half }, { x: c - half, y: c },
    ];
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotated = pts.map(p => {
      const dx = p.x - c, dy = p.y - c;
      return { x: c + dx * cos - dy * sin, y: c + dx * sin + dy * cos };
    });
    return `M${rotated[0].x},${rotated[0].y} L${rotated[1].x},${rotated[1].y} L${rotated[2].x},${rotated[2].y} L${rotated[3].x},${rotated[3].y} Z`;
  };
  const rays = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);
  return (
    <Svg width={size} height={size}>
      {rays.map((rot, i) => (
        <G key={i} rotation={rot} origin={`${c}, ${c}`}>
          <Line x1={c} y1={c * 0.04} x2={c} y2={c * 0.18} stroke={brass} strokeWidth={1.25} strokeLinecap="round" opacity={0.55} />
        </G>
      ))}
      <Circle cx={c} cy={c} r={r} stroke={brass} strokeWidth={1.25} fill="none" opacity={0.7} />
      <Circle cx={c} cy={c} r={r * 0.84} stroke={brass} strokeWidth={0.75} fill="none" opacity={0.45} strokeDasharray="2 4" />
      <G fill="none" stroke={brass} strokeWidth={1.2} strokeLinejoin="round" opacity={0.85}>
        <Path d={star(0)} />
        <Path d={star(45)} />
      </G>
      <Circle cx={c} cy={c} r={r * 0.32} stroke={brass} strokeWidth={1} fill="none" />
      <Circle cx={c} cy={c} r={r * 0.16} fill={emerald} opacity={0.06} />
    </Svg>
  );
}

export function KahfCelebrationModal() {
  const t = useTheme();
  const s = useStrings();
  const visible = useAppStore(st => st.kahfCelebrationVisible);
  const dismiss = useAppStore(st => st.dismissKahfCelebration);

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const ribbon = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    fade.setValue(0); scale.setValue(0.82); ribbon.setValue(0);
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1, friction: 6, tension: 88, useNativeDriver: true }),
      Animated.timing(ribbon, { toValue: 1, duration: 560, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, fade, scale, ribbon, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ribbonScale = ribbon.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const close = () => dismiss();

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: 'rgba(6, 47, 42, 0.62)', alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) }}>
        <Pressable onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={{
          transform: [{ scale }], width: '100%', maxWidth: 380,
          backgroundColor: t.colors.surfaceElevated,
          borderRadius: t.radius.xl, borderWidth: 1, borderColor: t.colors.brass,
          paddingHorizontal: t.spacing(5), paddingTop: t.spacing(7), paddingBottom: t.spacing(5),
          alignItems: 'center', gap: t.spacing(3),
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 20,
        }}>
          {/* Brass eyebrow ribbon — sits above the medallion so the modal
              identifies itself the moment it appears. */}
          <View style={{
            position: 'absolute', top: -14, alignSelf: 'center',
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1),
            backgroundColor: t.colors.brass, borderRadius: t.radius.pill,
            shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
          }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {s.kahfBadge ?? 'Friday Light'}
            </Text>
          </View>

          <View style={{ width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', transform: [{ rotate }] }}>
              <NoorMedallion size={168} brass={t.colors.brass} emerald={t.accent.primary} />
            </Animated.View>
            <View style={{
              width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.accent.primary, borderWidth: 2, borderColor: t.colors.brass,
              shadowColor: t.colors.brass, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
            }}>
              <Ionicons name="moon" size={30} color={t.accent.onPrimary} />
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: ribbonScale }], alignItems: 'center', gap: 6 }}>
            <Text style={{ color: t.colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 0.3 }}>
              {s.kahfCompleted}
            </Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: t.spacing(2) }}>
              {s.kahfCompletedSubtitle}
            </Text>
          </Animated.View>

          <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: t.colors.hairline, marginVertical: t.spacing(1) }} />

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
            backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.lg,
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2.5), alignSelf: 'stretch',
          }}>
            <Ionicons name="book" size={18} color={t.accent.primary} />
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 14 }}>
              {`${KAHF_TOTAL_AYAH} / ${KAHF_TOTAL_AYAH} `}
              <Text style={{ color: t.colors.textMuted, fontWeight: '600' }}>{s.kahfAyahsLabel ?? 'ayahs'}</Text>
            </Text>
            <View style={{ flex: 1 }} />
            <View style={{ paddingHorizontal: t.spacing(2), paddingVertical: 4, backgroundColor: t.accent.primary, borderRadius: t.radius.pill }}>
              <Text style={{ color: t.accent.onPrimary, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 }}>{s.kahfCompleteBadge ?? '100%'}</Text>
            </View>
          </View>

          <Text style={{ color: t.colors.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: t.spacing(2), marginTop: t.spacing(1) }}>
            {s.kahfCompletedQuote}
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
