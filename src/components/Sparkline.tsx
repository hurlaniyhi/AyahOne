import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  color: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

/**
 * Minimal sparkline with a soft gradient area fill.
 * Renders nothing if values is empty or all zeros (caller decides fallback).
 */
export function Sparkline({ values, width = 96, height = 32, color, fillOpacity = 0.18, strokeWidth = 1.75 }: Props) {
  if (!values.length) return <View style={{ width, height }} />;
  const max = Math.max(...values, 1);
  const min = 0;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / (max - min)) * (height - 2) - 1;
    return [x, y] as const;
  });
  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`))
    .join(' ');
  const areaPath = `${linePath} L${width.toFixed(2)},${height} L0,${height} Z`;
  const gradId = `sg-${Math.abs(color.split('').reduce((a, c) => a + c.charCodeAt(0), 0))}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={fillOpacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#${gradId})`} />
      <Path d={linePath} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
