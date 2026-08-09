import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, FlatList, Platform,
  Animated, Easing,
  type ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme, type Theme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore, type ArabicScript } from '@/store/appStore';
import { bootstrapQuranCache } from '@/lib/precacheBootstrap';
import { getSurah } from '@/data/surahs';
import { JUZ_STARTS } from '@/data/juz';
import { getPageContent, pageForAyah, TOTAL_MUSHAF_PAGES, type PageAyah, type PageContent } from '@/data/mushafPages';
import { getAyahAudioUrl, isOfflineError } from '@/data/quranAudio';
import { getKaraokeAyahData, hasKaraokeSurah, type KaraokeAyahData } from '@/data/hifzKaraoke';
import { activeWordIndex } from '@/lib/hifzKaraoke';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor, isQuranWordToken, stripBismillahPrefix, toArabicDigits } from '@/lib/quranText';
import { parseTajweedForRender, stripTajweed, TAJWEED_COLORS, TAJWEED_LABELS, TAJWEED_LEGEND_ORDER } from '@/lib/tajweed';
import { VerseAudioListen } from '@/components/VerseAudioListen';
import { InlineNotice } from '@/components/InlineNotice';
import { SurahPickerSheet } from '@/components/SurahPickerSheet';
import { AyahMarker } from '@/components/AyahMarker';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { GlassDock } from '@/components/GlassDock';
import { useBestRecitationScore } from '@/store/selectors';

// Shared mount-only fade+rise used by the toggleable chrome below (ayah
// action sheet, tajweed legend panel) — entrance only, no exit animation, so
// a panel's unmount timing (and anything it tears down, e.g. embedded audio)
// never gets delayed by a fade.
function useEntranceFade(distance = 12) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: t.motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [anim, t.motion.fast]);
  return {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}

// Selection highlight tuned per theme so the current ayah stays legible. The
// bright accent `primarySoft` washed out light Arabic text on the dark
// background; a low-opacity brass tint reads clearly in both modes and matches
// the mushaf's gold ornamentation.
function highlightBg(t: Theme): string {
  return t.mode === 'dark' ? 'rgba(209,162,74,0.16)' : 'rgba(176,134,65,0.14)';
}

// Soft tint for the ayah currently being recited during continuous playback.
// Kept lighter than the tap-selection highlight so, when per-word karaoke
// highlighting is layered on top, the whole-ayah wash stays a gentle backdrop
// rather than competing with the moving word — and never overwhelms the text.
function playingBg(t: Theme): string {
  return t.mode === 'dark' ? 'rgba(209,162,74,0.14)' : 'rgba(176,134,65,0.12)';
}

// Per-word karaoke highlight for the exact word being recited — the accent
// colour (not brass) so it pops against the ayah-level brass tint underneath,
// making the moving word unmistakable in both themes.
function wordHighlightBg(t: Theme): string {
  return t.mode === 'dark' ? 'rgba(76,175,132,0.42)' : 'rgba(46,139,102,0.28)';
}

// Colour guide for the tajweed rules on screen. Only surfaced in page mode,
// where the continuous coloured text benefits from an at-a-glance reference
// (ayah mode shows one verse and keeps the guide in settings). Mirrors the
// settings-screen legend chips so the two stay visually consistent.
function TajweedLegendPanel({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const s = useStrings();
  const fade = useEntranceFade();
  return (
    <Animated.View style={[{
      backgroundColor: t.colors.surfaceElevated,
      borderBottomWidth: 0.75, borderBottomColor: t.colors.hairline,
      paddingHorizontal: t.spacing(4), paddingTop: t.spacing(3), paddingBottom: t.spacing(3),
    }, fade]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing(2) }}>
        <Text style={{ color: t.colors.brass, fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>
          {s.tajweedLegend.toUpperCase()}
        </Text>
        <Pressable hitSlop={10} onPress={onClose}>
          <Ionicons name="close" size={18} color={t.colors.textMuted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2) }}>
        {TAJWEED_LEGEND_ORDER.map(rule => (
          <View
            key={rule}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1.5),
              borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TAJWEED_COLORS[rule] }} />
            <Text style={{ color: t.colors.text, fontSize: 12, fontWeight: '600' }}>
              {TAJWEED_LABELS[rule]}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

interface Props {
  initialPage: number;
  // Surah anchor used to seed cross-surah page assembly (the surah the reader
  // was last in). Only the first page load needs it; subsequent pages derive
  // their own anchor from their contents.
  anchorSurah: number;
  // When set, this ayah is highlighted on entry (the verse the user was on in
  // ayah mode) so switching modes keeps their place visible.
  highlightAyah?: { surah: number; ayah: number } | null;
  // Reports the top-most visible ayah as the user pages, so the parent can keep
  // `lastRead` and the shared position in sync for switching back to ayah mode.
  onPositionChange: (surah: number, ayah: number) => void;
  // Opens the parent's shared Tafsir sheet for the given ayah (reuses the
  // reader's existing fetch/cache pipeline rather than duplicating it here).
  onOpenTefseer: (surah: number, ayah: number) => void;
}

// Bismillah opener shown above ayah 1 of every surah except Al-Fatihah (1) and
// At-Tawbah (9). Matches the reader's constant.
const BISMILLAH = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650';

// Windowed rendering: rather than mounting all 604 variable-height pages behind
// a fake uniform getItemLayout (which desynced FlatList's offset model from the
// real layout and made mode-switch landings wildly wrong), we render only a
// contiguous range of pages around the entry page. The entry page sits at data
// index 0, so it's already at the top on mount — no long jump, just a small
// measured nudge to reveal the entry ayah. The range grows forward on
// onEndReached and backward as the user nears the top.
const INITIAL_FORWARD = 3;   // pages rendered ahead of the entry page on mount
const FORWARD_BATCH = 4;     // pages appended each time the end is reached
const BACKWARD_BATCH = 3;    // pages prepended each time the top is neared
const PREPEND_TRIGGER_PX = 1200; // scroll-from-top distance that triggers prepend

// Page mode renders a fixed-size mushaf leaf, not a user-adjustable reading
// surface: the settings font slider (which sizes the single-verse card in
// ayah mode) intentionally does not apply here, so the page's layout/spacing
// stays consistent regardless of that setting.
const PAGE_MODE_ARABIC_SIZE = 25;

// Module-level cache of assembled page content, keyed by page+translation+
// script, so a page already visited (in this session, across mode switches
// and surah jumps) mounts with its real content on the very FIRST paint
// instead of a spinner that's swapped out once the async assembly resolves.
// That swap is exactly what breaks FlatList's `maintainVisibleContentPosition`
// when it happens to a PREPENDED page (one inserted above the viewport):
// anchoring compensates one coordinated size change at insert time, not a
// second, later, uncoordinated resize once content trickles in — which is
// what was throwing the view to a random page after a surah switch + scroll
// up. Prefetching into this cache before a backward extension (see the
// prepend branch in onScroll below) means the prepended pages' first paint
// already has their true height, so there's only ever one size change.
const pageContentCache = new Map<string, PageContent>();
function pageCacheKey(page: number, translationId: string, script: string): string {
  return `${page}:${translationId}:${script}`;
}
async function loadPageContentCached(
  page: number, anchorSurah: number, translationId: string, script: ArabicScript,
): Promise<PageContent> {
  const key = pageCacheKey(page, translationId, script);
  const cached = pageContentCache.get(key);
  if (cached) return cached;
  const content = await getPageContent(page, anchorSurah, translationId, script);
  pageContentCache.set(key, content);
  return content;
}

// The raw tajweed edition prefixes surah openers with an embedded Bismillah.
// Strip it (matching the ayah reader) so the standalone Bismillah header isn't
// duplicated inline. Returns the cleaned raw text (tajweed brackets intact when
// present) so the caller can still colour it.
function ayahArabic(a: PageAyah): string {
  if (a.numberInSurah !== 1 || a.surah === 1 || a.surah === 9) return a.arabic;
  // Bismillah detection runs on plain text; re-derive from the raw string by
  // stripping only when the plain skeleton matches, then fall back to raw.
  const plain = stripTajweed(a.arabic);
  const stripped = stripBismillahPrefix(plain.split(/\s+/).filter(Boolean)).join(' ');
  return stripped === plain ? a.arabic : stripped;
}

// The ayah-end mark as plain text — the verse number framed by the ornate
// Quranic parentheses ﴿ ﴾ — rather than the SVG roundel previously embedded
// inline. An SVG <View> mixed into a flowing RTL <Text> run is only ever laid
// out as an approximate "attachment": RN's text-wrapping engine doesn't
// measure it the way it measures real glyphs, so it could land overlapping
// the surrounding words once a line wrapped near it. Plain text has none of
// that risk, and it flows, wraps and highlights exactly like the rest of the
// verse. An earlier version used U+06DD (the "end of ayah" mark) expecting
// the font to compose it with the following digits into one nested circular
// numeral the way some Quranic fonts do — on Android that composition never
// happens, so the digits rendered as a separate glyph next to (not inside)
// the mark. ﴿ ﴾ need no such font-specific composition: they're ordinary
// punctuation that simply brackets the digits, so the number is guaranteed to
// sit "inside" its marker on any platform/font.
function ayahMarkerText(number: number): string {
  return `﴿${toArabicDigits(number)}﴾`;
}

// Renders an ayah's Arabic as tajweed-coloured segments when the tajweed script
// is active, else as a plain string. Mirrors the ayah reader: plain segments
// are emitted as bare strings so RN doesn't insert metric spans that break
// cursive joins; only rule-coloured runs get a wrapping <Text>.
function renderArabic(a: PageAyah, isTajweed: boolean, font: string, size: number): React.ReactNode {
  const text = ayahArabic(a);
  if (!isTajweed) return stripTajweed(text);
  const segs = parseTajweedForRender(text, Platform.OS === 'android');
  return segs.map((seg, i) =>
    seg.rule
      ? <Text key={i} style={{ color: TAJWEED_COLORS[seg.rule], fontFamily: font, fontSize: size }}>{seg.text}</Text>
      : seg.text,
  );
}

// Word-synced render for the ayah currently being recited when QUL timestamp
// data exists for it: each real word is its own nested <Text> so the active one
// can take a background tint that tracks the recitation. The word array is split
// the same way the Hifz karaoke UI splits it (drop pure waqf/pause marks via
// isQuranWordToken) so the 0-based activeWord index lines up with QUL's timing.
// Renders as plain (uncoloured) text — word-sync and tajweed colouring compete
// for the same glyphs, and following the spoken word is the clearer cue while
// audio is playing.
function renderWordSynced(a: PageAyah, font: string, size: number, activeWord: number, wordHl: string): React.ReactNode {
  const words = stripTajweed(ayahArabic(a)).split(/\s+/).filter(Boolean).filter(isQuranWordToken);
  return words.map((w, i) => (
    <Text
      key={i}
      style={{
        fontFamily: font, fontSize: size,
        // Only the active word gets a tint; the rest are left unset (not an
        // explicit 'transparent') so the parent ayah-level highlight shows
        // through behind them — otherwise the whole-ayah wash disappears
        // word-by-word during word-sync.
        backgroundColor: i === activeWord ? wordHl : undefined,
      }}
    >
      {w}{i < words.length - 1 ? ' ' : ''}
    </Text>
  ));
}

// Number of recited word-tokens in an ayah, tokenised exactly like the
// word-sync render (drop pure waqf/pause marks) so word-weight position
// estimates line up with what's actually spoken.
function ayahWordCount(a: PageAyah): number {
  return stripTajweed(ayahArabic(a)).split(/\s+/).filter(Boolean).filter(isQuranWordToken).length || 1;
}

// Ornamental surah header shown when a surah begins on the page. A double
// frame (outer brass hairline, inset a second finer one) with a centred glow
// behind the title reads as an illuminated manuscript plate rather than a
// plain card, and clearly separates surahs mid-page.
function SurahPlate({ surah }: { surah: number }) {
  const t = useTheme();
  const s = useStrings();
  const meta = getSurah(surah);
  const font = arabicFontFor('uthmani');
  const rule = t.colors.brass + '4D';
  return (
    <View style={{
      marginVertical: t.spacing(1),
      borderRadius: t.radius.lg, overflow: 'hidden',
      borderWidth: 1, borderColor: t.colors.brass + '5C',
    }}>
      <LinearGradient
        pointerEvents="none"
        colors={t.mode === 'dark' ? ['rgba(209,162,74,0.20)', 'rgba(209,162,74,0.02)'] : ['rgba(176,134,65,0.16)', 'rgba(176,134,65,0.02)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{
        margin: 3, borderRadius: t.radius.md, borderWidth: 0.75, borderColor: t.colors.brass + '33',
        alignItems: 'center', gap: t.spacing(2),
        paddingVertical: t.spacing(4), paddingHorizontal: t.spacing(4),
      }}>
        <Text style={{ color: t.colors.text, fontFamily: font, fontSize: 30, letterSpacing: 0.5, textAlign: 'center' }}>
          {meta?.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), alignSelf: 'stretch', justifyContent: 'center' }}>
          <View style={{ flex: 1, maxWidth: 28, height: 1, backgroundColor: rule }} />
          <AyahMarker showNumber={false} size={9} number={0} />
          <Text style={{ color: t.colors.brass, fontSize: 10, letterSpacing: 1.8, fontWeight: '700', textAlign: 'center' }}>
            {String(surah).padStart(3, '0')} · {meta?.englishName?.toUpperCase()} · {meta?.numberOfAyahs} {s.versesCount.toUpperCase()}
          </Text>
          <AyahMarker showNumber={false} size={9} number={0} />
          <View style={{ flex: 1, maxWidth: 28, height: 1, backgroundColor: rule }} />
        </View>
      </View>
    </View>
  );
}

