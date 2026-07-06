import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/theme/ThemeProvider';
import {
  useAppStore,
  type ArabicScript,
} from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor } from '@/lib/quranText';
import { getAyahAudioUrl, RECITERS } from '@/data/quranAudio';
import { useTogglePlayback } from '@/lib/useTogglePlayback';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { FontSizeSlider } from '@/components/FontSizeSlider';
import { InlineNotice } from '@/components/InlineNotice';
import { SettingsSection } from '@/components/SettingsRow';
import {
  TAJWEED_COLORS,
  TAJWEED_LABELS,
  TAJWEED_LEGEND_ORDER,
} from '@/lib/tajweed';

// Sample ayah used to audition each reciter's voice — Al-Fatihah's opener,
// short and universally recognisable.
const PREVIEW_SURAH = 1;
const PREVIEW_AYAH = 1;

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

  // Reciter audition: a single shared player for all cards — tapping a
  // different card's preview button swaps the source and plays that one.
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingReciterId, setLoadingReciterId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const previewPlayer = useAudioPlayer(previewUrl);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  const togglePreview = useTogglePlayback(previewPlayer, previewStatus, () => setPreviewError(true));

  useEffect(() => {
    if (previewUrl) void togglePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const handlePreview = async (reciterId: string) => {
    if (previewingId === reciterId && previewUrl) {
      void togglePreview();
      return;
    }
    setPreviewError(false);
    setLoadingReciterId(reciterId);
    try {
      const url = await getAyahAudioUrl(PREVIEW_SURAH, PREVIEW_AYAH, reciterId);
      setPreviewingId(reciterId);
      setPreviewUrl(url);
    } catch {
      setPreviewError(true);
    } finally {
      setLoadingReciterId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), paddingBottom: t.spacing(8), gap: t.spacing(4) }}>
        {/* Live preview — surfaceElevated card with brass arabesque corners
            so the Bismillah feels like a mushaf page rather than a swatch.
            Background/shadow, decorations, and the Arabic text each live on
            their own layer (same structure as the reader's verse card, see
            app/read/[surah].tsx): only the empty background layer carries
            borderRadius + elevation. On Android, a View with both set
            directly clips ITS CHILDREN to the rounded outline (clipToOutline)
            — since real content never lives on that layer, tall diacritics
            and cursive overhangs on the text layer above are never clipped. */}
        <View>
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.surfaceElevated,
            borderWidth: 0.75, borderColor: t.colors.hairline,
            shadowColor: '#000',
            shadowOpacity: t.mode === 'dark' ? 0.35 : 0.06,
            shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
            elevation: 3,
          }} />
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

        {/* Reciter — same vertical-card pattern as the script picker, with a
            circular preview button so the user can audition a voice before
            committing. Only one preview plays at a time (shared player). */}
        <SettingsSection title={s.settingsReciter} description={s.settingsReciterDescription} />
        <View style={{ gap: t.spacing(2) }}>
          {RECITERS.map(reciter => {
            const active = settings.reciterId === reciter.id;
            const isPreviewing = previewingId === reciter.id;
            const isLoading = loadingReciterId === reciter.id;
            return (
              <Pressable
                key={reciter.id}
                onPress={() => setSetting('reciterId', reciter.id)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
                  padding: t.spacing(4), borderRadius: t.radius.lg,
                  backgroundColor: t.colors.surface,
                  borderWidth: active ? 1.5 : 0.75,
                  borderColor: active ? t.accent.primary : t.colors.hairline,
                }}
              >
                <Pressable
                  onPress={() => handlePreview(reciter.id)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: t.colors.surfaceMuted,
                    transform: [{ scale: pressed ? t.pressedScale : 1 }],
                  })}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={t.accent.primary} />
                  ) : (
                    <Ionicons
                      name={isPreviewing && previewStatus.playing ? 'pause' : 'play'}
                      size={16}
                      color={t.accent.primary}
                    />
                  )}
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: active ? t.accent.primary : t.colors.text, fontWeight: '700', fontSize: 15 }}>
                    {reciter.name}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{reciter.style}</Text>
                </View>

                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color={t.accent.primary} />
                ) : (
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.border }} />
                )}
              </Pressable>
            );
          })}
          {previewError && <InlineNotice tone="danger" icon="alert-circle-outline" text={s.audioError} />}
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
