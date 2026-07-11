import AsyncStorage from '@react-native-async-storage/async-storage';
import { FALLBACK } from './fallback';
import { OFFLINE_QURAN_MODULES } from './offlineQuranManifest';
import { stripTajweed } from '@/lib/tajweed';

export interface Ayah {
  numberInSurah: number;
  arabic: string;
  translation: string;
  transliteration: string;
  // Madinah-mushaf page (1..604). Optional because legacy cached payloads
  // saved before v2 of the cache schema do not include it.
  page?: number;
}

export interface SurahContent {
  number: number;
  ayahs: Ayah[];
}

// alquran.cloud editions:
//   - quran-uthmani: Arabic (Uthmani script)
//   - quran-indopak: Arabic (IndoPak / South-Asian script)
//   - quran-tajweed: Uthmani text wrapped in bracket-tagged tajweed rules
//   - en.sahih: English (Saheeh International) translation
//   - en.transliteration: Latin-script transliteration
export type ArabicScriptId = 'uthmani' | 'indopak' | 'tajweed';
const ARABIC_EDITIONS: Record<ArabicScriptId, string> = {
  uthmani: 'quran-uthmani',
  indopak: 'quran-indopak',
  tajweed: 'quran-tajweed',
};
const DEFAULT_SCRIPT: ArabicScriptId = 'uthmani';
const DEFAULT_TRANSLATION = 'en.sahih';
const TRANSLITERATION_EDITION = 'en.transliteration';
// Cache versioned so payloads that pre-date the `page` field on Ayah are
// transparently discarded and refetched, rather than serving stale data that
// would never let the pages-read counter increment.
const PRECACHE_FLAG_PREFIX = 'surah:v2:precached:';

const CACHE_PREFIX = 'surah:v2:';
const memCache = new Map<string, SurahContent>();

// Default script (uthmani) keeps the legacy 3-segment key shape so previously
// stored data and existing tests remain valid. Non-default scripts append a
// 4th segment so the same translation can coexist across multiple scripts.
function cacheKey(surah: number, translation: string, script: ArabicScriptId = DEFAULT_SCRIPT): string {
  return script === DEFAULT_SCRIPT
    ? `${CACHE_PREFIX}${surah}:${translation}`
    : `${CACHE_PREFIX}${surah}:${translation}:${script}`;
}

function flagKey(translation: string, script: ArabicScriptId = DEFAULT_SCRIPT): string {
  return script === DEFAULT_SCRIPT
    ? `${PRECACHE_FLAG_PREFIX}${translation}`
    : `${PRECACHE_FLAG_PREFIX}${translation}:${script}`;
}

async function loadFromStorage(key: string): Promise<SurahContent | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SurahContent) : null;
  } catch {
    return null;
  }
}

async function saveToStorage(key: string, data: SurahContent): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore persistence failures; the in-memory cache still applies.
  }
}

// The app ships the DEFAULT combo (Uthmani + Saheeh International + Latin
// transliteration) for all 114 surahs via offlineQuranManifest, so first-time
// users can read the whole Qur'an with no network. Only that exact combo is
// bundled; any other script/translation stays download-on-demand. The manifest
// require()s each surah lazily, so a lookup only pulls the one JSON into memory.
function loadBundled(surah: number, translation: string, script: ArabicScriptId): SurahContent | null {
  if (translation !== DEFAULT_TRANSLATION || script !== DEFAULT_SCRIPT) return null;
  const load = OFFLINE_QURAN_MODULES[surah];
  if (!load) return null;
  try {
    return load();
  } catch {
    return null;
  }
}

interface AyahPayload {
  text: string;
  page?: number;
}

