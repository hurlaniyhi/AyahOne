import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import {
  useAppStore,
  type ArabicScript,
  type ArabicFontSize,
} from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { arabicFontFor } from '@/lib/quranText';
import {
  TAJWEED_COLORS,
  TAJWEED_LABELS,
  TAJWEED_LEGEND_ORDER,
} from '@/lib/tajweed';

const SIZE_STOPS: ArabicFontSize[] = ['small', 'medium', 'large', 'xlarge'];
const SIZE_PX: Record<ArabicFontSize, number> = {
  small: 22, medium: 28, large: 34, xlarge: 40,
};

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

function StepTrack({
  value, onChange,
}: { value: ArabicFontSize; onChange: (v: ArabicFontSize) => void }) {
  const t = useTheme();
  const activeIdx = SIZE_STOPS.indexOf(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
      <Text style={{ color: t.colors.textMuted, fontSize: 14, fontWeight: '700' }}>T</Text>
      <View style={{ flex: 1, height: 32, justifyContent: 'center' }}>
        <View style={{
          position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
          backgroundColor: t.colors.border,
        }} />
        <View style={{
          position: 'absolute', left: 0, height: 4, borderRadius: 2,
          width: `${(activeIdx / (SIZE_STOPS.length - 1)) * 100}%`,
          backgroundColor: t.accent.primary,
        }} />
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {SIZE_STOPS.map((stop, i) => {
            const active = i === activeIdx;
            return (
              <Pressable
                key={stop}
                onPress={() => onChange(stop)}
                hitSlop={12}
                style={{
                  width: active ? 20 : 12, height: active ? 20 : 12,
                  borderRadius: active ? 10 : 6,
                  backgroundColor: i <= activeIdx ? t.accent.primary : t.colors.border,
                  borderWidth: active ? 3 : 0,
                  borderColor: t.colors.background,
                }}
              />
            );
          })}
        </View>
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

  const previewSize = SIZE_PX[settings.arabicFontSize];

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
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>
            {s.fontSize}
          </Text>
          <StepTrack
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
