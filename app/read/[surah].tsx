import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { getSurah } from '@/data/surahs';
import { getSurahContent, type Ayah } from '@/data/quranApi';
import { hasanatFor } from '@/lib/hasanat';
import { formatNumber } from '@/lib/format';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor } from '@/lib/quranText';
import { parseTajweedForRender, stripTajweed, TAJWEED_COLORS } from '@/lib/tajweed';
import { stripBismillahPrefix } from '@/lib/quranText';
import { IconButton } from '@/components/Button';
import { AyahMarker } from '@/components/AyahMarker';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { GlassDock } from '@/components/GlassDock';
import { DailyGoalBadge } from '@/components/DailyGoalBadge';
import { VerseAudioListen } from '@/components/VerseAudioListen';
import { TefseerSheet } from '@/components/TefseerSheet';
import { fetchTefseer, IslamicAiError } from '@/lib/islamicAi';
import { useTodayStats, useBestRecitationScore } from '@/store/selectors';

// Standard Bismillah, shown as an opener for ayah 1 of every surah except
// Al-Fatihah (1) where it is itself the first ayah, and At-Tawbah (9).
const BISMILLAH = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';

export default function VerseReader() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ surah: string; ayah?: string; nosave?: string; fromSearch?: string }>();
  const surahNumber = Math.max(1, Math.min(114, parseInt(params.surah ?? '1', 10) || 1));
  const startAyah = Math.max(1, parseInt(params.ayah ?? '1', 10) || 1);
  // `nosave=1` marks an ephemeral entry point (search hit, Friday Al-Kahf
  // banner, …): hasanat / verses / per-surah progress still accrue, but the
  // resume pointer used by the Reading menu's "Start Reading Quran" and the
  // home "Today's Goal" card must NOT move — those track only the user's
  // explicit reading-menu sessions.
  const ephemeral = params.nosave === '1';
  // `fromSearch=1` means this screen replaced the Search modal. Going Back
  // should re-open Search (which restores the user's query + results from
  // the store) rather than dropping straight to the tab the user was on
  // before opening Search.
  const fromSearch = params.fromSearch === '1';
  const goBack = () => {
    if (fromSearch) router.replace('/search');
    else router.back();
  };
  // Hardware back (Android) and the iOS swipe-back gesture both fire a
  // `beforeRemove` event on the navigator. Intercept it when this screen
  // replaced the Search modal so the user is taken back to Search instead
  // of dropping to the tab beneath.
  const navigation = useNavigation();
  useEffect(() => {
    if (!fromSearch) return;
    const sub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: { type: string } } }) => {
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') return;
      e.preventDefault();
      router.replace('/search');
    });
    return sub;
  }, [navigation, fromSearch, router]);
  const surahMeta = getSurah(surahNumber)!;

  const settings = useAppStore(st => st.settings);
  const recordVerseRead = useAppStore(st => st.recordVerseRead);
  const recordSurahProgress = useAppStore(st => st.recordSurahProgress);
  const setLastRead = useAppStore(st => st.setLastRead);
  const toggleFavorite = useAppStore(st => st.toggleFavorite);
  const toggleBookmark = useAppStore(st => st.toggleBookmark);
  const favorites = useAppStore(st => st.favorites);
  const bookmarks = useAppStore(st => st.bookmarks);
  const tefseerCache = useAppStore(st => st.tefseerCache);
  const setTefseer = useAppStore(st => st.setTefseer);
  const today = useTodayStats();

  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [idx, setIdx] = useState(startAyah - 1);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const lastTickRef = useRef<number>(Date.now());
  const verseEnterRef = useRef<number>(Date.now());
  // Pages already credited in this surah view session — prevents repeat-tap
  // inflation and double-counting if the user navigates back and forth.
  const creditedPagesRef = useRef<Set<number>>(new Set());
  // Transient label shown when crossing from one surah into the next/previous,
  // so the in-place param swap reads as an intentional transition rather than
  // a silent jump.
  const [transitionLabel, setTransitionLabel] = useState<string | null>(null);
  const transitionOpacity = useRef(new Animated.Value(0)).current;
  const prevSurahRef = useRef<number>(surahNumber);

  // Tefseer (per-ayah tafsir) sheet state. `tefseerTarget` captures the ayah
  // being explained at open time so the sheet stays stable and the cache
  // lookup is decoupled from the live reading index.
  const [tefseerTarget, setTefseerTarget] = useState<
    { surah: number; ayah: number; surahName: string; arabic: string; translation: string } | null
  >(null);
  const [tefseerLoading, setTefseerLoading] = useState(false);
  const [tefseerError, setTefseerError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setAyahs(null);
    // Reset position + page-credit tracking whenever the surah param changes,
    // since expo-router updates params in-place rather than remounting the
    // screen when navigating between adjacent surahs.
    setIdx(Math.max(0, startAyah - 1));
    creditedPagesRef.current = new Set();
    getSurahContent(surahNumber, settings.translationId, settings.arabicScript)
      .then(c => { if (alive) setAyahs(c.ayahs); })
      .catch(e => { if (alive) setError(String(e?.message ?? e)); });
    return () => { alive = false; };
    // startAyah intentionally excluded \u2014 only reset on surah change, not when
    // the deep-link ayah param flickers within the same surah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Detect cross-surah transitions and flash a brief floating label so the
  // continuous-reading flow feels intentional. Skips the initial mount.
  useEffect(() => {
    if (prevSurahRef.current === surahNumber) return;
    prevSurahRef.current = surahNumber;
    setTransitionLabel(surahMeta.englishName);
    Animated.sequence([
      Animated.timing(transitionOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(transitionOpacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setTransitionLabel(null); });
  }, [surahNumber, surahMeta.englishName, transitionOpacity]);

  const current = ayahs?.[idx];
  const bestRecitationScore = useBestRecitationScore(surahNumber, current?.numberInSurah ?? idx + 1);

  // Grow per-surah furthest progress on every view (drives the Friday Al-Kahf
  // banner regardless of how the user entered the reader). Only the
  // Reading-menu resume pointer (`lastRead`) is gated on non-ephemeral entry.
  useEffect(() => {
    if (!current) return;
    recordSurahProgress(surahNumber, current.numberInSurah);
    if (!ephemeral) setLastRead({ surah: surahNumber, ayah: current.numberInSurah });
  }, [current, surahNumber, ephemeral, setLastRead, recordSurahProgress]);

  const ayahHasanat = useMemo(
    () => current ? hasanatFor(stripTajweed(current.arabic)) : 0,
    [current],
  );
  // Only Android needs the joining-coalesce pass (which drops some rule
  // colours to protect cursive shaping across nested <Text> boundaries). iOS
  // joins fine across those boundaries, so it keeps every tajweed colour.
  const tajweedSegments = useMemo(
    () => current && settings.arabicScript === 'tajweed'
      ? parseTajweedForRender(current.arabic, Platform.OS === 'android')
      : null,
    [current, settings.arabicScript],
  );
  // The fetched Uthmani/IndoPak text embeds Bismillah as a literal prefix of
  // ayah 1's own text for every surah except Al-Fatihah (1, where it IS ayah
  // 1) and At-Tawbah (9, which has none) — the `showBismillah` block below
  // already renders it as its own line, so the plain (non-tajweed) text path
  // must strip it here or it renders twice. Tajweed's edition doesn't embed
  // it, so tajweedSegments (parsed straight from current.arabic) is left as-is.
  const plainDisplayArabic = useMemo(() => {
    if (!current) return '';
    if (current.numberInSurah !== 1 || surahNumber === 1 || surahNumber === 9) return current.arabic;
    return stripBismillahPrefix(current.arabic.split(/\s+/).filter(Boolean)).join(' ');
  }, [current, surahNumber]);
  const total = ayahs?.length ?? surahMeta.numberOfAyahs;
  const versesLeft = Math.max(0, total - (idx + 1));
  const progress = total ? (idx + 1) / total : 0;

  const key = current ? `${surahNumber}:${current.numberInSurah}` : '';
  const isFav = key && favorites.includes(key);
  const isBkm = key && bookmarks.includes(key);

  // Tefseer cache is keyed by ayah + language (a language switch means a fresh
  // explanation). `tefseerResult` drives the open sheet; `hasTefseerCurrent`
  // lights up the reader's Tafsir affordances when an explanation is cached.
  const tefseerKey = tefseerTarget ? `${tefseerTarget.surah}:${tefseerTarget.ayah}:${settings.language}` : '';
  const tefseerResult = tefseerKey ? (tefseerCache[tefseerKey] ?? null) : null;
  const hasTefseerCurrent = !!(current && tefseerCache[`${surahNumber}:${current.numberInSurah}:${settings.language}`]);

  // `arabicFontSize` is now a continuous px value driven by the settings slider.
  const arabicSize = settings.arabicFontSize;
  const arabicLineHeight = arabicLineHeightFor(arabicSize);
  // Inner gutter keeps the leading/trailing cursive overhang of terminal
  // glyphs (notably ب in بِأَيْدِيكُمْ) clear of the card's inner edge — on both
  // platforms now, not just Android; IndoPak's Scheherazade New font in
  // particular has wider side-bearings than Amiri Quran and can clip against
  // zero gutter on iOS too. The card itself is structured below so that
  // borderRadius and elevation live on a separate background layer — that
  // way the content View has no rounded outline, and Android's
  // clipToOutline cannot crop text glyphs against the card's corner path.
  const arabicGutter = t.spacing(Platform.OS === 'android' ? 3 : 2);
  // Extra hard vertical clearance on top of the lineHeight-based leading —
  // protects against diacritic stacks (shadda + tanween/madda, hamzat-wasl)
  // whose rendered ascent can exceed what the font's own metrics report,
  // which a lineHeight multiplier alone can't fully guarantee.
  const arabicVerticalPad = t.spacing(1.5);

  // The Bismillah opener is shown above ayah 1 for every surah except
  // Al-Fatihah (1, where it IS ayah 1) and At-Tawbah (9, where it is absent).
  const showBismillah = current?.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9;

  const isFirstSurah = surahNumber === 1;
  const isLastSurah = surahNumber === 114;
  const atSurahStart = idx === 0;
  const atSurahEnd = !!ayahs && idx + 1 >= ayahs.length;
  const nextDisabled = !current || (atSurahEnd && isLastSurah);
  const prevDisabled = atSurahStart && isFirstSurah;

  const goNext = () => {
    if (!ayahs || !current) return;
    const dt = (Date.now() - verseEnterRef.current) / 1000;
    // A Madinah-mushaf page is credited the moment its last ayah is read —
    // either because the next ayah lives on a different page, or because this
    // is the final ayah of the surah. `creditedPagesRef` guards against repeat
    // taps and back-and-forth navigation inflating the counter.
    const nextAyah = ayahs[idx + 1];
    const page = current.page;
    const isPageBoundary = page != null && (nextAyah == null || (nextAyah.page != null && nextAyah.page !== page));
    let pagesDelta = 0;
    if (isPageBoundary && !creditedPagesRef.current.has(page!)) {
      creditedPagesRef.current.add(page!);
      pagesDelta = 1;
    }
    recordVerseRead(ayahHasanat, dt, pagesDelta);
    recordSurahProgress(surahNumber, current.numberInSurah);
    if (!ephemeral) setLastRead({ surah: surahNumber, ayah: current.numberInSurah });
    if (idx + 1 < ayahs.length) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIdx(idx + 1);
    } else if (!isLastSurah) {
      // Continuous-reading flow: cross into the next surah at ayah 1.
      // `replace` keeps the back stack shallow so the system back button
      // still returns to wherever the user originally entered the reader.
      // The `nosave` flag is propagated so an ephemeral search-driven session
      // stays ephemeral when the user reads through into the next surah.
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const suffix = ephemeral ? '&nosave=1' : '';
      router.replace(`/read/${surahNumber + 1}?ayah=1${suffix}`);
    }
  };
  const goPrev = () => {
    if (idx > 0) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIdx(idx - 1);
      return;
    }
    if (isFirstSurah) return;
    const prev = getSurah(surahNumber - 1);
    const lastAyah = prev?.numberOfAyahs ?? 1;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const suffix = ephemeral ? '&nosave=1' : '';
    router.replace(`/read/${surahNumber - 1}?ayah=${lastAyah}${suffix}`);
  };

  const runTefseer = useCallback(async (target: NonNullable<typeof tefseerTarget>) => {
    const cacheKey = `${target.surah}:${target.ayah}:${settings.language}`;
    setTefseerLoading(true);
    setTefseerError(null);
    try {
      const result = await fetchTefseer({
        surah: target.surah,
        ayah: target.ayah,
        surahName: target.surahName,
        arabic: target.arabic,
        translation: target.translation,
        language: settings.language,
      });
      setTefseer(cacheKey, result);
    } catch (e) {
      const code = e instanceof IslamicAiError ? e.code : 'http';
      setTefseerError(code === 'no-key' ? s.askApiKeyMissing : s.tefseerError);
    } finally {
      setTefseerLoading(false);
    }
  }, [settings.language, setTefseer, s]);

  const openTefseer = useCallback(() => {
    if (!current) return;
    void Haptics.selectionAsync();
    const target = {
      surah: surahNumber,
      ayah: current.numberInSurah,
      surahName: surahMeta.englishName,
      arabic: stripTajweed(current.arabic),
      translation: current.translation,
    };
    setTefseerTarget(target);
    if (!tefseerCache[`${target.surah}:${target.ayah}:${settings.language}`]) void runTefseer(target);
  }, [current, surahNumber, surahMeta.englishName, settings.language, tefseerCache, runTefseer]);

  const retryTefseer = useCallback(() => {
    if (tefseerTarget) void runTefseer(tefseerTarget);
  }, [tefseerTarget, runTefseer]);

  const closeTefseer = useCallback(() => setTefseerTarget(null), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), gap: t.spacing(3), flex: 1 }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton onPress={goBack}>
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

        {/* Daily goal completion badge — appears once today's verse goal is met,
            and shows how many verses have been read beyond the target. */}
        <DailyGoalBadge />

        {/* Verse card — parchment with arabesque watermark */}
        <ScrollView
          contentContainerStyle={{ gap: t.spacing(3), paddingBottom: t.spacing(28) }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            {/* Background layer: carries the card's fill, border, rounded
                corners and elevation/shadow. Because this lives in an
                absolutely-positioned sibling rather than wrapping the
                content, Android's elevation-driven clipToOutline applies
                only to this empty layer — the text below renders without
                any rounded clipping path against its glyphs. */}
            <View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: t.colors.surfaceElevated,
              borderRadius: t.radius.xl,
              borderWidth: 0.75, borderColor: t.colors.hairline,
              shadowColor: '#000',
              shadowOpacity: t.mode === 'dark' ? 0.35 : 0.05,
              shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }} />

            {/* Decoration sub-layer: brass arabesque flourishes that bleed
                past the corners, clipped to the card's rounded shape on
                their own layer so they never affect text rendering. */}
            <View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: t.radius.xl,
              overflow: 'hidden',
            }}>
              <View style={{ position: 'absolute', right: -36, top: -36, opacity: t.mode === 'dark' ? 0.08 : 0.06 }}>
                <ArabesqueMark size={180} color={t.colors.brass} />
              </View>
              <View style={{ position: 'absolute', left: -36, bottom: -36, opacity: t.mode === 'dark' ? 0.06 : 0.04 }}>
                <ArabesqueMark size={140} color={t.colors.brass} />
              </View>
            </View>

            <View style={{ padding: t.spacing(5), gap: t.spacing(3) }}>
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
                <Pressable
                  hitSlop={10}
                  onPress={() => current && router.push(`/recite/${surahNumber}?ayah=${current.numberInSurah}`)}
                >
                  <Ionicons
                    name={bestRecitationScore != null ? 'mic' : 'mic-outline'}
                    size={22}
                    color={bestRecitationScore != null ? t.accent.primary : t.colors.textMuted}
                  />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => current && toggleFavorite(surahNumber, current.numberInSurah)}>
                  <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? t.colors.danger : t.colors.textMuted} />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => current && toggleBookmark(surahNumber, current.numberInSurah)}>
                  <Ionicons name={isBkm ? 'bookmark' : 'bookmark-outline'} size={22} color={isBkm ? t.accent.primary : t.colors.textMuted} />
                </Pressable>
                <Pressable hitSlop={10} onPress={openTefseer}>
                  <Ionicons name={hasTefseerCurrent ? 'book' : 'book-outline'} size={22} color={hasTefseerCurrent ? t.accent.primary : t.colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {error && <Text style={{ color: t.colors.danger }}>{error}</Text>}
            {!ayahs && !error && <ActivityIndicator color={t.accent.primary} />}

            {showBismillah && (
              <Text
                allowFontScaling={false}
                textBreakStrategy="simple"
                style={{
                  color: t.colors.brass,
                  fontSize: Math.round(arabicSize * 0.85),
                  lineHeight: arabicLineHeightFor(Math.round(arabicSize * 0.85)),
                  textAlign: 'center', writingDirection: 'rtl',
                  fontFamily: arabicFontFor(settings.arabicScript),
                  marginBottom: t.spacing(1),
                  paddingHorizontal: arabicGutter,
                  paddingVertical: arabicVerticalPad,
                }}>
                {BISMILLAH}
              </Text>
            )}

            {current && (
              <Text
                allowFontScaling={false}
                textBreakStrategy="simple"
                onPress={openTefseer}
                suppressHighlighting
                style={{
                  color: t.colors.text, fontSize: arabicSize, lineHeight: arabicLineHeight,
                  textAlign: 'center', writingDirection: 'rtl',
                  fontFamily: arabicFontFor(settings.arabicScript),
                  paddingHorizontal: arabicGutter,
                  paddingVertical: arabicVerticalPad,
                }}>
                {tajweedSegments
                  ? // Plain segments are emitted as raw string children so they
                    // contribute directly to the parent <Text>'s spannable with
                    // no per-segment wrapper. Each wrapper would otherwise add
                    // RN's internal text-fragment spans to the SpannableString,
                    // and any metric-affecting span between two joining letters
                    // forces HarfBuzz to break the shape run \u2014 visibly cutting
                    // cursive joins like the mim/noon in فَمَنِ / مِّن. Rule-coloured
                    // segments still need a wrapper for the colour, but
                    // ForegroundColorSpan alone is a CharacterStyle (non-metric)
                    // so it does not interrupt shaping with its neighbours.
                    tajweedSegments.map((seg, i) =>
                      seg.rule
                        ? <Text key={i} style={{ color: TAJWEED_COLORS[seg.rule] }}>{seg.text}</Text>
                        : seg.text
                    )
                  : plainDisplayArabic}
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

            {current && (
              <VerseAudioListen
                surah={surahNumber}
                ayah={current.numberInSurah}
                reciterId={settings.reciterId}
              />
            )}
            </View>
          </View>

          {settings.showTransliteration && current && (
            <Text style={{ color: t.colors.textMuted, fontStyle: 'italic', fontSize: 16, lineHeight: 24 }}>
              {current.transliteration}
            </Text>
          )}
          {settings.showTranslation && current && (
            <Text onPress={openTefseer} suppressHighlighting style={{ color: t.colors.text, fontSize: 18, lineHeight: 28, fontWeight: '500' }}>
              {current.translation}
            </Text>
          )}

          {/* Tafsir affordance — labelled for discoverability; lights up in the
              accent tint once an explanation for this ayah has been fetched. */}
          {current && (
            <Pressable
              onPress={openTefseer}
              style={({ pressed }) => ({
                alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2.5),
                borderRadius: t.radius.pill,
                borderWidth: 0.75, borderColor: hasTefseerCurrent ? t.accent.primary : t.colors.hairline,
                backgroundColor: hasTefseerCurrent ? t.accent.primarySoft : t.colors.surface,
                transform: [{ scale: pressed ? t.pressedScale : 1 }],
              })}
            >
              <Ionicons name="book" size={15} color={t.accent.primary} />
              <Text style={{ color: t.accent.primary, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 }}>{s.tefseerTapHint}</Text>
              <Ionicons name="chevron-forward" size={13} color={t.accent.primary} />
            </Pressable>
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
        {transitionLabel != null && (
          <Animated.View
            pointerEvents="none"
            style={{
              alignItems: 'center',
              paddingHorizontal: t.spacing(4),
              paddingBottom: t.spacing(2),
              opacity: transitionOpacity,
              transform: [{
                translateY: transitionOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
              }],
            }}
          >
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
              paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2.5),
              borderRadius: t.radius.pill,
              borderWidth: 0.75, borderColor: t.colors.hairline,
              backgroundColor: t.colors.surfaceElevated,
              shadowColor: '#000',
              shadowOpacity: t.mode === 'dark' ? 0.35 : 0.10,
              shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}>
              <Ionicons name="arrow-forward-circle" size={16} color={t.colors.brass} />
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 }}>
                {transitionLabel}
              </Text>
            </View>
          </Animated.View>
        )}
        <View style={{ paddingHorizontal: t.spacing(4), paddingBottom: t.spacing(5), paddingTop: t.spacing(2) }}>
          <GlassDock radius={28} style={{ flexDirection: 'row', alignItems: 'center', padding: t.spacing(2), gap: t.spacing(2) }}>
            <Pressable
              onPress={goPrev}
              disabled={prevDisabled}
              style={({ pressed }) => ({
                width: 48, height: 48, borderRadius: 24,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surfaceMuted,
                opacity: prevDisabled ? 0.4 : 1,
                transform: [{ scale: pressed && !prevDisabled ? t.pressedScale : 1 }],
              })}
            >
              <Ionicons name="arrow-back" size={20} color={t.colors.text} />
            </Pressable>
            <Pressable
              onPress={goBack}
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
              disabled={nextDisabled}
              style={({ pressed }) => ({
                paddingHorizontal: t.spacing(5), height: 48, borderRadius: 24,
                flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                backgroundColor: t.accent.primary,
                opacity: nextDisabled ? 0.4 : 1,
                transform: [{ scale: pressed && !nextDisabled ? t.pressedScale : 1 }],
              })}
            >
              <Text style={{ color: t.accent.onPrimary, fontWeight: '700' }}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />
            </Pressable>
          </GlassDock>
        </View>
      </View>

      <TefseerSheet
        visible={tefseerTarget != null}
        surah={tefseerTarget?.surah ?? surahNumber}
        ayah={tefseerTarget?.ayah ?? 1}
        surahName={tefseerTarget?.surahName ?? surahMeta.englishName}
        arabic={tefseerTarget?.arabic ?? ''}
        arabicFont={arabicFontFor(settings.arabicScript)}
        loading={tefseerLoading}
        result={tefseerResult}
        error={tefseerError}
        onRetry={retryTefseer}
        onClose={closeTefseer}
      />
    </SafeAreaView>
  );
}