async function fetchEdition(surah: number, edition: string): Promise<AyahPayload[]> {
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/${edition}`);
  if (!res.ok) throw new Error(`Failed to fetch surah ${surah} (${edition}): ${res.status}`);
  const json = await res.json();
  const ayahs = json?.data?.ayahs as Array<{ text: string; page?: number }> | undefined;
  if (!ayahs) throw new Error('Malformed surah payload');
  return ayahs.map(a => ({ text: a.text, page: a.page }));
}

export async function getSurahContent(
  surah: number,
  translation: string = DEFAULT_TRANSLATION,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): Promise<SurahContent> {
  const key = cacheKey(surah, translation, script);
  const cached = memCache.get(key);
  if (cached) return cached;

  const stored = await loadFromStorage(key);
  if (stored) {
    memCache.set(key, stored);
    return stored;
  }

  // Serve the bundled default combo before hitting the network so first-time /
  // offline users read instantly. A previously downloaded copy (found above in
  // storage) still wins; anything past this point is a non-bundled combo or a
  // refresh once online.
  const bundled = loadBundled(surah, translation, script);
  if (bundled) {
    memCache.set(key, bundled);
    return bundled;
  }

  try {
    const [arabic, trans, translit] = await Promise.all([
      fetchEdition(surah, ARABIC_EDITIONS[script]),
      fetchEdition(surah, translation),
      fetchEdition(surah, TRANSLITERATION_EDITION),
    ]);
    const ayahs: Ayah[] = arabic.map((ar, i) => ({
      numberInSurah: i + 1,
      arabic: ar.text,
      translation: trans[i]?.text ?? '',
      transliteration: translit[i]?.text ?? '',
      page: ar.page,
    }));
    const content: SurahContent = { number: surah, ayahs };
    memCache.set(key, content);
    void saveToStorage(key, content);
    return content;
  } catch (err) {
    const fb = FALLBACK[surah];
    if (fb) return fb;
    throw err;
  }
}

// Lightweight Arabic-text search across cached surahs. The caller is expected
// to have viewed/loaded the relevant surahs at least once for matches to surface
// without making additional network requests.
//
// The query and corpus go through the same letter-folding normaliser so users
// can type bare letters without worrying about harakat, tatweel, or which
// glyph variant a given mushaf uses for Alef / Waw / Ya. Folding rules:
//   \u2022 Alef variants  \u0622\u0623\u0625\u0671\u0672\u0673\u0675           \u2192 \u0627
//   \u2022 Waw variants   \u0624\u0676\u0677                       \u2192 \u0648
//   \u2022 Ya variants    \u0626\u0649\u0678                       \u2192 \u064A
//   \u2022 Tatweel        \u0640                             \u2192 (removed)
//   \u2022 Harakat        U+064B\u2013U+065F, U+06D6\u2013U+06ED       \u2192 (removed)
//
// The dagger alef \u0670 / subscript alef \u0656 are tricky: the Uthmani mushaf uses
// them to mark the long-a vowel in words that modern keyboards spell with a
// full Alef (e.g. \u0631\u0650\u0636\u0652\u0648\u064E\u0670\u0646 vs typed \u0631\u0636\u0648\u0627\u0646) and equally for words that
// modern keyboards spell WITHOUT a full Alef (e.g. \u0627\u0644\u0631\u062D\u0645\u0670\u0646 typed as \u0627\u0644\u0631\u062D\u0645\u0646).
// A single folding cannot satisfy both, so we generate two normalised forms
// per string \u2014 one with the dagger expanded to a full Alef and one with it
// stripped \u2014 and a hit is registered if either pair matches.
const DAGGER_ALEFS_RE = /[\u0670\u0656]/g;
const DIACRITICS_RE = /[\u064B-\u065F\u06D6-\u06ED]/g;
const TATWEEL_RE = /\u0640/g;
const ALEF_VARIANTS_RE = /[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g;
const WAW_VARIANTS_RE = /[\u0624\u0676\u0677]/g;
const YA_VARIANTS_RE = /[\u0626\u0649\u0678]/g;
// Final whitelist: drop anything that isn\u2019t a basic Arabic letter
// (U+0621\u2013U+064A) or a single space, so any stray formatting marks /
// presentation-form characters / punctuation that slipped past the named
// regexes above can\u2019t hide a substring match.
const NON_LETTER_RE = /[^\u0621-\u064A ]/g;

function foldLetters(s: string): string {
  // The quran-tajweed edition wraps letters in nested brackets shaped like
  // `[RULE[content]` or `[RULE:NUM[content]` where the actual Arabic letter
  // lives INSIDE the inner brackets. `stripTajweed` extracts the content
  // (replacing the whole tag with `$2`), so the underlying letter survives.
  // A naive `/\[[^\]]*\]/` would instead eat the inner letter \u2014 that bug is
  // what caused queries like \u0631\u0636\u0648\u0627\u0646 to fail on tajweed-script verses.
  return stripTajweed(s)
    .replace(DIACRITICS_RE, '')
    .replace(TATWEEL_RE, '')
    .replace(ALEF_VARIANTS_RE, '\u0627')
    .replace(WAW_VARIANTS_RE, '\u0648')
    .replace(YA_VARIANTS_RE, '\u064A')
    .replace(NON_LETTER_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dagger-as-full-alef form. Matches user input that includes the long-a
// (e.g. \u0631\u0636\u0648\u0627\u0646 \u2194 \u0631\u0650\u0636\u0652\u0648\u064E\u0670\u0646).
function normalizeArabicLong(s: string): string {
  return foldLetters(s.replace(DAGGER_ALEFS_RE, '\u0627'));
}

// Dagger-stripped form. Matches user input that omits the long-a
// (e.g. \u0627\u0644\u0631\u062D\u0645\u0646 \u2194 \u0627\u0644\u0631\u064E\u062D\u0652\u0645\u064E\u0670\u0646).
function normalizeArabicShort(s: string): string {
  return foldLetters(s.replace(DAGGER_ALEFS_RE, ''));
}

export interface SearchHit {
  surah: number;
  ayah: number;
  arabic: string;
  translation: string;
}

export function searchCached(query: string): SearchHit[] {
  const qLong = normalizeArabicLong(query);
  const qShort = normalizeArabicShort(query);
  if (!qLong && !qShort) return [];
  const hits: SearchHit[] = [];
  // The same surah can live in memCache under several keys (different
  // translation and/or script), so a single ayah would otherwise be pushed
  // once per cached copy — yielding duplicate `surah:ayah` hits that break
  // React list keys (the "two children with the same key" warning). Dedupe
  // on `surah:ayah`, keeping the first copy seen.
  const seen = new Set<string>();
  memCache.forEach(content => {
    if (!content || !Array.isArray(content.ayahs)) return;
    content.ayahs.forEach(a => {
      // Hit if either folding pair matches \u2014 covers both modern short and
      // Uthmani long spellings (see comment block above for rationale).
      const longHit = !!qLong && normalizeArabicLong(a.arabic).includes(qLong);
      const shortHit = !longHit && !!qShort && normalizeArabicShort(a.arabic).includes(qShort);
      if (longHit || shortHit) {
        const dedupeKey = `${content.number}:${a.numberInSurah}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        hits.push({
          surah: content.number,
          ayah: a.numberInSurah,
          arabic: a.arabic,
          translation: a.translation,
        });
      }
    });
  });
  hits.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  return hits.slice(0, 50);
}