// Floating ayah-options popup shell: same frosted "GlassDock" language as
// ayah mode's bottom nav dock, so both reading modes share one floating-chrome
// visual vocabulary. Entrance-only fade+rise — no exit animation, so closing
// it (which must stop any playing VerseAudioListen audio) still unmounts in
// the same tick it always has, rather than lingering through a fade-out.
function AyahActionSheet({ bottom, children }: { bottom: number; children: React.ReactNode }) {
  const t = useTheme();
  const fade = useEntranceFade();
  return (
    <Animated.View style={[{ position: 'absolute', left: t.spacing(4), right: t.spacing(4), bottom }, fade]}>
      <GlassDock radius={t.radius.xl} style={{ gap: t.spacing(3), paddingVertical: t.spacing(3), paddingHorizontal: t.spacing(4) }}>
        {children}
      </GlassDock>
    </Animated.View>
  );
}

// Renders a single assembled mushaf page as continuous justified Arabic text.
// Each ayah is a tappable inline segment; the selected ayah is highlighted and
// surfaces an action bar (handled by the parent via onSelect).
function PageView({
  content, arabicSize, selected, entryHighlight, playing, activeWord, onSelectAyah, entryAyah, onEntryOffset, cellRef,
}: {
  content: PageContent;
  arabicSize: number;
  selected: { surah: number; ayah: number } | null;
  // The entry ayah highlighted on mount without surfacing the action bar (that's
  // gated on `selected`). Cleared once the user taps an ayah or starts playback.
  entryHighlight: { surah: number; ayah: number } | null;
  playing: { surah: number; ayah: number } | null;
  // 0-based index of the word being recited within the `playing` ayah, or null
  // when there's no word-timing data for it (most reciters/ayahs).
  activeWord: number | null;
  onSelectAyah: (a: PageAyah) => void;
  // The entry ayah (the verse the user was on in ayah mode). When present and on
  // this page, its offset WITHIN the page cell is reported via onEntryOffset so
  // the mount landing can scroll to the verse itself, not just the page top.
  entryAyah?: { surah: number; ayah: number } | null;
  onEntryOffset?: (offsetInCell: number) => void;
  // The page cell's view node, used as the reference for measuring the entry
  // ayah's offset within the page (measureLayout is reliable for inline text,
  // unlike measureInWindow which returns bogus coords for nested <Text>).
  cellRef: React.RefObject<View | null>;
}) {
  const t = useTheme();
  const s = useStrings();
  const script = useAppStore(st => st.settings.arabicScript);
  const isTajweed = script === 'tajweed';
  const font = arabicFontFor(script);
  const lineHeight = arabicLineHeightFor(arabicSize);
  const hl = highlightBg(t);
  const playHl = playingBg(t);
  const wordHl = wordHighlightBg(t);

  // The entry ayah reports its offset within the page cell via a reliable
  // block-measure (measureLayout on a View, not the inline <Text> which silently
  // fails on Android): its surah-group's justified <Text> block is measured
  // against the cell, and the verse's slice is estimated by cumulative
  // word-weight. Justified Arabic fills lines evenly, so word-weight tracks
  // vertical position closely enough. The shared machinery (groups, groupWeights,
  // groupNodeRef) is declared just below; measureEntry is defined after it.

  // Group ayahs by surah so a surah that begins mid-page gets its own header.
  const groups = useMemo(() => {
    const out: { surah: number; ayahs: PageAyah[] }[] = [];
    for (const a of content.ayahs) {
      const last = out[out.length - 1];
      if (last && last.surah === a.surah) last.ayahs.push(a);
      else out.push({ surah: a.surah, ayahs: [a] });
    }
    return out;
  }, [content]);

  // Per-group word-weight index: for each surah-group, the cumulative word
  // count BEFORE each ayah and each ayah's own word count, plus the group
  // total. Used to slice the group's measured height into per-ayah bands.
  const groupWeights = useMemo(() => {
    const map = new Map<number, { total: number; before: Map<number, number>; own: Map<number, number> }>();
    for (const g of groups) {
      const before = new Map<number, number>();
      const own = new Map<number, number>();
      let acc = 0;
      for (const a of g.ayahs) {
        const w = ayahWordCount(a);
        before.set(a.numberInSurah, acc);
        own.set(a.numberInSurah, w);
        acc += w;
      }
      map.set(g.surah, { total: acc || 1, before, own });
    }
    return map;
  }, [groups]);

  // Each group's justified <Text> block View node, so we can measureLayout it
  // against the cell — measureLayout on a View is reliable (it's the inline
  // <Text> variant that silently fails), giving the block's true top within
  // the cell. Used to interpolate a landing position WITHIN the block by
  // word-weight for any ayah after the group's first.
  const groupNodeRef = useRef<Map<number, View>>(new Map());
  // Each group's OUTER container (SurahPlate + Bismillah + the text block
  // above), so landing on a surah's very first ayah can reveal that whole
  // opening flourish instead of jumping straight to the ayah's own words —
  // measuring only the inner text block (above) for ayah 1 put the landing
  // offset right at the first word, which scrolled SurahPlate/Bismillah
  // almost entirely off-screen (HEADER_OCCLUSION is sized for "a bit above one
  // line of text", nowhere near enough to also clear that ornamental header).
  const groupContainerRef = useRef<Map<number, View>>(new Map());

  // Report the entry ayah's offset WITHIN its page cell so the parent's mount
  // landing can scroll to the verse itself — same reliable block-measure as the
  // reciting ayah (the inline <Text> measureLayout this replaced silently failed
  // on Android).
  const measureEntry = useCallback(() => {
    if (!onEntryOffset || !entryAyah) return;
    const cell = cellRef.current;
    if (!cell) return;
    if (entryAyah.ayah === 1) {
      const node = groupContainerRef.current.get(entryAyah.surah);
      if (!node) return;
      node.measureLayout(
        cell,
        (_x: number, y: number, _width: number, blockH: number) => {
          if (blockH < 8 || y < 0) return; // ignore pre-layout measurements
          onEntryOffset(y);
        },
        () => {},
      );
      return;
    }
    // Any other ayah: measure the group's own text block and estimate the
    // verse's top by cumulative word-weight within it (justified Arabic fills
    // lines evenly, so word-weight tracks vertical position closely enough).
    const w = groupWeights.get(entryAyah.surah);
    const node = groupNodeRef.current.get(entryAyah.surah);
    if (!w || !node) return;
    node.measureLayout(
      cell,
      (_x: number, y: number, _width: number, blockH: number) => {
        if (blockH < 8 || y < 0) return;
        const before = w.before.get(entryAyah.ayah) ?? 0;
        onEntryOffset(y + (before / w.total) * blockH);
      },
      () => {},
    );
  }, [onEntryOffset, entryAyah, cellRef, groupWeights]);

  // Re-measure across a few passes after mount. The offset within the cell is
  // stable (it doesn't change with scroll), but the page content assembles
  // asynchronously, so an early measurement can be premature; these passes let
  // it settle once the real text has laid out. Keyed to the entry ayah so it
  // only runs on the switch-in page.
  const entryKey = entryAyah ? `${entryAyah.surah}:${entryAyah.ayah}` : null;
  useEffect(() => {
    if (!onEntryOffset || !entryKey) return;
    const ids = [80, 250, 450, 700, 1000].map(ms => setTimeout(measureEntry, ms));
    return () => ids.forEach(clearTimeout);
  }, [entryKey, onEntryOffset, measureEntry]);

  return (
    // Outer margin (rather than edge-to-edge) plus the layered card below is
    // what turns the flowing text into a distinct mushaf "leaf": a lifted
    // sheet with its own shadow, sitting on the slightly darker reader
    // background set on the FlatList's wrapper.
    <View style={{ marginHorizontal: t.spacing(3), marginBottom: t.spacing(6) }}>
      {/* Background layer: the page's parchment fill, border and shadow live
          here rather than on the content wrapper — same split used by the
          ayah-mode verse card — so Android's elevation-driven clipToOutline
          never clips the Arabic glyphs against a rounded corner. */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: t.colors.surfaceElevated,
        borderRadius: t.radius.xl,
        borderWidth: 0.75, borderColor: t.colors.hairline,
        shadowColor: '#000',
        shadowOpacity: t.mode === 'dark' ? 0.4 : 0.07,
        shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
        elevation: 3,
      }} />
      {/* Decoration layer: faint brass arabesque watermarks bleeding off two
          corners, clipped to the card's own rounded shape on their own layer
          so they never interact with the text layer's layout/measurement. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: t.radius.xl, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -44, top: -44, opacity: t.mode === 'dark' ? 0.07 : 0.05 }}>
          <ArabesqueMark size={200} color={t.colors.brass} />
        </View>
        <View style={{ position: 'absolute', left: -44, bottom: -44, opacity: t.mode === 'dark' ? 0.06 : 0.04 }}>
          <ArabesqueMark size={160} color={t.colors.brass} />
        </View>
      </View>
      <View style={{ paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(5), gap: t.spacing(3) }}>
      {groups.map(group => {
        const showBismillah = group.ayahs[0]?.numberInSurah === 1 && group.surah !== 1 && group.surah !== 9;
        return (
          <View
            key={group.surah}
            style={{ gap: t.spacing(2) }}
            ref={node => {
              if (node) groupContainerRef.current.set(group.surah, node);
              else groupContainerRef.current.delete(group.surah);
            }}
            onLayout={() => {
              if (entryAyah?.surah === group.surah && entryAyah.ayah === 1) measureEntry();
            }}
          >
            {group.ayahs[0]?.numberInSurah === 1 && <SurahPlate surah={group.surah} />}
            {showBismillah && (
              <View style={{ alignItems: 'center', gap: t.spacing(1.5), marginBottom: t.spacing(1) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                  <View style={{ width: 22, height: 1, backgroundColor: t.colors.brass + '66' }} />
                  <View style={{ width: 5, height: 5, backgroundColor: t.colors.brass + 'AA', transform: [{ rotate: '45deg' }] }} />
                  <View style={{ width: 22, height: 1, backgroundColor: t.colors.brass + '66' }} />
                </View>
                <Text style={{ color: t.colors.brass, fontFamily: arabicFontFor('uthmani'), fontSize: arabicSize * 0.85, textAlign: 'center', lineHeight }}>
                  {BISMILLAH}
                </Text>
              </View>
            )}
            <View
              ref={node => {
                if (node) groupNodeRef.current.set(group.surah, node);
                else groupNodeRef.current.delete(group.surah);
              }}
              onLayout={() => {
                if (entryAyah?.surah === group.surah) measureEntry();
              }}
            >
            <Text
              allowFontScaling={false}
              textBreakStrategy="simple"
              style={{
                // 'justify' (previously used on iOS) stretches inter-word
                // spacing unevenly to fill each line — and since the ayah-end
                // marker below is an inline View embedded in this same text
                // run, the stretch concentrates around it, producing outsized
                // gaps, a marker that reads as "floating" in that gap, and a
                // per-ayah highlight rectangle that balloons to cover the
                // stretched space. Plain 'right' avoids all three.
                textAlign: 'right',
                writingDirection: 'rtl', lineHeight, color: t.colors.text,
              }}
            >
              {group.ayahs.map(a => {
                const isSel = selected?.surah === a.surah && selected?.ayah === a.numberInSurah;
                const isPlaying = playing?.surah === a.surah && playing?.ayah === a.numberInSurah;
                // Entry highlight uses the same background as a manual selection
                // but doesn't surface the action bar (the popup is gated on
                // `selected`); it marks where the user was on entering page mode.
                const isEntry = entryHighlight?.surah === a.surah && entryHighlight?.ayah === a.numberInSurah;
                // Word-sync only on the reciting ayah and only when we have a
                // resolved active word; otherwise fall back to the normal
                // (tajweed-coloured or plain) render.
                const wordSynced = isPlaying && activeWord != null;
                return (
                  // The separating space AFTER the marker sits OUTSIDE the
                  // highlighted <Text> (as its own plain sibling) so a
                  // selection/playing highlight ends right at the marker
                  // glyph instead of bleeding into the gap before the next
                  // ayah's first word.
                  <React.Fragment key={a.numberInSurah}>
                    <Text
                      onPress={() => onSelectAyah(a)}
                      suppressHighlighting
                      style={{
                        color: t.colors.text,
                        fontFamily: font,
                        fontSize: arabicSize,
                        lineHeight,
                        backgroundColor: isPlaying ? playHl : isSel || isEntry ? hl : 'transparent',
                      }}
                    >
                      {wordSynced
                        ? renderWordSynced(a, font, arabicSize, activeWord, wordHl)
                        : renderArabic(a, isTajweed, font, arabicSize)}
                      {' '}
                      <Text style={{ color: t.colors.brass, fontFamily: font, fontSize: arabicSize * 0.85 }}>
                        {ayahMarkerText(a.numberInSurah)}
                      </Text>
                    </Text>
                    {' '}
                  </React.Fragment>
                );
              })}
            </Text>
            </View>
          </View>
        );
      })}
      {/* Colophon: a brass medallion holding the page number, flanked by rules
          that taper from the card's own fill into brass and back — reading as
          an inlaid seal rather than a plain pill, closing out the leaf. The
          card's own edge/shadow/outer margin is what separates one mushaf
          spread from the next, so no extra divider is needed below it. */}
      <View style={{ alignItems: 'center', marginTop: t.spacing(3), gap: t.spacing(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3), alignSelf: 'stretch' }}>
          <LinearGradient
            colors={[t.colors.surfaceElevated, t.colors.brass + '66']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, height: 1 }}
          />
          <View style={{
            width: 42, height: 42, borderRadius: 21,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.25, borderColor: t.colors.brass + '99',
          }}>
            <View pointerEvents="none" style={{
              position: 'absolute', width: 32, height: 32, borderRadius: 16,
              borderWidth: 0.75, borderColor: t.colors.brass + '4D',
            }} />
            <Text style={{ color: t.colors.brass, fontSize: 13, fontWeight: '800' }}>
              {content.page}
            </Text>
          </View>
          <LinearGradient
            colors={[t.colors.brass + '66', t.colors.surfaceElevated]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, height: 1 }}
          />
        </View>
        <Text style={{ color: t.colors.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '600' }}>
          {s.pageLabel.toUpperCase()} {content.page} / {TOTAL_MUSHAF_PAGES}
        </Text>
      </View>
      </View>
    </View>
  );
}

