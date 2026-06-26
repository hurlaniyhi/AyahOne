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
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { SettingsSection } from '@/components/SettingsRow';
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

export default function QuranDisplayScreen() {
  const t = useTheme();
  const s = useStrings();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);

  const previewSize = settings.arabicFontSize;

  const scriptOptions: { id: ArabicScript; label: string }[] = [
    { id: 'uthmani', label: s.scriptUthmani },
    { id: 'indopak', label: s.scriptIndopak },
    { id: 'tajweed', label: s.scriptTajweed },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), paddingBottom: t.spacing(8), gap: t.spacing(4) }}>
        {/* Live preview — surfaceElevated card with brass arabesque corners
            so the Bismillah feels like a mushaf page rather than a swatch. */}
        <View style={{
          padding: t.spacing(5), borderRadius: t.radius.lg,
          backgroundColor: t.colors.surfaceElevated,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          alignItems: 'center', overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: t.mode === 'dark' ? 0.35 : 0.06,
          shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: -16, left: -16, opacity: 0.18 }}>
            <ArabesqueMark size={72} color={t.colors.brass} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -16, right: -16, opacity: 0.18 }}>
            <ArabesqueMark size={72} color={t.colors.brass} />
          </View>
          <Text style={{
            color: t.colors.brass, fontSize: 11, fontWeight: '800',
            letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: t.spacing(2),
          }}>
            {scriptOptions.find(o => o.id === settings.arabicScript)?.label}
          </Text>
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
        <SettingsSection title={s.fontSize} />
        <View style={{
          padding: t.spacing(4), backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          gap: t.spacing(3),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 15 }}>
              {s.fontSize}
            </Text>
            <View style={{
              paddingHorizontal: t.spacing(3), paddingVertical: 4,
              borderRadius: t.radius.pill,
              backgroundColor: t.accent.primarySoft,
            }}>
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 13 }}>
                {settings.arabicFontSize}px
              </Text>
            </View>
          </View>
          <FontSizeSlider
            value={settings.arabicFontSize}
            onChange={v => setSetting('arabicFontSize', v)}
          />
        </View>

        {/* Script — vertical cards: label on top, Arabic preview below. The
            preview always uses a fixed line height so the three cards align. */}
        <SettingsSection title={s.quranScript} />
        <View style={{ gap: t.spacing(2) }}>
          {scriptOptions.map(opt => {
            const active = settings.arabicScript === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSetting('arabicScript', opt.id)}
                style={{
                  padding: t.spacing(4), borderRadius: t.radius.lg,
                  backgroundColor: t.colors.surface,
                  borderWidth: active ? 1.5 : 0.75,
                  borderColor: active ? t.accent.primary : t.colors.hairline,
                  gap: t.spacing(2),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{
                    color: active ? t.accent.primary : t.colors.text,
                    fontWeight: '700', fontSize: 16,
                  }}>
                    {opt.label}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={t.accent.primary} />
                  ) : (
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      borderWidth: 1.5, borderColor: t.colors.border,
                    }} />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: t.colors.text, fontSize: 22,
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
              </Pressable>
            );
          })}
        </View>

        {/* Tajweed legend — only shown while the tajweed script is active.
            Each rule sits in its own subtly-tinted chip so the colour and
            label stay paired even with a long list. */}
        {settings.arabicScript === 'tajweed' && (
          <>
            <SettingsSection title={s.tajweedLegend} />
            <View style={{
              padding: t.spacing(3), borderRadius: t.radius.lg,
              backgroundColor: t.colors.surface,
              borderWidth: 0.75, borderColor: t.colors.hairline,
              flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2),
            }}>
              {TAJWEED_LEGEND_ORDER.map(rule => (
                <View
                  key={rule}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                    paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
                    borderRadius: t.radius.pill,
                    backgroundColor: t.colors.surfaceMuted,
                  }}
                >
                  <View style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: TAJWEED_COLORS[rule],
                  }} />
                  <Text style={{ color: t.colors.text, fontSize: 12, fontWeight: '600' }}>
                    {TAJWEED_LABELS[rule]}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