// Diagnostic helper for the Search screen. Returns the corpus size that
// `searchCached` actually iterated and the normalized form of the query, so a
// "no results" outcome can be triaged on-device (cache empty vs. normalisation
// stripping the query) without needing dev-tools logs.
export interface SearchAudit {
  surahs: number;
  ayahs: number;
  qLong: string;
  qShort: string;
}

export function auditSearch(query: string): SearchAudit {
  let surahs = 0;
  let ayahs = 0;
  memCache.forEach(content => {
    if (!content || !Array.isArray(content.ayahs)) return;
    surahs++;
    ayahs += content.ayahs.length;
  });
  return {
    surahs,
    ayahs,
    qLong: normalizeArabicLong(query),
    qShort: normalizeArabicShort(query),
  };
}

// Targeted probe used by the Search screen to triage a "0 hits" result for
// a query that is known to occur in specific ayahs. Reads the ayah straight
// from the in-memory cache (no network) and reports the raw text plus its
// normalized form so the on-device output makes it obvious whether the
// failure is (a) cache miss, (b) corpus empty, or (c) a normalization gap
// for a character class we haven't folded yet.
export interface AyahProbe {
  surah: number;
  ayah: number;
  found: boolean;
  rawHead: string;
  normLong: string;
  longContainsQ: boolean;
  shortContainsQ: boolean;
}

