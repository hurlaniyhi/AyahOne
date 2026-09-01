import { getSurahContent, type Ayah, type ArabicScriptId, type SurahContent } from './quranApi';
import { getSurah } from './surahs';

// A single ayah on a mushaf page, tagged with its owning surah so a page that
// spans a surah boundary can still address each ayah unambiguously.
export interface PageAyah extends Ayah {
  surah: number;
}

// The assembled contents of one Madinah-mushaf page (1..604). `surahs` lists,
// in order, every surah that has at least one ayah on the page — used to render
// surah headers/Bismillah when a new surah begins mid-page.
export interface PageContent {
  page: number;
  ayahs: PageAyah[];
  surahs: number[];
}

const LAST_SURAH = 114;

// Fetches a surah's content, swallowing out-of-range indices and load failures
// (offline with a partial cache) into null. The outward page walk relies on
// this: a surah that can't be loaded is simply treated as absent from the page
// rather than aborting the whole assembly. `onResult` fires for every attempt
// actually made (never for the out-of-range early-return, which is expected,
// not an attempt) so callers can tell "not on this page" apart from "we don't
// actually know, because the fetch failed": a single failed neighbour probed
// while walking outward is normal (that's how a gap is detected) and must
// stay silent, but if NOTHING in the whole assembly ever loaded successfully,
// that's the whole edition being unavailable and must surface as a retryable
// error rather than silently rendering as an empty page — see getPageContent.
async function safeSurahContent(
  surah: number,
  translation?: string,
  script?: ArabicScriptId,
  onResult?: (ok: boolean) => void,
): Promise<SurahContent | null> {
  if (surah < 1 || surah > LAST_SURAH) return null;
  try {
    const content = await getSurahContent(surah, translation, script);
    onResult?.(true);
    return content;
  } catch {
    onResult?.(false);
    return null;
  }
}

// Resolve the mushaf page a given ayah sits on. Returns null if the page field
// is missing (legacy cached payloads) or the surah can't be loaded, so callers
// can fall back gracefully.
export async function pageForAyah(
  surah: number,
  ayah: number,
  translation?: string,
  script?: ArabicScriptId,
): Promise<number | null> {
  const content = await safeSurahContent(surah, translation, script);
  const match = content?.ayahs.find(a => a.numberInSurah === ayah);
  return match?.page ?? null;
}

// Pull just the ayahs of `surah` that belong to `page`, tagged with the surah.
async function ayahsOnPageIn(
  surah: number,
  page: number,
  translation?: string,
  script?: ArabicScriptId,
  onResult?: (ok: boolean) => void,
): Promise<PageAyah[]> {
  const content = await safeSurahContent(surah, translation, script, onResult);
  if (!content) return [];
  return content.ayahs
    .filter(a => a.page === page)
    .map(a => ({ ...a, surah }));
}

// Whether the surah has any ayah on the page without paying for a second fetch:
// getSurahContent is memory-cached, so re-reading is cheap.
async function surahTouchesPage(
  surah: number,
  page: number,
  translation?: string,
  script?: ArabicScriptId,
  onResult?: (ok: boolean) => void,
): Promise<boolean> {
  const content = await safeSurahContent(surah, translation, script, onResult);
  return !!content && content.ayahs.some(a => a.page === page);
}

// Assemble every ayah on `page`, spanning surah boundaries. `nearSurah` is a
// hint (typically the surah the reader is currently in) used as the search
// anchor; the assembler walks outward from it so no global page->surah table is
// required. Ayahs come back in mushaf order (ascending surah, then ayah).
export async function getPageContent(
  page: number,
  nearSurah: number,
  translation?: string,
  script?: ArabicScriptId,
): Promise<PageContent> {
  const anchor = Math.max(1, Math.min(LAST_SURAH, nearSurah));
  // Tracks whether ANYTHING in this assembly loaded successfully, alongside
  // whether anything failed. A single failed neighbour while walking outward
  // is normal — that's exactly how a gap between surahs is detected — so
  // `loadFailed` alone can't tell "this page/edition is unavailable" apart
  // from "this page legitimately has no content and we walked through some
  // gaps finding that out" (e.g. an out-of-range page number): both look
  // identical, a mix of successes-that-don't-match and failures. Only when
  // NOTHING ever loaded (loadFailed but not loadSucceeded) is the edition
  // itself unavailable — that must reject instead of resolving to a silent
  // blank page, so the reader can show a retry rather than an empty leaf.
  let loadFailed = false;
  let loadSucceeded = false;
  const onResult = (ok: boolean) => { if (ok) loadSucceeded = true; else loadFailed = true; };

  // Find a surah known to be on the page: try the hint, else scan outward. A
  // page never spans more than a couple of surahs, so this stays cheap.
  let seed = (await surahTouchesPage(anchor, page, translation, script, onResult)) ? anchor : 0;
  for (let d = 1; !seed && d <= LAST_SURAH; d++) {
    if (await surahTouchesPage(anchor - d, page, translation, script, onResult)) seed = anchor - d;
    else if (await surahTouchesPage(anchor + d, page, translation, script, onResult)) seed = anchor + d;
  }
  if (!seed) {
    if (loadFailed && !loadSucceeded) throw new Error('Failed to load Quran content for this page.');
    return { page, ayahs: [], surahs: [] };
  }

  const collected: PageAyah[] = await ayahsOnPageIn(seed, page, translation, script, onResult);

  // Extend backward: an earlier surah contributes only if its LAST ayah is on
  // this page (i.e. the page opened mid-surah before `seed`). A gap (surah that
  // can't be loaded) stops the walk so a far-away surah sharing the page number
  // is never vacuumed in.
  for (let s = seed - 1; s >= 1; s--) {
    const meta = getSurah(s);
    const content = await safeSurahContent(s, translation, script, onResult);
    const last = content?.ayahs[content.ayahs.length - 1];
    if (meta && content && last && last.page === page) {
      const prev = content.ayahs.filter(a => a.page === page).map(a => ({ ...a, surah: s }));
      collected.unshift(...prev);
    } else break;
  }

  // Extend forward: a later surah contributes only if its FIRST ayah is on this
  // page (the page continues into the next surah after `seed`).
  for (let s = seed + 1; s <= LAST_SURAH; s++) {
    const content = await safeSurahContent(s, translation, script, onResult);
    const first = content?.ayahs[0];
    if (content && first && first.page === page) {
      const next = content.ayahs.filter(a => a.page === page).map(a => ({ ...a, surah: s }));
      collected.push(...next);
    } else break;
  }

  if (collected.length === 0 && loadFailed && !loadSucceeded) {
    throw new Error('Failed to load Quran content for this page.');
  }

  collected.sort((a, b) => (a.surah - b.surah) || (a.numberInSurah - b.numberInSurah));
  const surahs = Array.from(new Set(collected.map(a => a.surah)));
  return { page, ayahs: collected, surahs };
}

// Total pages in the standard Madinah mushaf.
export const TOTAL_MUSHAF_PAGES = 604;