// Lightweight per-page loader: assembles a page's contents on demand and caches
// them in component state. Renders a spinner until the async assembly resolves.
// Memoised so the 100ms word-sync ticks (which re-render the parent) only touch
// the page actually holding the reciting ayah — every other mounted page sees
// identical props and bails out of re-rendering.
const LazyPage = React.memo(function LazyPage({
  page, anchorSurah, arabicSize, selected, entryHighlight, playing, activeWord, onSelectAyah, entryAyah, onEntryOffset, onCellLayout, onLoaded, onLoadError, reloadToken,
}: {
  page: number;
  anchorSurah: number;
  arabicSize: number;
  selected: { surah: number; ayah: number } | null;
  entryHighlight: { surah: number; ayah: number } | null;
  playing: { surah: number; ayah: number } | null;
  activeWord: number | null;
  onSelectAyah: (a: PageAyah) => void;
  // Forwarded to PageView so the entry ayah reports its offset within this cell.
  entryAyah?: { surah: number; ayah: number } | null;
  onEntryOffset?: (offsetInCell: number) => void;
  // Reports this cell's content-space top (layout.y within the list content) so
  // the parent can place the page and resolve the entry ayah's absolute offset
  // (cell top + the ayah's measured offset within the cell).
  onCellLayout?: (page: number, y: number) => void;
  onLoaded?: (content: PageContent) => void;
  // Reports a genuine load failure (most commonly a non-default script, e.g.
  // Tajweed, that's never been downloaded, while offline) up to the parent —
  // which shows ONE unified offline/retry screen for the whole reader rather
  // than every mounted/prefetched page separately surfacing its own copy of
  // the same failure.
  onLoadError?: () => void;
  // Bumped by the parent once a retry download succeeds, to re-run the load
  // below for every currently-mounted page without remounting/losing scroll
  // position.
  reloadToken: number;
}) {
  const translationId = useAppStore(st => st.settings.translationId);
  const script = useAppStore(st => st.settings.arabicScript);
  const t = useTheme();
  // Cache-hit pages (already visited, or prefetched ahead of a backward
  // extension — see onScroll below) start with their real content on the
  // very first render, so there's no spinner-then-resize to desync the
  // list's scroll anchoring.
  const [content, setContent] = useState<PageContent | null>(
    () => pageContentCache.get(pageCacheKey(page, translationId, script)) ?? null,
  );

  useEffect(() => {
    let alive = true;
    const key = pageCacheKey(page, translationId, script);
    const cached = pageContentCache.get(key);
    if (cached) {
      setContent(cached);
      onLoaded?.(cached);
      return;
    }
    setContent(null);
    loadPageContentCached(page, anchorSurah, translationId, script)
      .then(c => { if (alive) { setContent(c); onLoaded?.(c); } })
      .catch(() => { if (alive) onLoadError?.(); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, translationId, script, reloadToken]);

  const cellRef = useRef<View>(null);
  const body = !content ? (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: t.spacing(24) }}>
      <ActivityIndicator size="large" color={t.accent.primary} />
    </View>
  ) : (
    <PageView content={content} arabicSize={arabicSize} selected={selected} entryHighlight={entryHighlight} playing={playing} activeWord={activeWord} onSelectAyah={onSelectAyah} entryAyah={entryAyah} onEntryOffset={onEntryOffset} cellRef={cellRef} />
  );
  return (
    <View
      ref={cellRef}
      onLayout={e => {
        // Report the cell's content-space top (layout.y is relative to the list
        // content), so the parent can place the page and resolve the entry/
        // reciting ayah's absolute offset without any window-coordinate
        // conversion.
        if (onCellLayout) onCellLayout(page, e.nativeEvent.layout.y);
      }}
    >
      {body}
    </View>
  );
});