export function probeAyahs(query: string, refs: Array<[number, number]>): AyahProbe[] {
  const qLong = normalizeArabicLong(query);
  const qShort = normalizeArabicShort(query);
  const out: AyahProbe[] = [];
  for (const [surah, ayah] of refs) {
    let found = false;
    let arabic = '';
    memCache.forEach(content => {
      if (found || !content || content.number !== surah || !Array.isArray(content.ayahs)) return;
      const hit = content.ayahs.find(a => a.numberInSurah === ayah);
      if (hit) { found = true; arabic = hit.arabic; }
    });
    const normLong = normalizeArabicLong(arabic);
    out.push({
      surah,
      ayah,
      found,
      rawHead: arabic.slice(0, 60),
      normLong: normLong.slice(0, 60),
      longContainsQ: !!qLong && normLong.includes(qLong),
      shortContainsQ: !!qShort && normalizeArabicShort(arabic).includes(qShort),
    });
  }
  return out;
}


// Whole-Quran fetch + per-surah persist. Uses three /quran/{edition} requests
// instead of 114×3 per-surah requests, then unpacks into the existing per-surah
// cache layout so the rest of the app (including searchCached) just works.
interface FullQuranSurahPayload {
  number: number;
  ayahs: Array<{ numberInSurah: number; text: string; page?: number }>;
}

async function fetchFullEdition(edition: string): Promise<FullQuranSurahPayload[]> {
  // Retry with exponential backoff. Some networks (corporate proxies, flaky
  // mobile data) silently empty-reply on the first hit; a couple of retries
  // turn that into a successful precache instead of leaving the cache empty
  // and search broken.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/quran/${edition}`);
      if (!res.ok) throw new Error(`Failed to fetch /quran/${edition}: ${res.status}`);
      const json = await res.json();
      const surahs = json?.data?.surahs as FullQuranSurahPayload[] | undefined;
      if (!surahs) throw new Error('Malformed /quran payload');
      return surahs;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface PrecacheProgress {
  loaded: number;
  total: number;
  done: boolean;
  error?: string;
}

export async function isPrecached(
  translation: string = DEFAULT_TRANSLATION,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(flagKey(translation, script));
    return flag === '1';
  } catch {
    return false;
  }
}

// Clears the "all-surahs cached" flag so the next bootstrap (or an explicit
// call to `precacheAllSurahs`) treats the cache as cold and re-downloads
// every surah. Used by the Settings "Rebuild search cache" affordance when
// the in-memory cache is suspected to be incomplete.
export async function clearPrecacheFlag(
  translation: string = DEFAULT_TRANSLATION,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(flagKey(translation, script));
  } catch {
    // Best-effort: a failed clear just means the next precache call still
    // runs (callers invoke precacheAllSurahs unconditionally after this).
  }
}

