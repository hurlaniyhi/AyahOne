import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Eight-point Islamic star (Khatem Sulayman / Rub el Hizb) — used as a
 * subtle decorative watermark on Cards and the reader background.
 * Two overlapping squares rotated 45°, with a center medallion.
 */
export function ArabesqueMark({ size = 96, color = '#B08641', strokeWidth = 1 }: Props) {
  const s = size;
  const c = s / 2;
  const r = s * 0.46;
  const square = (rot: number) => {
    const half = r;
    const a = c - half, b = c + half;
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
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
        <Path d={square(0)} />
        <Path d={square(45)} />
        <Circle cx={c} cy={c} r={r * 0.42} />
        <Circle cx={c} cy={c} r={r * 0.18} />
      </G>
    </Svg>
  );
}
