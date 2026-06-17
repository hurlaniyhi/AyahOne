import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { toArabicDigits } from '@/lib/quranText';

interface Props {
  number: number;
  size?: number;
  color?: string;
}

/**
 * Ornamental verse-end roundel — eight-point star outline with the
 * Arabic-Indic verse number centered. Used inline at the end of each
 * ayah in the reader, replacing a plain "(8)" parenthesized number.
 */
export function AyahMarker({ number, size = 28, color }: Props) {
  const t = useTheme();
  const stroke = color ?? t.colors.brass;
  const s = size;
  const c = s / 2;
  const r = s * 0.46;
  const square = (rot: number) => {
    const a = c - r, b = c + r;
    const pts = [
      { x: a, y: c }, { x: c, y: a }, { x: b, y: c }, { x: c, y: b },
    ];
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rotated = pts.map(p => {
      const dx = p.x - c, dy = p.y - c;
      return { x: c + dx * cos - dy * sin, y: c + dx * sin + dy * cos };
    });
    return `M${rotated[0].x},${rotated[0].y} L${rotated[1].x},${rotated[1].y} L${rotated[2].x},${rotated[2].y} L${rotated[3].x},${rotated[3].y} Z`;
  };
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} style={{ position: 'absolute' }}>
        <G fill="none" stroke={stroke} strokeWidth={0.9} strokeLinejoin="round">
          <Path d={square(0)} />
          <Path d={square(45)} />
          <Circle cx={c} cy={c} r={r * 0.62} />
        </G>
      </Svg>
      <Text style={{
        color: stroke,
        fontSize: Math.round(s * 0.42),
        fontWeight: '700',
        lineHeight: Math.round(s * 0.5),
      }}>
        {toArabicDigits(number)}
      </Text>
    </View>
  );
}