export async function precacheAllSurahs(
  translation: string = DEFAULT_TRANSLATION,
  onProgress?: (p: PrecacheProgress) => void,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): Promise<void> {
  const TOTAL = 114;
  onProgress?.({ loaded: 0, total: TOTAL, done: false });

  const [arabicSurahs, transSurahs, translitSurahs] = await Promise.all([
    fetchFullEdition(ARABIC_EDITIONS[script]),
    fetchFullEdition(translation),
    fetchFullEdition(TRANSLITERATION_EDITION),
  ]);

  // Refuse to mark a truncated payload as "complete". The bulk endpoint has
  // been observed returning a partial surah list on flaky networks; without
  // this guard the precached flag would be set with N<114 entries and the
  // app would never retry on subsequent launches.
  if (arabicSurahs.length < TOTAL) {
    throw new Error(`Incomplete Arabic edition: ${arabicSurahs.length}/${TOTAL} surahs`);
  }

  const byNum = (arr: FullQuranSurahPayload[]) =>
    new Map(arr.map(s => [s.number, s]));
  const trMap = byNum(transSurahs);
  const tlMap = byNum(translitSurahs);

  const pairs: [string, string][] = [];
  for (let i = 0; i < arabicSurahs.length; i++) {
    const ar = arabicSurahs[i];
    const tr = trMap.get(ar.number);
    const tl = tlMap.get(ar.number);
    const ayahs: Ayah[] = ar.ayahs.map((a, idx) => ({
      numberInSurah: a.numberInSurah,
      arabic: a.text,
      translation: tr?.ayahs[idx]?.text ?? '',
      transliteration: tl?.ayahs[idx]?.text ?? '',
      page: a.page,
    }));
    const content: SurahContent = { number: ar.number, ayahs };
    const key = cacheKey(ar.number, translation, script);
    memCache.set(key, content);
    pairs.push([key, JSON.stringify(content)]);
    onProgress?.({ loaded: i + 1, total: TOTAL, done: false });
  }

  try {
    await AsyncStorage.multiSet(pairs);
    await AsyncStorage.setItem(flagKey(translation, script), '1');
  } catch (err) {
    onProgress?.({ loaded: TOTAL, total: TOTAL, done: true, error: String(err) });
    return;
  }
  onProgress?.({ loaded: TOTAL, total: TOTAL, done: true });
}

// Current count of surahs held in the in-memory cache for the given
// translation + script combo. Used by the startup integrity check (and the
// Settings "Search cache" card) to detect a stale precache flag whose
// underlying AsyncStorage payloads were lost or never fully written.
export function memCacheSurahCount(
  translation: string = DEFAULT_TRANSLATION,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): number {
  const suffix = script === DEFAULT_SCRIPT ? `:${translation}` : `:${translation}:${script}`;
  let n = 0;
  memCache.forEach((_v, k) => {
    if (k.startsWith(CACHE_PREFIX) && !k.startsWith(PRECACHE_FLAG_PREFIX) && k.endsWith(suffix)) n++;
  });
  return n;
}

// Loads cached surahs from AsyncStorage into the in-memory cache for the given
// translation. Call once on app start after hydration so that searchCached
// works without first opening any surah. Returns the number of surahs warmed
// so the caller can detect a flag-says-cached / storage-actually-empty mismatch.
export async function warmMemoryCache(
  translation: string = DEFAULT_TRANSLATION,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const suffix = script === DEFAULT_SCRIPT ? `:${translation}` : `:${translation}:${script}`;
    // PRECACHE_FLAG_PREFIX also starts with CACHE_PREFIX, so the flag key would
    // otherwise be picked up here and parsed as a surah payload. Exclude it.
    const wanted = keys.filter(k =>
      k.startsWith(CACHE_PREFIX)
      && !k.startsWith(PRECACHE_FLAG_PREFIX)
      && k.endsWith(suffix),
    );
    if (wanted.length === 0) return 0;
    const entries = await AsyncStorage.multiGet(wanted);
    let loaded = 0;
    for (const [k, v] of entries) {
      if (!v) continue;
      try {
        const content = JSON.parse(v) as SurahContent;
        if (!content || !Array.isArray(content.ayahs)) continue;
        memCache.set(k, content);
        loaded++;
      } catch {
        // Skip corrupt entries
      }
    }
    return loaded;
  } catch {
    return 0;
  }
}
