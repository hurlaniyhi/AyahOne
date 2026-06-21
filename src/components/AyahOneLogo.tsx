import React from 'react';
import { Animated } from 'react-native';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, ClipPath, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Props {
  size?: number;
  brass?: string;
  accent?: string;
  background?: string;
  // Optional animated values. When provided, the arch stroke draws in and a
  // brass shimmer rect can be swept across the badge. Static when omitted.
  archProgress?: Animated.AnimatedInterpolation<number>;
  shimmerX?: Animated.AnimatedInterpolation<number>;
}

// Mihrab arch + Khatem-Sulayman star badge — the AyahOne identity glyph.
// All paths are computed from `size` so the mark stays geometrically perfect
// at any scale. The arch is a lancet (pointed) silhouette that traces from
// the base, up the shoulders, into the apex via twin quadratic curves.
// Inside the niche sits an eight-point star formed by two squares rotated
// 45° against each other, with a brass medallion at the center.
export function AyahOneLogo({
  size = 180,
  brass = '#B08641',
  accent = '#0F6B5C',
  background = '#FBF7F0',
  archProgress,
  shimmerX,
}: Props) {
  const s = size;
  const c = s / 2;
  // Outer parchment badge — round panel with hairline brass border so the
  // mark reads as a coin / medallion on any backdrop.
  const badgeR = s * 0.48;
  // Lancet arch coordinates: base at y=0.86s, shoulders at y=0.42s, apex at
  // y=0.12s. The arch sits inset within the badge so the brass border frames
  // the whole composition.
  const archHalfW = s * 0.22;
  const baseY = s * 0.82;
  const shoulderY = s * 0.42;
  const apexY = s * 0.14;
  const xL = c - archHalfW;
  const xR = c + archHalfW;
  // Each side traces base → shoulder → apex with one quadratic curve. The
  // control point sits at the shoulder corner so the curve flares out before
  // converging on the apex, giving the niche a true lancet profile.
  const archPath = `M ${xL} ${baseY} L ${xL} ${shoulderY} Q ${xL} ${apexY} ${c} ${apexY} Q ${xR} ${apexY} ${xR} ${shoulderY} L ${xR} ${baseY}`;
  // Eight-point star: two concentric squares rotated 0° / 45° around the
  // niche centroid. Star sits low in the niche so the apex of the arch
  // breathes above it.
  const starCx = c;
  const starCy = s * 0.50;
  const starR = s * 0.13;
  const square = (rot: number) => {
    const pts = [
      { x: starCx - starR, y: starCy },
      { x: starCx, y: starCy - starR },
      { x: starCx + starR, y: starCy },
      { x: starCx, y: starCy + starR },
    ];
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const r = pts.map(p => ({
      x: starCx + (p.x - starCx) * cos - (p.y - starCy) * sin,
      y: starCy + (p.x - starCx) * sin + (p.y - starCy) * cos,
    }));
    return `M${r[0].x},${r[0].y} L${r[1].x},${r[1].y} L${r[2].x},${r[2].y} L${r[3].x},${r[3].y} Z`;
  };
  // Approximate arch path length for the stroke-dashoffset animation. The
  // value is conservative (slightly over actual) so any rounding still hides
  // the dashes off-screen at progress=0.
  const archLen = s * 2.8;
  // Calligraphic baseline ornament — thin brass stroke + two terminal dots
  // beneath the arch, evoking a takhmis / line-break flourish.
  const lineY = baseY + s * 0.045;
  const lineHalf = archHalfW * 1.15;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        <LinearGradient id="aoBrass" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brass} stopOpacity={1} />
          <Stop offset="1" stopColor={brass} stopOpacity={0.78} />
        </LinearGradient>
        <LinearGradient id="aoAccent" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity={0.16} />
          <Stop offset="1" stopColor={accent} stopOpacity={0.02} />
        </LinearGradient>
        <ClipPath id="aoBadgeClip">
          <Circle cx={c} cy={c} r={badgeR - 1} />
        </ClipPath>
      </Defs>
      {/* Badge — parchment disc with hairline brass border */}
      <Circle cx={c} cy={c} r={badgeR} fill={background} stroke={brass} strokeWidth={1.25} strokeOpacity={0.55} />
      {/* Inner niche fill — subtle emerald wash that gives the arch depth */}
      <Path d={`${archPath} Z`} fill="url(#aoAccent)" />
      {/* Arch silhouette — animated stroke that draws in from base → apex */}
      {archProgress ? (
        <AnimatedPath
          d={archPath}
          fill="none"
          stroke={brass}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${archLen} ${archLen}`}
          strokeDashoffset={archProgress.interpolate({ inputRange: [0, 1], outputRange: [archLen, 0] })}
        />
      ) : (
        <Path d={archPath} fill="none" stroke={brass} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* Eight-point star — two overlapping squares + medallion */}
      <G>
        <Path d={square(0)} fill={accent} fillOpacity={0.92} stroke={brass} strokeWidth={1} strokeLinejoin="round" />
        <Path d={square(45)} fill={accent} fillOpacity={0.78} stroke={brass} strokeWidth={1} strokeLinejoin="round" />
        <Circle cx={starCx} cy={starCy} r={starR * 0.38} fill={brass} />
        <Circle cx={starCx} cy={starCy} r={starR * 0.14} fill={background} />
      </G>
      {/* Calligraphic baseline ornament */}
      <Path d={`M ${c - lineHalf} ${lineY} L ${c + lineHalf} ${lineY}`} stroke={brass} strokeWidth={1.25} strokeOpacity={0.7} strokeLinecap="round" />
      <Circle cx={c - lineHalf} cy={lineY} r={1.6} fill={brass} />
      <Circle cx={c + lineHalf} cy={lineY} r={1.6} fill={brass} />
      <Circle cx={c} cy={lineY} r={2.2} fill={brass} fillOpacity={0.9} />
      {/* Brass shimmer — narrow translucent rectangle that sweeps across the
          badge during the splash animation. Clipped to the badge circle. */}
      {shimmerX ? (
        <G clipPath="url(#aoBadgeClip)">
          <AnimatedRect
            x={shimmerX.interpolate({ inputRange: [0, 1], outputRange: [-s * 0.7, s * 0.7] })}
            y={0}
            width={s * 0.28}
            height={s}
            fill={brass}
            fillOpacity={0.18}
            transform={`rotate(18 ${c} ${c})`}
          />
        </G>
      ) : null}
    </Svg>
  );
}
