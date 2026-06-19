import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, PanResponder, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import {
  useAppStore,
  type ArabicScript,
  ARABIC_FONT_MIN,
  ARABIC_FONT_MAX,
} from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { arabicFontFor } from '@/lib/quranText';
import {
  TAJWEED_COLORS,
  TAJWEED_LABELS,
  TAJWEED_LEGEND_ORDER,
} from '@/lib/tajweed';

// Bismillah rendered in both editions; system Arabic font is shared but the
// underlying character set differs (hamzat-wasl, sukun glyphs, etc.).
const BISMILLAH: Record<ArabicScript, string> = {
  uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
  indopak: 'بِسْمِ اللہِ الرَّحْمٰنِ الرَّحِیْمِ',
  tajweed: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
};

// A hand-coloured Bismillah used in the Tajweed row preview so the user sees
// the rule palette without having to fetch the marked-up edition first.
const TAJWEED_PREVIEW_SEGMENTS: { text: string; rule?: keyof typeof TAJWEED_COLORS }[] = [
  { text: 'بِسْمِ ' },
  { text: 'ٱ', rule: 'h' },
  { text: 'للَّهِ ' },
  { text: 'ٱ', rule: 'h' },
  { text: 'لرَّحْمَ' },
  { text: 'ـٰ', rule: 'n' },
  { text: 'نِ ' },
  { text: 'ٱ', rule: 'h' },
  { text: 'لرَّحِي', rule: 'g' },
  { text: 'مِ' },
];

// Continuous Arabic font-size slider. The thumb tracks the finger 1:1 across
// the full ARABIC_FONT_MIN..ARABIC_FONT_MAX range — dragging right grows the
// font, dragging left shrinks it. A light haptic fires on each integer px
// crossing so the user gets tactile feedback without snap-to-stop semantics.
function FontSizeSlider({
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
  const thumbSize = 24;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
      <Text style={{ color: t.colors.textMuted, fontSize: 14, fontWeight: '700' }}>T</Text>
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
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 }, elevation: 3,
          }}
        />
      </View>
      <Text style={{ color: t.colors.textMuted, fontSize: 24, fontWeight: '700' }}>T</Text>
    </View>
  );
}

export default function QuranDisplayScreen() {
  const t = useTheme();
  const s = useStrings();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);

  const previewSize = settings.arabicFontSize;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(5) }}>
        {/* Live preview */}
        <View style={{
          padding: t.spacing(5), borderRadius: t.radius.lg,
          backgroundColor: t.colors.surface,
          borderWidth: 1, borderColor: t.accent.primary,
          borderStyle: 'dashed', alignItems: 'center',
        }}>
          <Text style={{
            color: t.colors.text, fontSize: previewSize,
            lineHeight: Math.round(previewSize * 1.8),
            textAlign: 'center', writingDirection: 'rtl',
            fontFamily: arabicFontFor(settings.arabicScript),
          }}>
            {BISMILLAH[settings.arabicScript]}
          </Text>
        </View>

        {/* Font size */}
        <View style={{ gap: t.spacing(3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>
              {s.fontSize}
            </Text>
            <Text style={{ color: t.colors.textMuted, fontWeight: '600', fontSize: 13 }}>
              {settings.arabicFontSize}px
            </Text>
          </View>
          <FontSizeSlider
            value={settings.arabicFontSize}
            onChange={v => setSetting('arabicFontSize', v)}
          />
        </View>

        {/* Script */}
        <View style={{ gap: t.spacing(3) }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>
            {s.quranScript}
          </Text>
          {([
            { id: 'uthmani' as const, label: s.scriptUthmani },
            { id: 'indopak' as const, label: s.scriptIndopak },
            { id: 'tajweed' as const, label: s.scriptTajweed },
          ]).map(opt => {
            const active = settings.arabicScript === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSetting('arabicScript', opt.id as ArabicScript)}
                style={{
                  padding: t.spacing(4), borderRadius: t.radius.lg,
                  backgroundColor: t.colors.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? t.accent.primary : t.colors.border,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  gap: t.spacing(3),
                }}
              >
                <Text style={{
                  color: active ? t.accent.primary : t.colors.text,
                  fontWeight: '700', fontSize: 16,
                }}>
                  {opt.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1, color: t.colors.text, fontSize: 18,
                    textAlign: 'right', writingDirection: 'rtl',
                    fontFamily: arabicFontFor(opt.id),
                  }}
                >
                  {opt.id === 'tajweed'
                    ? TAJWEED_PREVIEW_SEGMENTS.map((seg, i) => (
                        <Text key={i} style={seg.rule ? { color: TAJWEED_COLORS[seg.rule] } : undefined}>
                          {seg.text}
                        </Text>
                      ))
                    : BISMILLAH[opt.id]}
                </Text>
                {active && (
                  <Ionicons name="checkmark-circle" size={22} color={t.accent.primary} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Tajweed legend — only shown while the tajweed script is active */}
        {settings.arabicScript === 'tajweed' && (
          <View style={{ gap: t.spacing(3) }}>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>
              {s.tajweedLegend}
            </Text>
            <View style={{
              padding: t.spacing(4), borderRadius: t.radius.lg,
              backgroundColor: t.colors.surface,
              borderWidth: 1, borderColor: t.colors.border,
              flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(3),
            }}>
              {TAJWEED_LEGEND_ORDER.map(rule => (
                <View
                  key={rule}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), minWidth: '46%' }}
                >
                  <View style={{
                    width: 14, height: 14, borderRadius: 7,
                    backgroundColor: TAJWEED_COLORS[rule],
                  }} />
                  <Text style={{ color: t.colors.text, fontSize: 13 }}>
                    {TAJWEED_LABELS[rule]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
