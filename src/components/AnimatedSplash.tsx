import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, useColorScheme, useWindowDimensions } from 'react-native';
import { ArabesqueMark } from './ArabesqueMark';
import { AyahOneLogo } from './AyahOneLogo';

interface Props {
  // Fires once every stage of the entrance animation has played. Parent is
  // expected to keep this component mounted until both this callback AND any
  // asynchronous boot work (font loading, store hydration) have completed.
  onAnimationDone?: () => void;
}

// Palette mirrors `palettes.ts` so the splash matches the live Mihrab theme
// regardless of system colour scheme. Kept inline to avoid pulling the theme
// provider (and its dependency on the hydrated store) into the boot path.
const LIGHT = { bg: '#FBF7F0', text: '#1B1A17', muted: '#6C6557', brass: '#B08641', accent: '#0F6B5C' };
const DARK = { bg: '#0B1115', text: '#F1E8D5', muted: '#8C9AA6', brass: '#D1A24A', accent: '#3CC2A1' };

export function AnimatedSplash({ onAnimationDone }: Props) {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? DARK : LIGHT;
  const { width } = useWindowDimensions();
  const logoSize = Math.min(width * 0.42, 200);

  const archProgress = useRef(new Animated.Value(0)).current;
  const starScale = useRef(new Animated.Value(0.55)).current;
  const starOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordLift = useRef(new Animated.Value(10)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(0)).current;
  const ornamentOpacity = useRef(new Animated.Value(0)).current;
  const ornamentSpin = useRef(new Animated.Value(0)).current;

  // Keep the latest onAnimationDone in a ref so the effect can stay
  // dependency-free (parent re-renders pass a fresh inline callback every
  // time, which would otherwise restart the sequence mid-flight).
  const onDoneRef = useRef(onAnimationDone);
  useEffect(() => { onDoneRef.current = onAnimationDone; }, [onAnimationDone]);

  useEffect(() => {
    // Background ornament fade + endless slow rotation. Started independently
    // of the main sequence because Animated.loop never resolves, and nesting
    // it inside Animated.sequence would freeze every step after it.
    const fade = Animated.timing(ornamentOpacity, {
      toValue: 0.18, duration: 500, useNativeDriver: true,
    });
    const spin = Animated.loop(
      Animated.timing(ornamentSpin, {
        toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true,
      })
    );
    fade.start();
    spin.start();

    // Main entrance choreography. Native driver where possible (opacity /
    // transform) and JS driver only on SVG stroke-dashoffset / rect-x, since
    // react-native-svg props aren't compatible with the native driver.
    const seq = Animated.sequence([
      Animated.timing(archProgress, {
        toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }),
      Animated.parallel([
        Animated.timing(starOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(starScale, {
          toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 460, useNativeDriver: true }),
        Animated.timing(wordLift, { toValue: 0, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(subOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(shimmerX, {
        toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
      }),
      Animated.delay(220),
    ]);

    // Single-fire guard so neither the sequence callback nor the safety
    // timeout can advance the parent twice.
    let fired = false;
    const fire = () => { if (!fired) { fired = true; onDoneRef.current?.(); } };

    // Safety net: if any frame in the sequence silently drops its completion
    // callback (rare, but seen on some Android builds with the native driver
    // mixed with JS-driven SVG props), never strand the user on the splash.
    const safety = setTimeout(fire, 5000);

    seq.start(({ finished }) => { if (finished) fire(); });

    return () => {
      clearTimeout(safety);
      seq.stop();
      spin.stop();
      fade.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = ornamentSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterSpin = ornamentSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ornament — two large, faint arabesque marks counter-rotating
          behind the logo, adding subtle motion without competing for attention. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: '12%', opacity: ornamentOpacity,
          transform: [{ rotate: spin }],
        }}
      >
        <ArabesqueMark size={Math.min(width * 0.9, 420)} color={c.brass} strokeWidth={0.6} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: '8%', opacity: ornamentOpacity,
          transform: [{ rotate: counterSpin }],
        }}
      >
        <ArabesqueMark size={Math.min(width * 0.6, 280)} color={c.accent} strokeWidth={0.6} />
      </Animated.View>

      {/* Logo — arch strokes in first, then the star fades + scales into place */}
      <View style={{ alignItems: 'center', gap: 28 }}>
        <Animated.View style={{ transform: [{ scale: starScale }], opacity: starOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }}>
          <AyahOneLogo
            size={logoSize}
            brass={c.brass}
            accent={c.accent}
            background={c.bg}
            archProgress={archProgress}
            shimmerX={shimmerX}
          />
        </Animated.View>

        {/* Wordmark — two-tone "Ayah" + "One" with a brass full-stop accent.
            Lifts and fades in as a single block after the logo lands. */}
        <Animated.View style={{
          alignItems: 'center',
          opacity: wordOpacity,
          transform: [{ translateY: wordLift }],
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{
              color: c.text, fontSize: 44, fontWeight: '800', letterSpacing: 1.6,
            }}>
              Ayah
            </Text>
            <Text style={{
              color: c.brass, fontSize: 44, fontWeight: '800', letterSpacing: 1.6,
            }}>
              One
            </Text>
            <Text style={{
              color: c.accent, fontSize: 44, fontWeight: '900', marginLeft: 2,
            }}>
              .
            </Text>
          </View>

          {/* Arabic tagline — "ayatan ayah" (verse by verse). Rendered with the
              system Arabic fallback since custom fonts aren't guaranteed to
              be loaded yet at splash time. */}
          <Text style={{
            color: c.brass, fontSize: 20, marginTop: 8,
            opacity: 0.85, letterSpacing: 0.5,
          }}>
            آيةً  آية
          </Text>

          {/* Thin brass divider — three dots flanking a hairline */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.brass, opacity: 0.7 }} />
            <View style={{ width: 28, height: 1, backgroundColor: c.brass, opacity: 0.55 }} />
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.brass }} />
            <View style={{ width: 28, height: 1, backgroundColor: c.brass, opacity: 0.55 }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c.brass, opacity: 0.7 }} />
          </View>
        </Animated.View>

        {/* Subtitle — final, gentlest beat in the sequence */}
        <Animated.Text style={{
          color: c.muted, fontSize: 13, letterSpacing: 2.4,
          textTransform: 'uppercase', fontWeight: '600',
          opacity: subOpacity, marginTop: 4,
        }}>
          Read  ·  Reflect  ·  Grow
        </Animated.Text>
      </View>
    </View>
  );
}
