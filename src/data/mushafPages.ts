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
// rather than aborting the whole assembly. `onError` fires only for a genuine
// load failure (never for the out-of-range early-return, which is expected,
// not an error) so callers can tell "not on this page" apart from "we don't
// actually know, because the fetch failed" — the latter must surface as a
// retryable error rather than silently rendering as an empty/partial page.
async function safeSurahContent(
  surah: number,
  translation?: string,
  script?: ArabicScriptId,
  onError?: () => void,
): Promise<SurahContent | null> {
  if (surah < 1 || surah > LAST_SURAH) return null;
  try {
    return await getSurahContent(surah, translation, script);
  } catch {
    onError?.();
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
  onError?: () => void,
): Promise<PageAyah[]> {
  const content = await safeSurahContent(surah, translation, script, onError);
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
  onError?: () => void,
): Promise<boolean> {
  const content = await safeSurahContent(surah, translation, script, onError);
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
  // Set the moment any surah touched by this assembly fails to load (as
  // opposed to legitimately not being on this page — see safeSurahContent).
  // A page that comes back with no ayahs BECAUSE of that (rather than because
  // it genuinely has none) must reject instead of resolving to a silent blank
  // page, so the reader can show a retry instead of an empty mushaf leaf.
  let loadFailed = false;
  const onError = () => { loadFailed = true; };

  // Find a surah known to be on the page: try the hint, else scan outward. A
  // page never spans more than a couple of surahs, so this stays cheap.
  let seed = (await surahTouchesPage(anchor, page, translation, script, onError)) ? anchor : 0;
  for (let d = 1; !seed && d <= LAST_SURAH; d++) {
    if (await surahTouchesPage(anchor - d, page, translation, script, onError)) seed = anchor - d;
    else if (await surahTouchesPage(anchor + d, page, translation, script, onError)) seed = anchor + d;
  }
  if (!seed) {
    if (loadFailed) throw new Error('Failed to load Quran content for this page.');
    return { page, ayahs: [], surahs: [] };
  }

  const collected: PageAyah[] = await ayahsOnPageIn(seed, page, translation, script, onError);

  // Extend backward: an earlier surah contributes only if its LAST ayah is on
  // this page (i.e. the page opened mid-surah before `seed`). A gap (surah that
  // can't be loaded) stops the walk so a far-away surah sharing the page number
  // is never vacuumed in.
  for (let s = seed - 1; s >= 1; s--) {
    const meta = getSurah(s);
    const content = await safeSurahContent(s, translation, script, onError);
    const last = content?.ayahs[content.ayahs.length - 1];
    if (meta && content && last && last.page === page) {
      const prev = content.ayahs.filter(a => a.page === page).map(a => ({ ...a, surah: s }));
      collected.unshift(...prev);
    } else break;
  }

  // Extend forward: a later surah contributes only if its FIRST ayah is on this
  // page (the page continues into the next surah after `seed`).
  for (let s = seed + 1; s <= LAST_SURAH; s++) {
    const content = await safeSurahContent(s, translation, script, onError);
    const first = content?.ayahs[0];
    if (content && first && first.page === page) {
      const next = content.ayahs.filter(a => a.page === page).map(a => ({ ...a, surah: s }));
      collected.push(...next);
    } else break;
  }

  if (collected.length === 0 && loadFailed) {
    throw new Error('Failed to load Quran content for this page.');
  }

  collected.sort((a, b) => (a.surah - b.surah) || (a.numberInSurah - b.numberInSurah));
  const surahs = Array.from(new Set(collected.map(a => a.surah)));
  return { page, ayahs: collected, surahs };
}

// Total pages in the standard Madinah mushaf.
export const TOTAL_MUSHAF_PAGES = 604;
