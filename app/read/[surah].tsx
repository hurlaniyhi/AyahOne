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
import { arabicFontFor, toArabicDigits, withAyahMarker } from '@/lib/quranText';
import { parseTajweed, stripTajweed, TAJWEED_COLORS } from '@/lib/tajweed';
import { Button, IconButton } from '@/components/Button';
import { useTodayStats } from '@/store/selectors';

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

  // Inverted mushaf-style card so Arabic stands out: white-on-black in light
  // mode, black-on-white in dark mode.
  const arabicBg = t.mode === 'dark' ? '#FFFFFF' : '#0B0B0F';
  const arabicFg = t.mode === 'dark' ? '#0B0B0F' : '#FFFFFF';
  const arabicMuted = t.mode === 'dark' ? '#6B7280' : '#9CA3AF';

  const ARABIC_SIZE_MAP = { small: 22, medium: 28, large: 34, xlarge: 40 } as const;
  const arabicSize = ARABIC_SIZE_MAP[settings.arabicFontSize];
  const arabicLineHeight = Math.round(arabicSize * 2);

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
      <View style={{ padding: t.spacing(4), gap: t.spacing(3), flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={t.colors.text} />
          </IconButton>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
            borderWidth: 1, borderColor: t.colors.border,
            borderRadius: t.radius.pill,
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
          }}>
            {!settings.hideHasanat && (
              <>
                <Ionicons name="heart" size={14} color="#F472B6" />
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{formatNumber(today.hasanat)}</Text>
                <View style={{ width: 1, height: 14, backgroundColor: t.colors.border }} />
              </>
            )}
            <Ionicons name="document-text" size={14} color={t.colors.tileBlue} />
            <Text style={{ color: t.colors.text, fontWeight: '700' }}>{today.verses}</Text>
            <View style={{ width: 1, height: 14, backgroundColor: t.colors.border }} />
            <Ionicons name="time" size={14} color={t.colors.tileAmber} />
            <Text style={{ color: t.colors.text, fontWeight: '700' }}>
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}m {String(Math.floor(elapsed % 60)).padStart(2, '0')}s
            </Text>
          </View>
          <IconButton onPress={() => router.push('/settings/account')}>
            <Ionicons name="settings-outline" size={20} color={t.colors.text} />
          </IconButton>
        </View>

        {/* Progress */}
        <View style={{ marginTop: t.spacing(3) }}>
          <View style={{ height: 8, backgroundColor: t.colors.border, borderRadius: 4 }}>
            <View style={{ height: 8, width: `${progress * 100}%`, backgroundColor: t.accent.primary, borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing(1) }}>
            <Text style={{ color: t.colors.textMuted }}>{idx + 1}/{total}</Text>
            <Text style={{ color: t.colors.textMuted }}>{surahMeta.englishName} : {versesLeft} {s.versesLeft}</Text>
            <Text style={{ color: t.colors.textMuted }}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>

        {/* Verse card */}
        <ScrollView contentContainerStyle={{ gap: t.spacing(3) }}>
          <View style={{ backgroundColor: arabicBg, borderRadius: t.radius.lg, padding: t.spacing(5), gap: t.spacing(3) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: arabicFg, fontWeight: '700' }}>{surahMeta.number}. {surahMeta.englishName}</Text>
              <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
                <Pressable onPress={() => current && toggleFavorite(surahNumber, current.numberInSurah)}>
                  <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#F43F5E' : arabicFg} />
                </Pressable>
                <Pressable onPress={() => current && toggleBookmark(surahNumber, current.numberInSurah)}>
                  <Ionicons name={isBkm ? 'bookmark' : 'bookmark-outline'} size={20} color={isBkm ? t.accent.primary : arabicFg} />
                </Pressable>
              </View>
            </View>
            <Text style={{ color: arabicMuted }}>{current?.numberInSurah ?? idx + 1}/{surahMeta.numberOfAyahs}</Text>
            {error && <Text style={{ color: t.colors.danger }}>{error}</Text>}
            {!ayahs && !error && <ActivityIndicator color={arabicFg} />}
            {current && (
              <Text style={{
                color: arabicFg, fontSize: arabicSize, lineHeight: arabicLineHeight,
                textAlign: 'center', writingDirection: 'rtl',
                fontFamily: arabicFontFor(settings.arabicScript),
              }}>
                {tajweedSegments
                  ? tajweedSegments.map((seg, i) => (
                      <Text key={i} style={seg.rule ? { color: TAJWEED_COLORS[seg.rule] } : undefined}>
                        {seg.text}
                      </Text>
                    ))
                  : null}
                {tajweedSegments
                  ? ` \u06DD${toArabicDigits(current.numberInSurah)}`
                  : withAyahMarker(current.arabic, current.numberInSurah)}
              </Text>
            )}
          </View>

          {settings.showTransliteration && current && (
            <Text style={{ color: t.colors.textMuted, fontStyle: 'italic', fontSize: 16, lineHeight: 24 }}>
              {current.transliteration}
            </Text>
          )}
          {settings.showTranslation && current && (
            <Text style={{ color: t.colors.text, fontSize: 18, lineHeight: 28, fontWeight: '600' }}>
              {current.translation}
            </Text>
          )}
        </ScrollView>

        {/* Bottom controls — equal-width, baseline-aligned row */}
        {!settings.hideHasanat && current && (
          <Text style={{ color: t.colors.success, fontWeight: '700', textAlign: 'right' }}>
            +{ayahHasanat}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: t.spacing(3) }}>
          <Button variant="outline" onPress={goPrev} disabled={idx === 0} style={{ flex: 1 }}>
            <Ionicons name="arrow-back" size={20} color={t.colors.text} />
          </Button>
          <Button variant="secondary" label={s.imDone} onPress={() => router.back()} style={{ flex: 2 }} />
          <Button onPress={goNext} disabled={!current || idx + 1 >= (ayahs?.length ?? 0)} style={{ flex: 1 }}>
            <Ionicons name="arrow-forward" size={20} color={t.accent.onPrimary} />
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
