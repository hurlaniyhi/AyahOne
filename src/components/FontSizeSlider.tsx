import React, { useRef, useState } from 'react';
import { View, Text, PanResponder, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { ARABIC_FONT_MIN, ARABIC_FONT_MAX } from '@/store/appStore';

// Continuous Arabic font-size slider. The thumb tracks the finger 1:1 across
// the full ARABIC_FONT_MIN..ARABIC_FONT_MAX range — dragging right grows the
// font, dragging left shrinks it. A light haptic fires on each integer px
// crossing so the user gets tactile feedback without snap-to-stop semantics.
// Shared by the Quran-display settings screen and the onboarding walkthrough.
export function FontSizeSlider({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const [trackW, setTrackW] = useState(0);
  // Refs so the PanResponder callbacks always read the latest committed value
  // and measured track width without re-creating the responder each render.
  const valueRef = useRef(value);
  valueRef.current = value;
  const trackWRef = useRef(trackW);
  trackWRef.current = trackW;

  const sizeFromX = (x: number) => {
    const w = trackWRef.current;
    if (w <= 0) return valueRef.current;
    const ratio = Math.max(0, Math.min(1, x / w));
    return Math.round(ARABIC_FONT_MIN + ratio * (ARABIC_FONT_MAX - ARABIC_FONT_MIN));
  };
  const commit = (px: number) => {
    if (px === valueRef.current) return;
    valueRef.current = px;
    void Haptics.selectionAsync();
    onChange(px);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => commit(sizeFromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e: GestureResponderEvent) => commit(sizeFromX(e.nativeEvent.locationX)),
    }),
  ).current;

  const fillPct = (value - ARABIC_FONT_MIN) / (ARABIC_FONT_MAX - ARABIC_FONT_MIN);
  const thumbSize = 26;
  return (
    <View style={{ gap: t.spacing(2) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 14, fontWeight: '700' }}>A</Text>
        <View
          onLayout={e => setTrackW(e.nativeEvent.layout.width)}
          style={{ flex: 1, height: 36, justifyContent: 'center' }}
          {...pan.panHandlers}
        >
          {/* Track */}
          <View style={{
            position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
            backgroundColor: t.colors.border,
          }} />
          {/* Accent-filled portion up to the thumb */}
          <View style={{
            position: 'absolute', left: 0, height: 4, borderRadius: 2,
            width: `${fillPct * 100}%`,
            backgroundColor: t.accent.primary,
          }} />
          {/* Draggable thumb — positioned by interpolating across the measured
              track width so the gesture and the visual stay in lockstep. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: (36 - thumbSize) / 2,
              left: trackW > 0 ? trackW * fillPct - thumbSize / 2 : -thumbSize,
              width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2,
              backgroundColor: t.accent.primary,
              borderWidth: 3, borderColor: t.colors.background,
              shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5,
              shadowOffset: { width: 0, height: 2 }, elevation: 4,
            }}
          />
        </View>
        <Text style={{ color: t.colors.textMuted, fontSize: 26, fontWeight: '700' }}>A</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
          {ARABIC_FONT_MIN}px
        </Text>
        <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
          {ARABIC_FONT_MAX}px
        </Text>
      </View>
    </View>
  );
}
