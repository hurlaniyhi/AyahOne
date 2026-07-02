import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/Button';
import { Halo, OnbFooter, withAlpha, type OnbNav } from './parts';

// Closing screen — a warm, personalised send-off. The halo checkmark springs
// in and the copy greets the user by name when they gave one, so entering the
// app feels earned rather than abrupt.
export function FinishStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  const name = useAppStore(st => st.profile.name).trim();

  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pop, { toValue: 1, duration: 620, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [pop, rise]);

  const title = name ? `${s.onbFinishTitle}, ${name}` : s.onbFinishTitle;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(6) }}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Halo size={220}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: withAlpha(t.accent.primary, t.mode === 'dark' ? 0.28 : 0.18),
            }}>
              <Ionicons name="checkmark" size={56} color={t.accent.primary} />
            </View>
          </Halo>
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', gap: t.spacing(3), opacity: pop, transform: [{ translateY: rise }] }}>
          <Text style={{ color: t.colors.brass, fontSize: 22, opacity: 0.9, letterSpacing: 0.5 }}>
            الحمد لله
          </Text>
          <Text style={{ color: t.colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' }}>
            {title}
          </Text>
          <Text style={{
            color: t.colors.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center',
            paddingHorizontal: t.spacing(4),
          }}>
            {s.onbFinishSubtitle}
          </Text>
        </Animated.View>
      </View>

      <OnbFooter>
        <Button
          label={s.onbFinishCta}
          onPress={nav.finish}
          right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />}
        />
      </OnbFooter>
    </View>
  );
}
