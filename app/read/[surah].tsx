import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { getSurah } from '@/data/surahs';
import { getSurahContent, type Ayah } from '@/data/quranApi';
import { hasanatFor } from '@/lib/hasanat';
import { formatNumber } from '@/lib/format';
import { arabicFontFor, toArabicDigits } from '@/lib/quranText';
import { parseTajweed, stripTajweed, TAJWEED_COLORS } from '@/lib/tajweed';
import { IconButton } from '@/components/Button';
import { AyahMarker } from '@/components/AyahMarker';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { GlassDock } from '@/components/GlassDock';
import { useTodayStats } from '@/store/selectors';

// Standard Bismillah, shown as an opener for ayah 1 of every surah except
// Al-Fatihah (1) where it is itself the first ayah, and At-Tawbah (9).
const BISMILLAH = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';

export default function VerseReader() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const surahNumber = Math.max(1, Math.min(114, parseInt(params.surah ?? '1', 10) || 1));
  const startAyah = Math.max(1, parseInt(params.ayah ?? '1', 10) || 1);
  const surahMeta = getSurah(surahNumber)!;

  const settings = useAppStore(st => st.settings);
  const recordVerseRead = useAppStore(st => st.recordVerseRead);
  const setLastRead = useAppStore(st => st.setLastRead);
  const toggleFavorite = useAppStore(st => st.toggleFavorite);
  const toggleBookmark = useAppStore(st => st.toggleBookmark);
  const favorites = useAppStore(st => st.favorites);
  const bookmarks = useAppStore(st => st.bookmarks);
  const today = useTodayStats();

  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [idx, setIdx] = useState(startAyah - 1);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const lastTickRef = useRef<number>(Date.now());
  const verseEnterRef = useRef<number>(Date.now());

  useEffect(() => {
    let alive = true;
    setError(null);
    setAyahs(null);
    getSurahContent(surahNumber, settings.translationId, settings.arabicScript)
      .then(c => { if (alive) setAyahs(c.ayahs); })
      .catch(e => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [surahNumber, settings.translationId, settings.arabicScript]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setElapsed(e => e + (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { verseEnterRef.current = Date.now(); }, [idx]);

  const current = ayahs?.[idx];

  // Persist the current view position so backing out mid-surah resumes here
  // next time, instead of always restarting at ayah 1.
  useEffect(() => {
    if (current) setLastRead({ surah: surahNumber, ayah: current.numberInSurah });
  }, [current, surahNumber, setLastRead]);

  const ayahHasanat = useMemo(
    () => current ? hasanatFor(stripTajweed(current.arabic)) : 0,
    [current],
  );
  const tajweedSegments = useMemo(
    () => current && settings.arabicScript === 'tajweed'
      ? parseTajweed(current.arabic)
      : null,
    [current, settings.arabicScript],
  );
  const total = ayahs?.length ?? surahMeta.numberOfAyahs;
  const versesLeft = Math.max(0, total - (idx + 1));
  const progress = total ? (idx + 1) / total : 0;

  const key = current ? `${surahNumber}:${current.numberInSurah}` : '';
  const isFav = key && favorites.includes(key);
  const isBkm = key && bookmarks.includes(key);

  const ARABIC_SIZE_MAP = { small: 22, medium: 28, large: 34, xlarge: 40 } as const;
  const arabicSize = ARABIC_SIZE_MAP[settings.arabicFontSize];
  const arabicLineHeight = Math.round(arabicSize * 2);

  // The Bismillah opener is shown above ayah 1 for every surah except
  // Al-Fatihah (1, where it IS ayah 1) and At-Tawbah (9, where it is absent).
  const showBismillah = current?.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9;

  const goNext = () => {
    if (!ayahs || !current) return;
    const dt = (Date.now() - verseEnterRef.current) / 1000;
    recordVerseRead(ayahHasanat, dt, 0);
    setLastRead({ surah: surahNumber, ayah: current.numberInSurah });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (idx + 1 < ayahs.length) setIdx(idx + 1);
  };
  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), gap: t.spacing(3), flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={t.colors.text} />
          </IconButton>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
            borderWidth: 0.75, borderColor: t.colors.hairline,
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.pill,
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
          }}>
            {!settings.hideHasanat && (
              <>
                <Ionicons name="sparkles" size={13} color={t.colors.brass} />
                <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>{formatNumber(today.hasanat)}</Text>
                <View style={{ width: 1, height: 12, backgroundColor: t.colors.hairline }} />
              </>
            )}
            <Ionicons name="book-outline" size={13} color={t.accent.primary} />
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>{today.verses}</Text>
            <View style={{ width: 1, height: 12, backgroundColor: t.colors.hairline }} />
            <Ionicons name="time-outline" size={13} color={t.colors.tileBlue} />
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
            </Text>
          </View>
          <IconButton onPress={() => router.push('/settings/account')}>
            <Ionicons name="settings-outline" size={20} color={t.colors.text} />
          </IconButton>
        </View>

        {/* Surah title — editorial header */}
        <View style={{ alignItems: 'center', marginTop: t.spacing(1) }}>
          <Text style={{ color: t.colors.brass, fontSize: 11, letterSpacing: 2, fontWeight: '700' }}>
            {String(surahMeta.number).padStart(3, '0')} · {surahMeta.englishTranslation?.toUpperCase()}
          </Text>
          <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
            {surahMeta.englishName}
          </Text>
        </View>

        {/* Progress */}
        <View style={{ marginTop: t.spacing(2) }}>
          <View style={{ height: 8, backgroundColor: t.colors.surfaceMuted, borderRadius: 4 }}>
            <View style={{ height: 8, width: `${progress * 100}%`, backgroundColor: t.accent.primary, borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing(1) }}>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{idx + 1}/{total}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{versesLeft} {s.versesLeft}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>

        {/* Verse card — parchment with arabesque watermark */}
        <ScrollView
          contentContainerStyle={{ gap: t.spacing(3), paddingBottom: t.spacing(28) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            backgroundColor: t.colors.surfaceElevated,
            borderRadius: t.radius.xl,
            borderWidth: 0.75, borderColor: t.colors.hairline,
            padding: t.spacing(5),
            gap: t.spacing(3),
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: t.mode === 'dark' ? 0.35 : 0.05,
            shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
            elevation: 3,
          }}>
            <View pointerEvents="none" style={{ position: 'absolute', right: -36, top: -36, opacity: t.mode === 'dark' ? 0.08 : 0.06 }}>
              <ArabesqueMark size={180} color={t.colors.brass} />
            </View>
            <View pointerEvents="none" style={{ position: 'absolute', left: -36, bottom: -36, opacity: t.mode === 'dark' ? 0.06 : 0.04 }}>
              <ArabesqueMark size={140} color={t.colors.brass} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1),
                borderRadius: t.radius.pill,
                backgroundColor: t.colors.surfaceMuted,
              }}>
                <Text style={{ color: t.colors.brass, fontWeight: '700', fontSize: 11, letterSpacing: 1 }}>AYAH</Text>
                <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>
                  {current?.numberInSurah ?? idx + 1}/{surahMeta.numberOfAyahs}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: t.spacing(4) }}>
                <Pressable hitSlop={10} onPress={() => current && toggleFavorite(surahNumber, current.numberInSurah)}>
                  <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? t.colors.danger : t.colors.textMuted} />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => current && toggleBookmark(surahNumber, current.numberInSurah)}>
                  <Ionicons name={isBkm ? 'bookmark' : 'bookmark-outline'} size={22} color={isBkm ? t.accent.primary : t.colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {error && <Text style={{ color: t.colors.danger }}>{error}</Text>}
            {!ayahs && !error && <ActivityIndicator color={t.accent.primary} />}

            {showBismillah && (
              <Text style={{
                color: t.colors.brass,
                fontSize: Math.round(arabicSize * 0.85),
                lineHeight: Math.round(arabicSize * 1.6),
                textAlign: 'center', writingDirection: 'rtl',
                fontFamily: arabicFontFor(settings.arabicScript),
                marginBottom: t.spacing(1),
              }}>
                {BISMILLAH}
              </Text>
            )}

            {current && (
              <Text style={{
                color: t.colors.text, fontSize: arabicSize, lineHeight: arabicLineHeight,
                textAlign: 'center', writingDirection: 'rtl',
                fontFamily: arabicFontFor(settings.arabicScript),
              }}>
                {tajweedSegments
                  ? tajweedSegments.map((seg, i) => (
                      <Text key={i} style={seg.rule ? { color: TAJWEED_COLORS[seg.rule] } : undefined}>
                        {seg.text}
                      </Text>
                    ))
                  : current.arabic}
                {' '}
                <Text style={{ color: t.colors.brass }}>
                  {`\u06DD${toArabicDigits(current.numberInSurah)}`}
                </Text>
              </Text>
            )}

            {/* Bottom hairline + AyahMarker roundel as ornamental footer */}
            {current && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: t.spacing(2), gap: t.spacing(3) }}>
                <View style={{ flex: 1, height: 0.75, backgroundColor: t.colors.hairline }} />
                <AyahMarker number={current.numberInSurah} size={32} />
                <View style={{ flex: 1, height: 0.75, backgroundColor: t.colors.hairline }} />
              </View>
            )}
          </View>

          {settings.showTransliteration && current && (
            <Text style={{ color: t.colors.textMuted, fontStyle: 'italic', fontSize: 16, lineHeight: 24 }}>
              {current.transliteration}
            </Text>
          )}
          {settings.showTranslation && current && (
            <Text style={{ color: t.colors.text, fontSize: 18, lineHeight: 28, fontWeight: '500' }}>
              {current.translation}
            </Text>
          )}

          {!settings.hideHasanat && current && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end',
              gap: t.spacing(2),
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
              borderRadius: t.radius.pill,
              backgroundColor: t.accent.primarySoft,
            }}>
              <Ionicons name="sparkles" size={14} color={t.colors.brass} />
              <Text style={{ color: t.colors.success, fontWeight: '800' }}>+{ayahHasanat}</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Floating glass action dock */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View style={{ paddingHorizontal: t.spacing(4), paddingBottom: t.spacing(5), paddingTop: t.spacing(2) }}>
          <GlassDock radius={28} style={{ flexDirection: 'row', alignItems: 'center', padding: t.spacing(2), gap: t.spacing(2) }}>
            <Pressable
              onPress={goPrev}
              disabled={idx === 0}
              style={({ pressed }) => ({
                width: 48, height: 48, borderRadius: 24,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surfaceMuted,
                opacity: idx === 0 ? 0.4 : 1,
                transform: [{ scale: pressed && idx !== 0 ? t.pressedScale : 1 }],
              })}
            >
              <Ionicons name="arrow-back" size={20} color={t.colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 24,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surfaceMuted,
                transform: [{ scale: pressed ? t.pressedScale : 1 }],
              })}
            >
              <Text style={{ color: t.colors.text, fontWeight: '700', letterSpacing: 0.3 }}>{s.imDone}</Text>
            </Pressable>
            <Pressable
              onPress={goNext}
              disabled={!current || idx + 1 >= (ayahs?.length ?? 0)}
              style={({ pressed }) => ({
                paddingHorizontal: t.spacing(5), height: 48, borderRadius: 24,
                flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                backgroundColor: t.accent.primary,
                opacity: !current || idx + 1 >= (ayahs?.length ?? 0) ? 0.4 : 1,
                transform: [{ scale: pressed && !(!current || idx + 1 >= (ayahs?.length ?? 0)) ? t.pressedScale : 1 }],
              })}
            >
              <Text style={{ color: t.accent.onPrimary, fontWeight: '700' }}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />
            </Pressable>
          </GlassDock>
        </View>
      </View>
    </SafeAreaView>
  );
}
