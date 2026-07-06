import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number; // 0-100
  label?: string;
  size?: number;
}

export function ScoreGauge({ score, label, size = 148 }: Props) {
  const t = useTheme();
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    progress.setValue(0);
    const id = progress.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(progress, {
      toValue: score,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const tint = score >= 85 ? t.colors.success : score >= 60 ? t.colors.brass : t.colors.danger;
  const dashOffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={t.colors.surfaceMuted} strokeWidth={stroke} fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={tint} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: t.colors.text, fontSize: 34, fontWeight: '800' }}>{display}</Text>
        {label ? (
          <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
