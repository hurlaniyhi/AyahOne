import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, FlatList, Platform,
  type ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useTheme, type Theme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { getSurah } from '@/data/surahs';
import { getPageContent, pageForAyah, TOTAL_MUSHAF_PAGES, type PageAyah, type PageContent } from '@/data/mushafPages';
import { getAyahAudioUrl, isOfflineError } from '@/data/quranAudio';
import { getKaraokeAyahData, hasKaraokeSurah, type KaraokeAyahData } from '@/data/hifzKaraoke';
import { activeWordIndex } from '@/lib/hifzKaraoke';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor, isQuranWordToken, stripBismillahPrefix, toArabicDigits } from '@/lib/quranText';
import { parseTajweedForRender, stripTajweed, TAJWEED_COLORS, TAJWEED_LABELS, TAJWEED_LEGEND_ORDER } from '@/lib/tajweed';
import { VerseAudioListen } from '@/components/VerseAudioListen';
import { InlineNotice } from '@/components/InlineNotice';

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
  return (
    <View style={{
      backgroundColor: t.colors.surfaceElevated,
      borderBottomWidth: 0.75, borderBottomColor: t.colors.hairline,
      paddingHorizontal: t.spacing(4), paddingTop: t.spacing(3), paddingBottom: t.spacing(3),
    }}>
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
    </View>
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

// Ornamental surah header shown when a surah begins on the page. A framed
// brass plate keeps the mushaf feel and clearly separates surahs mid-page.
function SurahPlate({ surah }: { surah: number }) {
  const t = useTheme();
  const meta = getSurah(surah);
  const font = arabicFontFor('uthmani');
  return (
    <View style={{
      alignItems: 'center', gap: t.spacing(1),
      marginVertical: t.spacing(1),
      paddingVertical: t.spacing(3), paddingHorizontal: t.spacing(4),
      borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.brass + '55',
      backgroundColor: t.mode === 'dark' ? 'rgba(209,162,74,0.06)' : 'rgba(176,134,65,0.05)',
    }}>
      <Text style={{ color: t.colors.text, fontFamily: font, fontSize: 26, textAlign: 'center' }}>
        {meta?.name}
      </Text>
      <Text style={{ color: t.colors.brass, fontSize: 10, letterSpacing: 2, fontWeight: '700' }}>
        {String(surah).padStart(3, '0')} · {meta?.englishName?.toUpperCase()}
      </Text>
    </View>
  );
}

// Renders a single assembled mushaf page as continuous justified Arabic text.
// Each ayah is a tappable inline segment; the selected ayah is highlighted and
// surfaces an action bar (handled by the parent via onSelect).
function PageView({
  content, arabicSize, selected, playing, activeWord, onSelectAyah, entryAyah, onEntryOffset, cellRef, isLast,
}: {
  content: PageContent;
  arabicSize: number;
  selected: { surah: number; ayah: number } | null;
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
  isLast: boolean;
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

  // Measure the entry ayah's offset WITHIN its page cell so the parent's mount
  // landing can scroll to the verse itself. measureLayout against the cell node
  // is reliable for inline nested <Text> (measureInWindow is not). Only wired
  // for the ayah the user switched in on.
  const entryRef = useRef<Text>(null);
  const measureEntry = useCallback(() => {
    const node = cellRef.current;
    if (!onEntryOffset || !entryRef.current || !node) return;
    entryRef.current.measureLayout(node, (_x: number, y: number) => onEntryOffset(y), () => {});
  }, [onEntryOffset, cellRef]);

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

  return (
    <View style={{ paddingHorizontal: t.spacing(5), paddingTop: t.spacing(3), gap: t.spacing(3) }}>
      {groups.map(group => {
        const showBismillah = group.ayahs[0]?.numberInSurah === 1 && group.surah !== 1 && group.surah !== 9;
        return (
          <View key={group.surah} style={{ gap: t.spacing(2) }}>
            {group.ayahs[0]?.numberInSurah === 1 && <SurahPlate surah={group.surah} />}
            {showBismillah && (
              <Text style={{ color: t.colors.brass, fontFamily: arabicFontFor('uthmani'), fontSize: arabicSize * 0.8, textAlign: 'center', lineHeight, marginBottom: t.spacing(1) }}>
                {BISMILLAH}
              </Text>
            )}
            <Text
              allowFontScaling={false}
              textBreakStrategy="simple"
              style={{
                textAlign: Platform.OS === 'ios' ? 'justify' : 'right',
                writingDirection: 'rtl', lineHeight, color: t.colors.text,
              }}
            >
              {group.ayahs.map(a => {
                const isSel = selected?.surah === a.surah && selected?.ayah === a.numberInSurah;
                const isPlaying = playing?.surah === a.surah && playing?.ayah === a.numberInSurah;
                const isEntry = entryAyah?.surah === a.surah && entryAyah?.ayah === a.numberInSurah;
                // Word-sync only on the reciting ayah and only when we have a
                // resolved active word; otherwise fall back to the normal
                // (tajweed-coloured or plain) render.
                const wordSynced = isPlaying && activeWord != null;
                return (
                  <Text
                    key={a.numberInSurah}
                    ref={isEntry ? entryRef : undefined}
                    onLayout={isEntry ? measureEntry : undefined}
                    onPress={() => onSelectAyah(a)}
                    suppressHighlighting
                    style={{
                      color: t.colors.text,
                      fontFamily: font,
                      fontSize: arabicSize,
                      lineHeight,
                      backgroundColor: isPlaying ? playHl : isSel ? hl : 'transparent',
                    }}
                  >
                    {wordSynced
                      ? renderWordSynced(a, font, arabicSize, activeWord, wordHl)
                      : renderArabic(a, isTajweed, font, arabicSize)}
                    <Text style={{ color: t.colors.brass, fontFamily: font, fontSize: arabicSize }}>
                      {' \u06DD'}{toArabicDigits(a.numberInSurah)}{' '}
                    </Text>
                  </Text>
                );
              })}
            </Text>
          </View>
        );
      })}
      {/* End-of-page marker: a centred page number framed by ornamental
          hairlines, plus a thicker divider (unless this is the final page) that
          clearly separates one mushaf spread from the next as the reader
          scrolls the continuous page stream. */}
      <View style={{ alignItems: 'center', marginTop: t.spacing(4), gap: t.spacing(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3), alignSelf: 'stretch' }}>
          <View style={{ flex: 1, height: 0.75, backgroundColor: t.colors.hairline }} />
          <View style={{
            minWidth: 40, paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1),
            borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.brass + '55',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700' }}>
              {content.page}
            </Text>
          </View>
          <View style={{ flex: 1, height: 0.75, backgroundColor: t.colors.hairline }} />
        </View>
        <Text style={{ color: t.colors.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '600' }}>
          {s.pageLabel.toUpperCase()} {content.page} / {TOTAL_MUSHAF_PAGES}
        </Text>
      </View>
      {!isLast && (
        <View style={{ height: t.spacing(2.5), backgroundColor: t.colors.surfaceMuted, marginTop: t.spacing(3) }} />
      )}
    </View>
  );
}

// Lightweight per-page loader: assembles a page's contents on demand and caches
// them in component state. Renders a spinner until the async assembly resolves.
// Memoised so the 100ms word-sync ticks (which re-render the parent) only touch
// the page actually holding the reciting ayah — every other mounted page sees
// identical props and bails out of re-rendering.
const LazyPage = React.memo(function LazyPage({
  page, anchorSurah, arabicSize, selected, playing, activeWord, onSelectAyah, entryAyah, onEntryOffset, onCellLayout, onLoaded, isLast,
}: {
  page: number;
  anchorSurah: number;
  arabicSize: number;
  selected: { surah: number; ayah: number } | null;
  playing: { surah: number; ayah: number } | null;
  activeWord: number | null;
  onSelectAyah: (a: PageAyah) => void;
  // Forwarded to PageView so the entry ayah reports its offset within this cell.
  entryAyah?: { surah: number; ayah: number } | null;
  onEntryOffset?: (offsetInCell: number) => void;
  // Reports this cell's content-space top (layout.y within the list content) so
  // the parent's landing can resolve the entry ayah's absolute offset (cell top
  // + ayah offset within the cell) and the page-top fallback.
  onCellLayout?: (page: number, y: number) => void;
  onLoaded?: (content: PageContent) => void;
  isLast: boolean;
}) {
  const t = useTheme();
  const translationId = useAppStore(st => st.settings.translationId);
  const script = useAppStore(st => st.settings.arabicScript);
  const [content, setContent] = useState<PageContent | null>(null);

  useEffect(() => {
    let alive = true;
    setContent(null);
    getPageContent(page, anchorSurah, translationId, script)
      .then(c => { if (alive) { setContent(c); onLoaded?.(c); } })
      .catch(() => { if (alive) setContent({ page, ayahs: [], surahs: [] }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, translationId, script]);

  const cellRef = useRef<View>(null);
  const body = !content ? (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: t.spacing(24) }}>
      <ActivityIndicator size="large" color={t.accent.primary} />
    </View>
  ) : (
    <PageView content={content} arabicSize={arabicSize} selected={selected} playing={playing} activeWord={activeWord} onSelectAyah={onSelectAyah} entryAyah={entryAyah} onEntryOffset={onEntryOffset} cellRef={cellRef} isLast={isLast} />
  );
  return (
    <View
      ref={cellRef}
      onLayout={e => {
        // Report the cell's content-space top (layout.y is relative to the list
        // content), so the parent can place the page and resolve the entry
        // ayah's absolute offset without any window-coordinate conversion.
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
  const arabicSize = useAppStore(st => st.settings.arabicFontSize);
  const reciterId = useAppStore(st => st.settings.reciterId);
  const favorites = useAppStore(st => st.favorites);
  const bookmarks = useAppStore(st => st.bookmarks);
  const toggleFavorite = useAppStore(st => st.toggleFavorite);
  const toggleBookmark = useAppStore(st => st.toggleBookmark);
  const isTajweed = useAppStore(st => st.settings.arabicScript) === 'tajweed';
  const listRef = useRef<FlatList<number>>(null);

  // Collapsible tajweed colour guide, only offered while the tajweed script is
  // active. Closed by default so it never intrudes on the reading surface.
  const [showLegend, setShowLegend] = useState(false);

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
  // range actually changes.
  const extendingRef = useRef(false);
  useEffect(() => { extendingRef.current = false; }, [range.start, range.end]);
  // Live mirror of the range so inline handlers (onScroll) read fresh bounds.
  const rangeRef = useRef(range);
  rangeRef.current = range;
  // Manual prepend compensation (instead of maintainVisibleContentPosition,
  // which caused a jump on the first scroll after the mount landing). When we
  // prepend earlier pages, the content grows above the viewport; we remember the
  // content height at prepend time and, once onContentSizeChange reports the new
  // (taller) height, shift the scroll offset by the delta so the visible page
  // stays exactly where it was — no jump.
  const contentHeightRef = useRef(0);
  const pendingPrependRef = useRef(false);

  // Selected ayah drives the highlight + action bar. Seed from the entry
  // highlight so the user's ayah-mode position stays visible on switch.
  const [selected, setSelected] = useState<{ surah: number; ayah: number } | null>(
    highlightAyah ?? null,
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
    setActiveWord(null);
    setPlaybackError(null);
    retryAyahRef.current = { surah, ayah };
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
      // Track which page holds the reciting ayah (drives the highlight + which
      // page receives word-sync). No auto-scroll: the view stays where the user
      // left it while recitation plays.
      setPlayingPage(page ?? null);
      playingPageRef.current = page ?? null;
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

  // Offline watchdog for a URL that resolved from cache before going offline:
  // getAyahAudioUrl succeeds, so playAyah reaches playback, but expo-audio
  // silently can't fetch the remote mp3 and play() never throws — the button
  // would spin forever. If the source hasn't loaded or started after a grace
  // period, surface it as offline. Mirrors VerseAudioListen's watchdog.
  useEffect(() => {
    if (!audioUrl || !playing) return;
    if (audioStatus.isLoaded || audioStatus.playing) return;
    const id = setTimeout(() => {
      if (!audioStatus.isLoaded && !audioStatus.playing) {
        try { audioPlayer.pause(); } catch {}
        setAudioUrl(null);
        setKaraoke(null);
        setPlayingPage(null);
        playingPageRef.current = null;
        setActiveWord(null);
        setPlaybackError('offline');
      }
    }, 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, playing, audioStatus.isLoaded, audioStatus.playing]);

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
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const top = viewableItems.find(v => v.isViewable);
      if (!top || typeof top.item !== 'number') return;
      const page = top.item;
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

  // Landing: the entry page is at data index 0, so it's already at the top of
  // the content on mount — no page-level jump at all. All we do is scroll so the
  // entry ayah (e.g. 2:183) sits just under the sticky header. scrollOffsetRef
  // mirrors the live content offset (from onScroll) so we can tell when we've
  // already arrived.
  const scrollOffsetRef = useRef(0);
  const HEADER_OCCLUSION = t.spacing(16);

  useEffect(() => {
    landedRef.current = false;
    // No entry ayah → the page top (index 0) is already the right place.
    if (!highlightAyah) { landedRef.current = true; return; }
    let cancelled = false;
    // Scroll to the entry ayah's ABSOLUTE content offset = its page cell's top
    // (layout.y) + the ayah's offset within that cell (measureLayout). Both are
    // content-space, so no window-coordinate/scroll math is needed — this lands
    // the verse reliably. Poll a few passes because content assembles async and
    // the measurements settle over the first few hundred ms.
    const tick = () => {
      if (cancelled || landedRef.current) return;
      const cellTop = pageContentTopRef.current.get(clampedInitial);
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
  }, [clampedInitial, highlightAyah]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={p => String(p)}
        // No getItemLayout: pages are variable-height, so FlatList measures them
        // naturally. The entry page is at data index 0, so it's already at the
        // top on mount — no jump, and the offset model stays consistent with the
        // real layout (which the old fake uniform layout broke).
        showsVerticalScrollIndicator={false}
        // Keep the visible page anchored when earlier pages are prepended by
        // compensating the scroll offset manually (see pendingPrependRef). This
        // replaces maintainVisibleContentPosition, which caused a jump on the
        // first scroll after the mount landing.
        onContentSizeChange={(_w, h) => {
          const prev = contentHeightRef.current;
          contentHeightRef.current = h;
          if (pendingPrependRef.current) {
            pendingPrependRef.current = false;
            const delta = h - prev;
            // Shift down by the height the prepended pages added so the page the
            // user was viewing stays put instead of jumping up.
            if (delta > 0) {
              const offset = scrollOffsetRef.current + delta;
              scrollOffsetRef.current = offset;
              listRef.current?.scrollToOffset({ offset, animated: false });
            }
          }
        }}
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
        removeClippedSubviews
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          // The user has taken over. Abort the mount landing so a still-pending
          // corrective tick can't yank the view back and look like a jump.
          landedRef.current = true;
        }}
        onScroll={e => {
          const y = e.nativeEvent.contentOffset.y;
          const prevY = scrollOffsetRef.current;
          scrollOffsetRef.current = y;
          // Prepend earlier pages only while the user is actively scrolling UP
          // toward the top (y decreasing). Gated on landing so we never prepend
          // mid-landing, and on upward direction so the first downward scroll
          // after landing can't trigger a compensating shift. pendingPrependRef
          // tells the next onContentSizeChange to compensate the offset;
          // extendingRef latches so a burst of events queues only one prepend.
          const r = rangeRef.current;
          const scrollingUp = y < prevY;
          if (landedRef.current && scrollingUp && !extendingRef.current && r.start > 1 && y < PREPEND_TRIGGER_PX) {
            extendingRef.current = true;
            pendingPrependRef.current = true;
            setRange(prev => ({ ...prev, start: Math.max(1, prev.start - BACKWARD_BATCH) }));
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
            playing={playing}
            // Only the page holding the reciting ayah gets the per-tick active
            // word; every other page passes null so they don't re-render on the
            // 100ms word-sync cadence.
            activeWord={item === playingPage ? activeWord : null}
            onSelectAyah={onSelectAyah}
            // Only the entry page measures the switch-in verse (for the mount
            // landing); the entry page renders it regardless of landing state so
            // a re-render mid-landing doesn't drop the measurement.
            entryAyah={item === clampedInitial ? highlightAyah : null}
            onEntryOffset={onEntryOffset}
            onCellLayout={onCellLayout}
            onLoaded={onPageLoaded}
            isLast={item === TOTAL_MUSHAF_PAGES}
          />
        )}
      />

      {/* Sticky header: always-visible surah + page indicator that tracks the
          top-most page as the reader scrolls. The header text is
          non-interactive so it never intercepts scroll; the tajweed toggle is a
          separate Pressable overlaid on top. The optional legend panel renders
          directly beneath it. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3),
          backgroundColor: t.colors.background,
          borderBottomWidth: showLegend ? 0 : 0.75, borderBottomColor: t.colors.hairline,
        }}>
          <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), flex: 1 }}>
            <Text style={{ color: t.colors.text, fontSize: 15, fontWeight: '800' }}>
              {headerMeta?.englishName}
            </Text>
            <Text style={{ color: t.colors.brass, fontFamily: arabicFontFor('uthmani'), fontSize: 16 }}>
              {headerMeta?.name}
            </Text>
          </View>
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

      {selected && (
        <View style={{
          position: 'absolute', left: t.spacing(4), right: t.spacing(4), bottom: t.spacing(6),
          gap: t.spacing(3),
          backgroundColor: t.colors.surfaceElevated, borderRadius: t.radius.xl,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          paddingVertical: t.spacing(3), paddingHorizontal: t.spacing(4),
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
        }}>
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
        </View>
      )}
    </View>
  );
}
