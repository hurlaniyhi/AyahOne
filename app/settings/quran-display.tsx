import React from 'react';
import { Platform, ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import {
  useAppStore,
  type ArabicScript,
} from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor } from '@/lib/quranText';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { FontSizeSlider } from '@/components/FontSizeSlider';
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
            so the Bismillah feels like a mushaf page rather than a swatch.
            The arabesque decorations and the Arabic text live in separate
            sub-layers: only the decoration layer is clipped to the card's
            rounded shape, so the text layer above is free to render full
            cursive overhangs — Android otherwise crops side-bearings of
            terminal glyphs against the card edge. */}
        <View style={{
          borderRadius: t.radius.lg,
          backgroundColor: t.colors.surfaceElevated,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          shadowColor: '#000',
          shadowOpacity: t.mode === 'dark' ? 0.35 : 0.06,
          shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}>
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: t.radius.lg,
            overflow: 'hidden',
          }}>
            <View style={{ position: 'absolute', top: -16, left: -16, opacity: 0.18 }}>
              <ArabesqueMark size={72} color={t.colors.brass} />
            </View>
            <View style={{ position: 'absolute', bottom: -16, right: -16, opacity: 0.18 }}>
              <ArabesqueMark size={72} color={t.colors.brass} />
            </View>
          </View>

          <View style={{ padding: t.spacing(5), alignItems: 'center' }}>
            <Text style={{
              color: t.colors.brass, fontSize: 11, fontWeight: '800',
              letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: t.spacing(2),
            }}>
              {scriptOptions.find(o => o.id === settings.arabicScript)?.label}
            </Text>
            <Text
              allowFontScaling={false}
              textBreakStrategy="simple"
              style={{
                color: t.colors.text, fontSize: previewSize,
                lineHeight: arabicLineHeightFor(previewSize),
                textAlign: 'center', writingDirection: 'rtl',
                fontFamily: arabicFontFor(settings.arabicScript),
                alignSelf: 'stretch',
              }}>
              {BISMILLAH[settings.arabicScript]}
            </Text>
          </View>
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
                  allowFontScaling={false}
                  textBreakStrategy="simple"
                  style={{
                    color: t.colors.text, fontSize: 22,
                    lineHeight: arabicLineHeightFor(22),
                    textAlign: 'right', writingDirection: 'rtl',
                    fontFamily: arabicFontFor(opt.id),
                    // Trailing/leading gutter so the first/last cursive glyph
                    // isn't clipped by the script card border on Android.
                    paddingHorizontal: t.spacing(Platform.OS === 'android' ? 2 : 0),
                  }}
                >
                  {opt.id === 'tajweed'
                    ? TAJWEED_PREVIEW_SEGMENTS.map((seg, i) =>
                        seg.rule
                          ? <Text key={i} style={{ color: TAJWEED_COLORS[seg.rule] }}>{seg.text}</Text>
                          : seg.text,
                      )
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