export default function PageModeReader({ initialPage, anchorSurah, highlightAyah, onPositionChange, onOpenTefseer }: Props) {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const arabicSize = PAGE_MODE_ARABIC_SIZE;
  const reciterId = useAppStore(st => st.settings.reciterId);
  const favorites = useAppStore(st => st.favorites);
  const bookmarks = useAppStore(st => st.bookmarks);
  const toggleFavorite = useAppStore(st => st.toggleFavorite);
  const toggleBookmark = useAppStore(st => st.toggleBookmark);
  const isTajweed = useAppStore(st => st.settings.arabicScript) === 'tajweed';
  const listRef = useRef<FlatList<number>>(null);

  // Set when ANY currently-mounted/prefetched page fails to load its content
  // — most commonly a non-default script (e.g. Tajweed) that's never been
  // downloaded, while offline. Swaps the whole reading surface for ONE
  // offline/retry screen (mirroring ayah mode's) rather than letting every
  // page separately render its own copy of the same failure.
  const [contentUnavailable, setContentUnavailable] = useState(false);
  const onLoadError = useCallback(() => setContentUnavailable(true), []);
  // Bumped after a successful retry download so every currently-mounted page
  // re-runs its load against the now-warm cache, without remounting the list
  // (which would lose scroll position).
  const [reloadToken, setReloadToken] = useState(0);
  const [downloadingScript, setDownloadingScript] = useState(false);
  const precache = useAppStore(st => st.precache);
  // Downloads the WHOLE current script/translation edition (not just the one
  // page that happened to fail first) — every other page would hit the
  // identical failure otherwise, since it's the same missing edition.
  const retryDownload = useCallback(async () => {
    if (downloadingScript) return;
    setDownloadingScript(true);
    await bootstrapQuranCache();
    setDownloadingScript(false);
    if (!useAppStore.getState().precache.error) {
      setContentUnavailable(false);
      setReloadToken(n => n + 1);
    }
  }, [downloadingScript]);

  // Collapsible tajweed colour guide, only offered while the tajweed script is
  // active. Closed by default so it never intrudes on the reading surface.
  const [showLegend, setShowLegend] = useState(false);
  // Surah picker sheet, opened from the header title so the reader can jump to
  // any surah's first page directly.
  const [showSurahPicker, setShowSurahPicker] = useState(false);

  const clampedInitial = Math.max(1, Math.min(TOTAL_MUSHAF_PAGES, initialPage));

  // The window of pages currently rendered. Entry page = range.start = data
  // index 0, so it's on screen at mount with no jump. Grows forward/backward as
  // the user scrolls (see onEndReached / the prepend in onScroll).
  const [range, setRange] = useState(() => ({
    start: clampedInitial,
    end: Math.min(TOTAL_MUSHAF_PAGES, clampedInitial + INITIAL_FORWARD),
  }));
  const data = useMemo(
    () => Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i),
    [range],
  );
  // Latches while a range extension is in flight so a burst of scroll events
  // doesn't queue multiple prepends before the new pages measure. Reset once the
  // range actually changes. Clearing pendingPrependRef here (rather than in
  // onContentSizeChange) marks the prepend "settled" as soon as the range commit
  // lands, so deferred playback appends can flush again.
  const extendingRef = useRef(false);
  useEffect(() => {
    extendingRef.current = false;
    pendingPrependRef.current = false;
  }, [range.start, range.end]);
  // Live mirror of the range so inline handlers (onScroll) read fresh bounds.
  const rangeRef = useRef(range);
  rangeRef.current = range;
  // Prepend anchoring is handled by FlatList's maintainVisibleContentPosition
  // (minIndexForVisible: 1) — it keeps the first visible page pinned as earlier
  // pages are inserted above, correctly across the multi-pass async measurement
  // of variable-height pages. The old manual single-delta offset shift only
  // compensated the FIRST content-size change, so the later measurements of tall
  // prepended pages grew the content above the viewport uncompensated and threw
  // the view to a random page (most visible right after a surah jump, when the
  // user starts at the top). pendingPrependRef now only gates playback appends
  // (see flushPendingPlayPage) so a prepend and an append don't both mutate the
  // range in the same frame.
  const pendingPrependRef = useRef(false);
  // True while the user is actively dragging or the list is coasting under
  // momentum. Playback-driven range appends are deferred until this clears so a
  // content-size change never lands mid-gesture (which shifts the visible page
  // and reads as a jump/flicker while the user scrolls during recitation).
  const isScrollingRef = useRef(false);
  // A reciting page whose range append was deferred because the user was
  // scrolling; applied once scrolling settles (see onScrollEndDrag /
  // onMomentumScrollEnd).
  const pendingPlayPageRef = useRef<number | null>(null);
  // The precise verse to land on — fed by BOTH the initial mount (from
  // `highlightAyah`) and any later in-reader jump (see `jumpTo`), so the same
  // measured-offset landing logic (below) handles both cases instead of a jump
  // having its own cruder "scroll to page top" approximation. `ayah: null`
  // means "no precise verse target, the page's natural top is already
  // correct" — the case when resuming mid-surah with no specific entry verse.
  const [landingTarget, setLandingTarget] = useState<{ page: number; surah: number; ayah: number | null }>(() => ({
    page: clampedInitial,
    surah: highlightAyah?.surah ?? anchorSurah,
    ayah: highlightAyah?.ayah ?? null,
  }));
  // Transient floating "Page N / TOTAL" indicator (Kindle/Apple-Books style):
  // fades in on gesture start, fades out ~1s after the gesture settles. Purely
  // cosmetic — an Animated.Value driven only from the four gesture-lifecycle
  // scroll callbacks below, never read by or fed into range/prepend/append.
  const pageIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const pageIndicatorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pageIndicatorHideTimerRef.current) clearTimeout(pageIndicatorHideTimerRef.current);
  }, []);
  const showPageIndicator = useCallback(() => {
    if (pageIndicatorHideTimerRef.current) {
      clearTimeout(pageIndicatorHideTimerRef.current);
      pageIndicatorHideTimerRef.current = null;
    }
    Animated.timing(pageIndicatorOpacity, {
      toValue: 1, duration: t.motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [pageIndicatorOpacity, t.motion.fast]);
  const scheduleHidePageIndicator = useCallback(() => {
    if (pageIndicatorHideTimerRef.current) clearTimeout(pageIndicatorHideTimerRef.current);
    pageIndicatorHideTimerRef.current = setTimeout(() => {
      Animated.timing(pageIndicatorOpacity, {
        toValue: 0, duration: t.motion.base, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start();
    }, 1000);
  }, [pageIndicatorOpacity, t.motion.base]);
  // Extends the rendered range forward to keep `page` (plus a little lookahead)
  // mounted so its reciting ayah can render/highlight. Appends at the bottom
  // only, so it never shifts the visible position on its own.
  const ensurePageInRange = useCallback((page: number) => {
    setRange(prev => (page >= prev.start && page <= prev.end
      ? prev
      : { ...prev, end: Math.max(prev.end, Math.min(TOTAL_MUSHAF_PAGES, page + FORWARD_BATCH)) }));
  }, []);
  // Apply a deferred playback append once scrolling has settled. Held off while
  // a prepend is in flight so the two range mutations never land in the same
  // content-size change (which would let the append's bottom-growth inflate the
  // prepend compensation delta and over-shoot). It flushes on the next settle.
  const flushPendingPlayPage = useCallback(() => {
    if (pendingPrependRef.current) return;
    const page = pendingPlayPageRef.current;
    if (page == null) return;
    pendingPlayPageRef.current = null;
    ensurePageInRange(page);
  }, [ensurePageInRange]);

  // Selected ayah drives the highlight + action bar. Starts null so the ayah
  // options popup never appears by default on entering page mode — it only
  // shows once the user taps an ayah. (The entry ayah is still scrolled into
  // view via highlightAyah/the mount landing; that's independent of selection.)
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(null);
  // Entry ayah highlighted on mount (the verse the user was on in ayah mode) so
  // switching modes keeps their place visible — but WITHOUT surfacing the action
  // bar (that's gated on `selected`). Cleared the moment the user taps an ayah or
  // starts playback, so it never lingers alongside a fresh selection/highlight.
  const [entryHighlight, setEntryHighlight] = useState<{ surah: number; ayah: number } | null>(
    () => highlightAyah ?? null,
  );
  const [pageAnchor, setPageAnchor] = useState(anchorSurah);

  // Drives the sticky header. Seeded from the entry ayah so the header is
  // correct before the first page even finishes assembling.
  const [header, setHeader] = useState<{ page: number; surah: number }>(
    () => ({ page: clampedInitial, surah: anchorSurah }),
  );

  // page -> first ayah on that page, learned as pages load. Lets the sticky
  // header and position sync resolve instantly on scroll without re-assembling
  // the page.
  const firstAyahByPage = useRef<Map<number, { surah: number; ayah: number }>>(new Map());

  const onSelectAyah = useCallback((a: PageAyah) => {
    void Haptics.selectionAsync();
    setEntryHighlight(null);
    setSelected({ surah: a.surah, ayah: a.numberInSurah });
    onPositionChange(a.surah, a.numberInSurah);
  }, [onPositionChange]);

  const onPageLoaded = useCallback((c: PageContent) => {
    const first = c.ayahs[0];
    if (first) firstAyahByPage.current.set(c.page, { surah: first.surah, ayah: first.numberInSurah });
  }, []);

  // ── Continuous recitation ────────────────────────────────────────────────
  // Plays the current ayah, then auto-advances to the next (across surah
  // boundaries), highlighting each verse and scrolling its page into view. The
  // highlight uses a dedicated `playing` position, distinct from a manual tap
  // `selected`, so starting playback doesn't pop the per-ayah action bar.
  const translationId = useAppStore(st => st.settings.translationId);
  const script = useAppStore(st => st.settings.arabicScript);
  const [playing, setPlaying] = useState<{ surah: number; ayah: number } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // 100ms sampling (vs. the 500ms default) so word-sync highlighting keeps pace
  // with even short word segments, matching HifzKaraokePlayer.
  const audioPlayer = useAudioPlayer(audioUrl, { updateInterval: 100 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  // Latest values the async playback callbacks close over, kept in refs so the
  // stable didJustFinish effect never restarts or reads stale data.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const reciterRef = useRef(reciterId);
  reciterRef.current = reciterId;
  // Mirrors the latest player status for the one-shot hard-ceiling watchdog
  // below, which must not re-arm on every status change.
  const audioStatusRef = useRef(audioStatus);
  audioStatusRef.current = audioStatus;
  // Bumped on each fresh playAyah so the hard-ceiling watchdog re-arms per verse.
  const [playRequestToken, setPlayRequestToken] = useState(0);

  // Word-sync state. `karaoke` holds the QUL timestamp data for the ayah being
  // recited (null when the reciter/ayah has none — the common case); `activeWord`
  // is the 0-based index of the word currently being spoken within it, derived
  // from playback position. The page the reciting ayah sits on drives which page
  // receives the (per-tick-changing) activeWord so the rest never re-render.
  const [karaoke, setKaraoke] = useState<KaraokeAyahData | null>(null);
  const [playingPage, setPlayingPage] = useState<number | null>(null);
  const [activeWord, setActiveWord] = useState<number | null>(null);
  // Mirrors playingPage for the async playAyah callback (which can't read the
  // fresh state value) so it can tell a same-page advance from a page crossing.
  const playingPageRef = useRef<number | null>(null);
  // Continuous-play connectivity feedback. Recitation audio always streams, so
  // starting play offline leaves the button spinning forever with no cue —
  // 'offline'/'error' surface an inline notice with a retry instead. Holds the
  // verse to resume from so retry replays exactly where it stalled.
  const [playbackError, setPlaybackError] = useState<'offline' | 'error' | null>(null);
  const retryAyahRef = useRef<{ surah: number; ayah: number } | null>(null);

  // Resolve the audio for a verse and scroll it into view, then start it. The
  // player is rebuilt when audioUrl changes (useAudioPlayer), so play() runs
  // once the new source is set via the didJustFinish/effect chain below.
  const playAyah = useCallback(async (surah: number, ayah: number) => {
    setPlaying({ surah, ayah });
    setEntryHighlight(null);
    setActiveWord(null);
    setPlaybackError(null);
    retryAyahRef.current = { surah, ayah };
    // Re-arm the hard-ceiling offline backstop for this verse.
    setPlayRequestToken(n => n + 1);
    // QUL word-timings only line up with QUL's own recording, so when data
    // exists for this reciter+ayah we must play that exact file to word-sync;
    // otherwise fall back to the standard stream with no per-word highlight.
    const kd = getKaraokeAyahData(reciterRef.current, surah, ayah);
    setKaraoke(kd);
    // Keep the shared position in sync so switching back to ayah mode resumes
    // on the verse currently being recited.
    onPositionChangeRef.current(surah, ayah);
    try {
      // Route to the loud speaker (matches useTogglePlayback) so recitation
      // isn't near-silent when a prior record session left .playAndRecord active
      // or the device is on silent.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const [streamUrl, page] = await Promise.all([
        kd ? Promise.resolve(kd.audioUrl) : getAyahAudioUrl(surah, ayah, reciterRef.current),
        pageForAyah(surah, ayah, translationId, script),
      ]);
      // Track which page holds the reciting ayah (drives the highlight and
      // which page receives word-sync).
      setPlayingPage(page ?? null);
      playingPageRef.current = page ?? null;
      // Make sure that page (and a little lookahead) is actually part of the
      // rendered range — pages otherwise only get appended once the user
      // scrolls near the very bottom of ALL currently rendered content
      // (FlatList's onEndReached). Without this, playback can cross into a page
      // that was never mounted/loaded, so its reciting ayah would never be
      // rendered to highlight. While the user is scrolling, defer this append:
      // growing the list mid-gesture triggers a content-size change that can
      // shift the visible page and read as a jump/flicker. The deferred page is
      // flushed the moment scrolling settles.
      if (page != null) {
        if (isScrollingRef.current) pendingPlayPageRef.current = page;
        else ensurePageInRange(page);
      }
      setAudioUrl(streamUrl);
    } catch (e) {
      // Resolving the stream failed — for streamed recitation that's almost
      // always connectivity. Surface an inline notice (offline vs generic) with
      // a retry instead of leaving the header button spinning silently.
      setAudioUrl(null);
      setKaraoke(null);
      setPlayingPage(null);
      playingPageRef.current = null;
      setActiveWord(null);
      setPlaybackError(isOfflineError(e) ? 'offline' : 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationId, script]);

  const stopPlayback = useCallback(() => {
    // The native player is torn down/rebuilt whenever audioUrl changes, so its
    // shared object may already be gone by the time we pause — expo-audio throws
    // NativeSharedObjectNotFoundException in that case. Clearing the source is
    // what actually stops audio; the pause is best-effort.
    try { audioPlayer.pause(); } catch {}
    setPlaying(null);
    setAudioUrl(null);
    setKaraoke(null);
    setPlayingPage(null);
    playingPageRef.current = null;
    setActiveWord(null);
    setPlaybackError(null);
    retryAyahRef.current = null;
  }, [audioPlayer]);

  const togglePlayback = useCallback(() => {
    void Haptics.selectionAsync();
    if (playingRef.current || playbackError) { stopPlayback(); return; }
    // Start from the tapped verse if one is selected, else the top of the
    // current page (its first ayah, learned as pages load).
    const start = selected ?? firstAyahByPage.current.get(header.page) ?? { surah: header.surah, ayah: 1 };
    // Continuous play and the single-ayah mini-player must never sound at once:
    // dismissing the selection unmounts VerseAudioListen (releasing its player).
    setSelected(null);
    void playAyah(start.surah, start.ayah);
  }, [selected, header.page, header.surah, playAyah, stopPlayback, playbackError]);

  // Retry after an offline/error stall, replaying the verse that failed.
  const retryPlayback = useCallback(() => {
    const target = retryAyahRef.current;
    setPlaybackError(null);
    if (target) void playAyah(target.surah, target.ayah);
  }, [playAyah]);

  // Start playback the moment a freshly-resolved source lands (the player was
  // rebuilt for it during render). Keyed on audioUrl so each new ayah plays.
  // Wrapped because play() can throw a transient session-activation error while
  // iOS negotiates the audio route (same class of error useTogglePlayback
  // retries); a single miss just means the user can tap play again.
  useEffect(() => {
    if (!audioUrl || !playingRef.current) return;
    try { audioPlayer.play(); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Soft offline watchdog for a URL that resolved from cache before going
  // offline: getAyahAudioUrl succeeds, so playAyah reaches playback, but
  // expo-audio silently can't fetch the remote mp3 and play() never throws —
  // the button would spin forever. If the source isn't loaded, playing, or even
  // buffering after a short grace period, it's plainly stuck → offline.
  // Mirrors VerseAudioListen's watchdog.
  //
  // isBuffering means the file is actively downloading — the everyayah fallback
  // host can take 5–13s per mp3, so treat buffering as working here; the
  // hard-ceiling watchdog below is the backstop for buffering that never
  // resolves (true offline can report buffering indefinitely).
  const clearPlaybackForOffline = useCallback(() => {
    try { audioPlayer.pause(); } catch {}
    setAudioUrl(null);
    setKaraoke(null);
    setPlayingPage(null);
    playingPageRef.current = null;
    setActiveWord(null);
    setPlaybackError('offline');
  }, [audioPlayer]);

  useEffect(() => {
    if (!audioUrl || !playing) return;
    if (audioStatus.isLoaded || audioStatus.playing || audioStatus.isBuffering) return;
    const id = setTimeout(() => {
      if (!audioStatus.isLoaded && !audioStatus.playing && !audioStatus.isBuffering) {
        clearPlaybackForOffline();
      }
    }, 8000);
    return () => clearTimeout(id);
  }, [audioUrl, playing, audioStatus.isLoaded, audioStatus.playing, audioStatus.isBuffering, clearPlaybackForOffline]);

  // Hard-ceiling backstop: a one-shot timer re-armed per verse (keyed on
  // playRequestToken only). When offline, expo-audio can sit "buffering"
  // forever without loading, which the soft watchdog tolerates — this ceiling
  // (well above everyayah's ~13s worst load) surfaces offline regardless of the
  // buffering flag so the retry UI appears instead of an endless spinner.
  useEffect(() => {
    if (playRequestToken === 0) return;
    const id = setTimeout(() => {
      // Only declare offline if we're still trying to play this verse — the
      // user may have stopped in the meantime (which clears `playing`).
      if (!playingRef.current) return;
      const st = audioStatusRef.current;
      if (!st.isLoaded && !st.playing) clearPlaybackForOffline();
    }, 25000);
    return () => clearTimeout(id);
  }, [playRequestToken, clearPlaybackForOffline]);

  // Advance to the next ayah when the current one finishes. Steps within the
  // surah, then crosses into the next surah's ayah 1, stopping after 114.
  useEffect(() => {
    if (!audioStatus.didJustFinish || !playingRef.current) return;
    const { surah, ayah } = playingRef.current;
    const count = getSurah(surah)?.numberOfAyahs ?? 0;
    if (ayah < count) {
      void playAyah(surah, ayah + 1);
    } else if (surah < 114) {
      void playAyah(surah + 1, 1);
    } else {
      setPlaying(null);
      setAudioUrl(null);
      setKaraoke(null);
      setPlayingPage(null);
      playingPageRef.current = null;
      setActiveWord(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStatus.didJustFinish]);

  // Drive the per-word highlight from playback position when the reciting ayah
  // has QUL timing data. Mirrors HifzKaraokePlayer: last-reached segment stays
  // active through any alignment gap. No-op (stays null) for the common case of
  // no karaoke data, so untimed reciters keep only the ayah-level highlight.
  useEffect(() => {
    if (!karaoke) { if (activeWord !== null) setActiveWord(null); return; }
    const idx = activeWordIndex(karaoke.segments, audioStatus.currentTime * 1000, karaoke.durationMs);
    setActiveWord(prev => (prev === idx ? prev : idx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karaoke, audioStatus.currentTime]);

  // Cheap position tracking: the top-most visible page updates the sticky header
  // and reports its first ayah back to the parent (for ayah-mode resume).
  // Unlike the old onMomentumScrollEnd, this never re-runs getPageContent.
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  // The first viewability callback fires for the initial page on mount. Skip its
  // position report so the precise entry ayah (highlightAyah) survives until the
  // user actually scrolls to another page.
  const initialPageRef = useRef(clampedInitial);
  // Latest top-most visible page, mirrored so the sticky header can track it.
  const headerPageRef = useRef(clampedInitial);
  // Set true once the entry-ayah landing nudge has settled (see the mount effect
  // below). Declared here so it can gate the entry-ayah measurement in
  // renderItem once landing is done.
  const landedRef = useRef(false);
  // Content-space top (layout.y within the list content) of each rendered page,
  // learned from its cell's onLayout. This is the page's exact scroll offset —
  // the landing target's page-top fallback and the base for the entry-ayah
  // offset below.
  const pageContentTopRef = useRef<Map<number, number>>(new Map());
  const onCellLayout = useCallback((page: number, y: number) => {
    pageContentTopRef.current.set(page, y);
  }, []);
  // Offset of the entry ayah WITHIN its page cell (from measureLayout against the
  // cell), reported by PageView once laid out. Added to the cell's content top it
  // gives the verse's absolute scroll offset. null until measured / no entry ayah.
  const entryOffsetInCellRef = useRef<number | null>(null);
  const onEntryOffset = useCallback((offsetInCell: number) => {
    entryOffsetInCellRef.current = offsetInCell;
  }, []);
  // Live content offset (mirrored from onScroll), read by the mount landing and
  // the prepend-compensation below.
  const scrollOffsetRef = useRef(0);
  // The sticky header overlays the top of the list; the mount landing places the
  // entry ayah this far below the raw offset so it clears the header.
  const HEADER_OCCLUSION = t.spacing(16);
  // Bumped when the user picks a surah from the header. It's the FlatList's
  // `key`, so a jump remounts the list fresh: with the new window's target page
  // at data index 0, the remounted list starts at the very top (the surah's
  // first page). Remounting is what makes the jump reliable — scrolling a
  // still-mounted virtualized list to offset 0 while it re-lays-out a brand-new
  // variable-height window kept landing on the wrong place (it retained the old
  // scroll offset), so from mid-surah it never reached the new surah's start.
  const [listKey, setListKey] = useState(0);

  // Jump the reader to a specific verse — a surah's ayah 1 (Chapter tab) or a
  // juz's start ayah (Juz tab, almost never ayah 1 of a surah). Stops any
  // recitation, resolves the mushaf page containing that verse, and rebuilds
  // the render window so that page becomes data index 0. Bumping listKey
  // remounts the FlatList so it starts fresh at the top instead of retaining
  // the old mid-surah scroll offset; setting `landingTarget` drives the
  // measured-offset landing effect below to scroll to the verse itself, not
  // just the page's top (which may still show the tail of the PREVIOUS surah
  // when the target page opens mid-surah).
  const jumpTo = useCallback(async (surah: number, ayah: number = 1) => {
    void Haptics.selectionAsync();
    if (playingRef.current || playbackError) stopPlayback();
    setSelected(null);
    const page = await pageForAyah(surah, ayah, translationId, script);
    // Couldn't resolve (offline/uncached) — leave the reader where it was
    // rather than landing on mushaf page 1 under the wrong surah's header.
    if (page == null) return;
    const target = Math.max(1, Math.min(TOTAL_MUSHAF_PAGES, page));
    setPageAnchor(surah);
    setHeader({ page: target, surah });
    // Reset the scroll/landing bookkeeping so the remounted list's fresh state
    // (offset 0, target page at index 0) is consistent with our refs, and any
    // measurement left over from the previous landing target can't leak in.
    scrollOffsetRef.current = 0;
    pendingPrependRef.current = false;
    extendingRef.current = false;
    initialPageRef.current = target;
    headerPageRef.current = target;
    entryOffsetInCellRef.current = null;
    pageContentTopRef.current.clear();
    setLandingTarget({ page: target, surah, ayah });
    setRange({ start: target, end: Math.min(TOTAL_MUSHAF_PAGES, target + INITIAL_FORWARD) });
    setListKey(k => k + 1);
  }, [translationId, script, playbackError, stopPlayback]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const top = viewableItems.find(v => v.isViewable && typeof v.item === 'number');
      if (!top) return;
      const page = top.item as number;
      headerPageRef.current = page;
      // Note: landedRef is NOT set here. The mount effect owns it — it flips
      // landedRef once the entry-ayah nudge has settled.
      const first = firstAyahByPage.current.get(page);
      setHeader(h => (h.page === page && (first == null || h.surah === first.surah) ? h : { page, surah: first?.surah ?? h.surah }));
      if (first && page !== initialPageRef.current) {
        setPageAnchor(first.surah);
        onPositionChangeRef.current(first.surah, first.ayah);
      }
    },
  ).current;

  const headerMeta = getSurah(header.surah);

  // Subtle word-sync availability cue: only some reciters carry QUL word-timing
  // data. While a verse is actually sounding with none for its surah, hint that
  // per-word highlighting isn't available for this reciter (stable per surah, so
  // it doesn't flicker verse-to-verse). Suppressed when an error notice shows.
  const showWordSyncHint =
    !!playing && audioStatus.playing && !playbackError && !hasKaraokeSurah(reciterId, playing.surah);

  const favKey = selected ? `${selected.surah}:${selected.ayah}` : '';
  const isFav = !!favKey && favorites.includes(favKey);
  const isBkm = !!favKey && bookmarks.includes(favKey);
  // Tints the practice mic once the selected ayah has a recorded attempt, matching
  // the ayah-mode action bar. Falls back to (1,1) when nothing is selected so the
  // hook order stays stable; the value is only read while `selected` is set.
  const bestRecitationScore = useBestRecitationScore(selected?.surah ?? 1, selected?.ayah ?? 1);

  // Landing: whenever `landingTarget` changes — on mount (seeded from
  // `highlightAyah`) OR on a later in-reader jump (`jumpTo`, Chapter/Juz tab)
  // — its target page is already at data index 0 (mount: naturally; jump: via
  // the listKey remount above), so there's no page-level jump left to do. All
  // this does is scroll so the target ayah sits just under the sticky header.
  // scrollOffsetRef (declared above with the auto-scroll refs) mirrors the
  // live content offset so we can tell when we've already arrived.
  useEffect(() => {
    landedRef.current = false;
    // No precise verse target → the page top (index 0) is already correct.
    if (landingTarget.ayah == null) { landedRef.current = true; return; }
    let cancelled = false;
    // Scroll to the target ayah's ABSOLUTE content offset = its page cell's
    // top (layout.y) + the ayah's offset within that cell (measureLayout).
    // Both are content-space, so no window-coordinate/scroll math is needed —
    // this lands the verse reliably regardless of whether the page opens with
    // that verse or with the tail of a previous surah above it. Poll a few
    // passes because content assembles async and the measurements settle over
    // the first few hundred ms.
    const tick = () => {
      if (cancelled || landedRef.current) return;
      const cellTop = pageContentTopRef.current.get(landingTarget.page);
      if (cellTop == null) return; // page cell not laid out yet
      const inCell = entryOffsetInCellRef.current;
      // Prefer landing on the verse; fall back to the page top until the ayah's
      // in-cell offset has measured.
      const target = Math.max(0, cellTop + (inCell ?? 0) - HEADER_OCCLUSION);
      if (Math.abs(scrollOffsetRef.current - target) < 6) {
        // Only consider it landed once we actually have the ayah offset (else a
        // later pass still needs to refine from page-top to the verse).
        if (inCell != null) { landedRef.current = true; }
        return;
      }
      listRef.current?.scrollToOffset({ offset: target, animated: false });
    };
    const timers = [80, 250, 450, 700, 1000].map(ms => setTimeout(tick, ms));
    // Safety net: if the ayah never measures (e.g. odd layout), stop trying.
    const settle = setTimeout(() => { if (!cancelled) { landedRef.current = true; } }, 1400);
    return () => { cancelled = true; timers.forEach(clearTimeout); clearTimeout(settle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landingTarget]);

  return (
    // A slightly muted background (vs. the card's `surfaceElevated` fill)
    // gives each mushaf leaf real depth to sit against, instead of blending
    // into the flat reader background.
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      {contentUnavailable ? (
        // ONE unified offline/retry screen for the whole reader — mirrors
        // ayah mode's card (app/read/[surah].tsx) so a missing script/
        // translation download reads the same way in either mode. Retrying
        // downloads the whole edition (not just the one page that happened
        // to fail first), since every other page would hit the identical
        // failure otherwise.
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(3), paddingHorizontal: t.spacing(6) }}>
          <Ionicons name="cloud-offline-outline" size={40} color={t.colors.textMuted} />
          <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            {s.offlineTitle}
          </Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
            {s.offlineMessage}
          </Text>
          {downloadingScript ? (
            <View style={{ alignItems: 'center', gap: t.spacing(2), marginTop: t.spacing(1) }}>
              <ActivityIndicator color={t.accent.primary} />
              <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {s.scriptDownloading} {precache.loaded}/{precache.total}
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={retryDownload}
              hitSlop={8}
              style={{
                marginTop: t.spacing(1),
                paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(2.5),
                borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
              }}
            >
              <Text style={{ color: t.colors.brass, fontWeight: '700', fontSize: 14 }}>{s.offlineRetry}</Text>
            </Pressable>
          )}
        </View>
      ) : (
      <FlatList
        // Remounts on a surah jump so the list starts fresh at the top (the
        // picked surah's first page, placed at data index 0) rather than
        // retaining the previous mid-surah scroll offset.
        key={listKey}
        ref={listRef}
        data={data}
        keyExtractor={p => String(p)}
        // No getItemLayout: pages are variable-height, so FlatList measures them
        // naturally. The entry page is at data index 0, so it's already at the
        // top on mount — no jump, and the offset model stays consistent with the
        // real layout (which the old fake uniform layout broke).
        showsVerticalScrollIndicator={false}
        // Keep the first visible page pinned as earlier pages are prepended
        // above it. RN's built-in anchoring handles the multi-pass async
        // measurement of variable-height pages correctly (the old manual
        // single-delta compensation only fixed the first content-size change and
        // then drifted, throwing the view to a random page). minIndexForVisible:
        // 1 anchors to the first item BELOW index 0, so the mount landing's own
        // scroll (and the fresh top after a surah-jump remount) isn't fought.
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        // Append later pages as the user nears the bottom. Appending never
        // shifts the current scroll position, so forward scrolling stays smooth.
        onEndReachedThreshold={1.5}
        onEndReached={() => {
          const r = rangeRef.current;
          if (r.end < TOTAL_MUSHAF_PAGES) {
            setRange(prev => ({ ...prev, end: Math.min(TOTAL_MUSHAF_PAGES, prev.end + FORWARD_BATCH) }));
          }
        }}
        // Keep enough neighbouring pages mounted and render a couple per batch so
        // scrolling between spreads shows the next page already laid out instead
        // of a spinner flash. initialNumToRender covers the whole initial window
        // so the entry page + its lookahead are laid out together on mount.
        windowSize={9}
        initialNumToRender={INITIAL_FORWARD + 1}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        // Deliberately NOT removeClippedSubviews: it detaches/reattaches
        // native views as they scroll in and out, which can blank-flash or
        // drop a frame on reattach — a well-known source of flicker during
        // fast manual scrolling. Our own page-range windowing (see `range`
        // above) already keeps mounted pages to a small handful, so this
        // prop's memory/CPU saving is negligible here anyway, and under the
        // New Architecture Fabric already does its own view culling
        // regardless (RN's removeClippedSubviews isn't even honoured there),
        // so this legacy clipping was only adding risk with no benefit.
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          // The user has taken over. Abort the mount landing so a still-pending
          // corrective tick can't yank the view back and look like a jump.
          landedRef.current = true;
          // Mark the gesture active so playback-driven range appends are held
          // off until it settles (a mid-gesture append at the bottom is harmless,
          // but deferring keeps the visible page rock-steady while dragging).
          isScrollingRef.current = true;
          showPageIndicator();
        }}
        // Drag lifted (list may still coast) and momentum fully stopped: the
        // gesture is settling/settled, so it's safe to apply any playback append
        // that was deferred to keep the visible page steady while dragging.
        onScrollEndDrag={() => { isScrollingRef.current = false; flushPendingPlayPage(); scheduleHidePageIndicator(); }}
        onMomentumScrollBegin={() => { isScrollingRef.current = true; showPageIndicator(); }}
        onMomentumScrollEnd={() => { isScrollingRef.current = false; flushPendingPlayPage(); scheduleHidePageIndicator(); }}
        onScroll={e => {
          const y = e.nativeEvent.contentOffset.y;
          const prevY = scrollOffsetRef.current;
          scrollOffsetRef.current = y;
          // Prepend earlier pages only while the user is actively scrolling UP
          // toward the top (y decreasing). Gated on landing so we never prepend
          // mid-landing, and on upward direction so the first downward scroll
          // after landing doesn't needlessly extend. maintainVisibleContentPosition
          // keeps the visible page pinned as the pages insert above; pendingPrependRef
          // just holds off playback appends until the prepend settles; extendingRef
          // latches so a burst of events queues only one prepend.
          const r = rangeRef.current;
          const scrollingUp = y < prevY;
          if (landedRef.current && scrollingUp && !extendingRef.current && r.start > 1 && y < PREPEND_TRIGGER_PX) {
            extendingRef.current = true;
            pendingPrependRef.current = true;
            const newStart = Math.max(1, r.start - BACKWARD_BATCH);
            const pages = Array.from({ length: r.start - newStart }, (_, i) => newStart + i);
            // Prefetch every prepended page's content BEFORE it enters `range`
            // (see pageContentCache above) so each one's first paint already
            // has its real height — the fix for the reader jumping to a
            // random page after a surah switch + scroll up.
            void Promise.all(pages.map(p => loadPageContentCached(p, pageAnchor, translationId, script)))
              .catch(() => {})
              .then(() => setRange(prev => ({ ...prev, start: newStart })));
          }
        }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        contentContainerStyle={{ paddingTop: t.spacing(14), paddingBottom: t.spacing(28) }}
        renderItem={({ item }) => (
          <LazyPage
            page={item}
            anchorSurah={pageAnchor}
            arabicSize={arabicSize}
            selected={selected}
            entryHighlight={entryHighlight}
            playing={playing}
            // Only the page holding the reciting ayah gets the per-tick active
            // word; every other page passes null so they don't re-render on the
            // 100ms word-sync cadence.
            activeWord={item === playingPage ? activeWord : null}
            onSelectAyah={onSelectAyah}
            // Only the entry page measures the switch-in verse (for the mount
            // landing); the entry page renders it regardless of landing state so
            // a re-render mid-landing doesn't drop the measurement.
            entryAyah={landingTarget.ayah != null && item === landingTarget.page
              ? { surah: landingTarget.surah, ayah: landingTarget.ayah } : null}
            onEntryOffset={onEntryOffset}
            onCellLayout={onCellLayout}
            onLoaded={onPageLoaded}
            onLoadError={onLoadError}
            reloadToken={reloadToken}
          />
        )}
      />
      )}

      {/* Sticky header: always-visible surah + page indicator that tracks the
          top-most page as the reader scrolls. The surah title is a tappable pill
          that opens the surah picker; the play button and tajweed toggle sit on
          the right. The optional legend panel renders directly beneath it. */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        shadowColor: '#000', shadowOpacity: t.mode === 'dark' ? 0.35 : 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4,
      }}>
        <View style={{
          borderBottomWidth: showLegend ? 0 : 0.75, borderBottomColor: t.colors.hairline,
          overflow: 'hidden',
        }}>
          {/* Frosted glass on iOS (matches GlassDock's floating chrome
              elsewhere in the app); a solid tint fallback where BlurView
              renders inconsistently (Android) or isn't available. */}
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={70}
              tint={t.mode === 'dark' ? 'dark' : 'light'}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.background }} />
          )}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3),
            backgroundColor: Platform.OS === 'ios'
              ? (t.mode === 'dark' ? 'rgba(11,17,21,0.32)' : 'rgba(251,247,240,0.45)')
              : 'transparent',
          }}>
          <Pressable
            onPress={() => { void Haptics.selectionAsync(); setShowSurahPicker(true); }}
            accessibilityRole="button"
            accessibilityLabel={s.changeSurah}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
              alignSelf: 'flex-start',
              paddingLeft: t.spacing(3), paddingRight: t.spacing(2), paddingVertical: t.spacing(1.5),
              borderRadius: t.radius.pill,
              backgroundColor: pressed
                ? t.colors.brass + '22'
                : (t.mode === 'dark' ? 'rgba(209,162,74,0.10)' : 'rgba(176,134,65,0.08)'),
              borderWidth: 1, borderColor: t.colors.brass + '44',
            })}
          >
            <Text numberOfLines={1} style={{ color: t.colors.text, fontSize: 15, fontWeight: '800' }}>
              {headerMeta?.englishName}
            </Text>
            <Text numberOfLines={1} style={{ color: t.colors.brass, fontFamily: arabicFontFor('uthmani'), fontSize: 16 }}>
              {headerMeta?.name}
            </Text>
            <Ionicons name="chevron-down" size={14} color={t.colors.brass} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
            <Text pointerEvents="none" style={{ color: t.colors.textMuted, fontSize: 11, letterSpacing: 1, fontWeight: '700' }}>
              {s.pageLabel.toUpperCase()} {header.page}
            </Text>
            <Pressable
              hitSlop={10}
              onPress={togglePlayback}
              accessibilityLabel={playing || playbackError ? s.stopPageAudio : s.playPageAudio}
              style={{ padding: t.spacing(1) }}
            >
              {playing && !audioStatus.playing && !playbackError ? (
                <ActivityIndicator size="small" color={t.colors.brass} />
              ) : (
                <Ionicons
                  name={playing || playbackError ? 'stop-circle' : 'play-circle'}
                  size={24}
                  color={playing || playbackError ? t.colors.brass : t.accent.primary}
                />
              )}
            </Pressable>
            {isTajweed && (
              <Pressable
                hitSlop={10}
                onPress={() => { void Haptics.selectionAsync(); setShowLegend(v => !v); }}
                style={{ padding: t.spacing(1) }}
              >
                <Ionicons
                  name={showLegend ? 'color-palette' : 'color-palette-outline'}
                  size={20}
                  color={showLegend ? t.colors.brass : t.colors.textMuted}
                />
              </Pressable>
            )}
          </View>
          </View>
        </View>
        {isTajweed && showLegend && (
          <TajweedLegendPanel onClose={() => setShowLegend(false)} />
        )}
        {/* Continuous-play connectivity feedback: recitation streams, so a
            failed start is almost always offline. Shows an inline notice with a
            retry that replays the stalled verse. */}
        {playbackError && (
          <View style={{
            paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3),
            gap: t.spacing(2),
            backgroundColor: t.colors.background,
            borderBottomWidth: 0.75, borderBottomColor: t.colors.hairline,
          }}>
            <InlineNotice
              tone={playbackError === 'offline' ? 'warning' : 'danger'}
              icon={playbackError === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
              text={playbackError === 'offline' ? `${s.audioOfflineTitle} — ${s.audioOfflineMessage}` : s.audioError}
            />
            <Pressable
              onPress={retryPlayback}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
                borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: t.accent.primary, fontWeight: '700', fontSize: 13 }}>{s.reciteTryAgain}</Text>
            </Pressable>
          </View>
        )}
        {/* Subtle word-sync availability hint while reciting with no timing data. */}
        {showWordSyncHint && (
          <View pointerEvents="none" style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(1.5),
            paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(1.5),
            backgroundColor: t.colors.background,
            borderBottomWidth: 0.75, borderBottomColor: t.colors.hairline,
          }}>
            <Ionicons name="text-outline" size={12} color={t.colors.textMuted} />
            <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
              {s.wordSyncUnavailable}
            </Text>
          </View>
        )}
      </View>

      {/* Transient page-position indicator (Kindle/Apple-Books style): fades in
          while actively scrolling, fades out ~1s after the gesture settles.
          Gated on !selected so it never overlaps the ayah action sheet, which
          anchors the same bottom region. */}
      {!selected && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, right: 0,
            bottom: insets.bottom + t.spacing(6), alignItems: 'center',
            opacity: pageIndicatorOpacity,
            transform: [{ translateY: pageIndicatorOpacity.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          }}
        >
          <View style={{
            paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2),
            borderRadius: t.radius.pill,
            backgroundColor: t.colors.surfaceElevated,
            borderWidth: 0.75, borderColor: t.colors.hairline,
            shadowColor: '#000', shadowOpacity: t.mode === 'dark' ? 0.35 : 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
          }}>
            <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
              {s.pageLabel.toUpperCase()} {header.page} / {TOTAL_MUSHAF_PAGES}
            </Text>
          </View>
        </Animated.View>
      )}

      {selected && (
        <AyahActionSheet bottom={Math.max(t.spacing(6), insets.bottom + t.spacing(2))}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: t.colors.brass, fontSize: 11, letterSpacing: 1, fontWeight: '700' }}>
              {getSurah(selected.surah)?.englishName?.toUpperCase()} · {toArabicDigits(selected.ayah)}
            </Text>
            <Pressable hitSlop={10} onPress={() => setSelected(null)}>
              <Ionicons name="close" size={20} color={t.colors.textMuted} />
            </Pressable>
          </View>
          <VerseAudioListen surah={selected.surah} ayah={selected.ayah} reciterId={reciterId} onPlaybackStart={stopPlayback} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
            <Pressable
              hitSlop={10}
              onPress={() => {
                void Haptics.selectionAsync();
                router.push(`/recite/${selected.surah}?ayah=${selected.ayah}`);
              }}
            >
              <Ionicons
                name={bestRecitationScore != null ? 'mic' : 'mic-outline'}
                size={24}
                color={bestRecitationScore != null ? t.accent.primary : t.colors.textMuted}
              />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => onOpenTefseer(selected.surah, selected.ayah)}>
              <Ionicons name="book-outline" size={24} color={t.colors.textMuted} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => toggleFavorite(selected.surah, selected.ayah)}>
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={isFav ? t.colors.danger : t.colors.textMuted} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => toggleBookmark(selected.surah, selected.ayah)}>
              <Ionicons name={isBkm ? 'bookmark' : 'bookmark-outline'} size={24} color={isBkm ? t.accent.primary : t.colors.textMuted} />
            </Pressable>
          </View>
        </AyahActionSheet>
      )}

      <SurahPickerSheet
        visible={showSurahPicker}
        selectedSurah={header.surah}
        onClose={() => setShowSurahPicker(false)}
        onSelectSurah={n => { void jumpTo(n, 1); }}
        onSelectJuz={j => {
          const start = JUZ_STARTS[j - 1];
          if (start) void jumpTo(start.surah, start.ayah);
        }}
      />
    </View>
  );
}
