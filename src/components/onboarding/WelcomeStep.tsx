import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { AyahOneLogo } from '@/components/AyahOneLogo';
import { Button } from '@/components/Button';
import { OnbFooter, type OnbNav } from './parts';

// First screen of the walkthrough: a calm, branded hero. The logo scales and
// the wordmark lifts into place, echoing the boot splash so the transition
// from splash → onboarding feels continuous.
export function WelcomeStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();

  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 620, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, lift]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(6) }}>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <AyahOneLogo
            size={160}
            brass={t.colors.brass}
            accent={t.accent.primary}
            background={t.colors.background}
          />
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', gap: t.spacing(3), opacity, transform: [{ translateY: lift }] }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ color: t.colors.text, fontSize: 40, fontWeight: '800', letterSpacing: 1.2 }}>Ayah</Text>
            <Text style={{ color: t.colors.brass, fontSize: 40, fontWeight: '800', letterSpacing: 1.2 }}>One</Text>
            <Text style={{ color: t.accent.primary, fontSize: 40, fontWeight: '900', marginLeft: 2 }}>.</Text>
          </View>
          <Text style={{ color: t.colors.brass, fontSize: 20, opacity: 0.9, letterSpacing: 0.5 }}>
            آيةً  آية
          </Text>
          <Text style={{
            color: t.colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: t.spacing(2),
          }}>
            {s.onbWelcomeTitle}
          </Text>
          <Text style={{
            color: t.colors.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center',
            paddingHorizontal: t.spacing(4),
          }}>
            {s.onbWelcomeSubtitle}
          </Text>
        </Animated.View>
      </View>

      <OnbFooter>
        <Button label={s.onbBegin} onPress={nav.next} />
      </OnbFooter>
    </View>
  );
}
