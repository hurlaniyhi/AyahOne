import AsyncStorage from '@react-native-async-storage/async-storage';
import { FALLBACK } from './fallback';

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
// without making additional network requests. The query is normalized to
// remove diacritics so users do not need to type harakat.
const DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
function normalizeArabic(s: string): string {
  return s.replace(DIACRITICS_RE, '').replace(/\s+/g, ' ').trim();
}

export interface SearchHit {
  surah: number;
  ayah: number;
  arabic: string;
  translation: string;
}

export function searchCached(query: string): SearchHit[] {
  const q = normalizeArabic(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  memCache.forEach(content => {
    if (!content || !Array.isArray(content.ayahs)) return;
    content.ayahs.forEach(a => {
      if (normalizeArabic(a.arabic).includes(q)) {
        hits.push({
          surah: content.number,
          ayah: a.numberInSurah,
          arabic: a.arabic,
          translation: a.translation,
        });
      }
    });
  });
  return hits.slice(0, 50);
}


// Whole-Quran fetch + per-surah persist. Uses three /quran/{edition} requests
// instead of 114×3 per-surah requests, then unpacks into the existing per-surah
// cache layout so the rest of the app (including searchCached) just works.
interface FullQuranSurahPayload {
  number: number;
  ayahs: Array<{ numberInSurah: number; text: string; page?: number }>;
}

async function fetchFullEdition(edition: string): Promise<FullQuranSurahPayload[]> {
  const res = await fetch(`https://api.alquran.cloud/v1/quran/${edition}`);
  if (!res.ok) throw new Error(`Failed to fetch /quran/${edition}: ${res.status}`);
  const json = await res.json();
  const surahs = json?.data?.surahs as FullQuranSurahPayload[] | undefined;
  if (!surahs) throw new Error('Malformed /quran payload');
  return surahs;
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

// Loads cached surahs from AsyncStorage into the in-memory cache for the given
// translation. Call once on app start after hydration so that searchCached
// works without first opening any surah.
export async function warmMemoryCache(
  translation: string = DEFAULT_TRANSLATION,
  script: ArabicScriptId = DEFAULT_SCRIPT,
): Promise<void> {
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
    if (wanted.length === 0) return;
    const entries = await AsyncStorage.multiGet(wanted);
    for (const [k, v] of entries) {
      if (!v) continue;
      try {
        const content = JSON.parse(v) as SurahContent;
        if (!content || !Array.isArray(content.ayahs)) continue;
        memCache.set(k, content);
      } catch {
        // Skip corrupt entries
      }
    }
  } catch {
    // ignore
  }
}
