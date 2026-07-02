import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { ArabesqueMark } from '@/components/ArabesqueMark';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Passed to every step so it can drive the flow from its own footer.
export interface OnbNav {
  index: number;
  total: number;
  next: () => void;   // advance to the next step (or finish on the last)
  back: () => void;   // return to the previous step
  finish: () => void; // complete onboarding and enter the app
}

// Adds an 8-bit alpha channel to a #RRGGBB hex so we can tint accents at low
// opacity without hard-coding per-theme colours.
export function withAlpha(hex: string, a: number): string {
  const n = Math.round(Math.max(0, Math.min(1, a)) * 255);
  return `${hex}${n.toString(16).padStart(2, '0')}`;
}

// Slim overall-progress bar shown at the top of every step. `progress` is a
// 0..1 fraction; the fill is animated by the flow via an Animated.Value.
export function ProgressBar({ progress }: { progress: Animated.AnimatedInterpolation<number> | Animated.Value | number }) {
  const t = useTheme();
  const width =
    typeof progress === 'number'
      ? `${Math.round(progress * 100)}%`
      : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: t.colors.surfaceMuted, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', borderRadius: 3, width: width as unknown as number }}>
        <LinearGradient
          colors={[t.accent.primary, t.colors.brass]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// Centered eyebrow + title + subtitle used by the informational steps.
export function StepHeader({
  eyebrow, title, subtitle, align = 'center',
}: { eyebrow?: string; title: string; subtitle?: string; align?: 'center' | 'left' }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing(2), alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      {eyebrow ? (
        <Text style={{
          color: t.colors.brass, fontSize: 12, fontWeight: '800',
          letterSpacing: 1.6, textTransform: 'uppercase',
        }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text style={{
        color: t.colors.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.2,
        textAlign: align,
      }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{
          color: t.colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: align,
        }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// Large circular gradient halo with a faint arabesque and a centred glyph —
// the on-brand replacement for the sample app's raster illustrations.
export function Halo({ size = 240, icon, children }: { size?: number; icon?: IoniconName; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: withAlpha(t.accent.primary, t.mode === 'dark' ? 0.16 : 0.12),
    }}>
      <LinearGradient
        colors={[withAlpha(t.accent.primary, 0.0), withAlpha(t.accent.primary, 0.32)]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', opacity: t.mode === 'dark' ? 0.16 : 0.14 }}>
        <ArabesqueMark size={size * 0.92} color={t.colors.brass} strokeWidth={0.8} />
      </View>
      {icon ? <Ionicons name={icon} size={size * 0.34} color={t.accent.primary} /> : null}
      {children}
    </View>
  );
}

// Icon + label row used to enumerate a feature's highlights.
export function FeatureBullet({ icon, text }: { icon: IoniconName; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: withAlpha(t.accent.primary, t.mode === 'dark' ? 0.20 : 0.14),
      }}>
        <Ionicons name={icon} size={18} color={t.accent.primary} />
      </View>
      <Text style={{ color: t.colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{text}</Text>
    </View>
  );
}

// Bottom-pinned action area shared by every step.
export function OnbFooter({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ paddingTop: t.spacing(3), gap: t.spacing(2) }}>
      {children}
    </View>
  );
}
