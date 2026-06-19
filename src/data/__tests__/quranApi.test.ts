import AsyncStorage from '@react-native-async-storage/async-storage';
import { precacheAllSurahs, isPrecached, searchCached, warmMemoryCache, type PrecacheProgress } from '../quranApi';

type Edition = 'quran-uthmani' | 'en.sahih' | 'en.transliteration';

function makeSurah(num: number, prefix: string, ayahCount: number) {
  // Arabic-letter token so search-related tests exercise the same code path
  // as real Quran text (non-Arabic chars are stripped during normalisation).
  const arabicToken = (n: number) => `\u0628\u062D${'\u062A'.repeat(Math.max(1, n))}`;
  return {
    number: num,
    ayahs: Array.from({ length: ayahCount }, (_, i) => ({
      numberInSurah: i + 1,
      text: `${prefix}-S${num}A${i + 1} ${arabicToken(i + 1)}`,
    })),
  };
}

function buildPayload(editionPrefix: string) {
  // precacheAllSurahs now refuses to flag the cache complete unless all 114
  // surahs are present (defensive against truncated bulk responses), so the
  // mock corpus mirrors that shape. Surah 1 keeps 7 ayahs and Surah 2 keeps 3
  // for the existing per-surah assertions; the rest are stubbed with a single
  // ayah each.
  const surahs = Array.from({ length: 114 }, (_, i) => {
    const num = i + 1;
    const ayahCount = num === 1 ? 7 : num === 2 ? 3 : 1;
    return makeSurah(num, editionPrefix, ayahCount);
  });
  return { data: { surahs } };
}

function mockFetchByEdition() {
  return jest.fn(async (url: string) => {
    const m = url.match(/\/quran\/([^/]+)$/);
    const edition = (m?.[1] ?? '') as Edition;
    const prefix = edition === 'quran-uthmani' ? 'ar' : edition === 'en.sahih' ? 'en' : 'tl';
    return {
      ok: true,
      status: 200,
      json: async () => buildPayload(prefix),
    } as unknown as Response;
  });
}

describe('precacheAllSurahs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('fetches 3 bulk editions, persists per-surah entries, and sets the precached flag', async () => {
    const fetchMock = mockFetchByEdition();
    global.fetch = fetchMock as unknown as typeof fetch;

    const progress: PrecacheProgress[] = [];
    await precacheAllSurahs('en.sahih', (p) => progress.push({ ...p }));

    // 3 bulk requests: Arabic, translation, transliteration
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://api.alquran.cloud/v1/quran/quran-uthmani',
        'https://api.alquran.cloud/v1/quran/en.sahih',
        'https://api.alquran.cloud/v1/quran/en.transliteration',
      ])
    );

    // Per-surah entries written under the existing key shape
    const s1 = await AsyncStorage.getItem('surah:v2:1:en.sahih');
    const s2 = await AsyncStorage.getItem('surah:v2:2:en.sahih');
    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();

    const s1Parsed = JSON.parse(s1!);
    expect(s1Parsed.number).toBe(1);
    expect(s1Parsed.ayahs).toHaveLength(7);
    expect(s1Parsed.ayahs[0]).toEqual({
      numberInSurah: 1,
      arabic: 'ar-S1A1 \u0628\u062D\u062A',
      translation: 'en-S1A1 \u0628\u062D\u062A',
      transliteration: 'tl-S1A1 \u0628\u062D\u062A',
    });

    // Flag written for this translation
    expect(await AsyncStorage.getItem('surah:v2:precached:en.sahih')).toBe('1');

    // Progress: starts at 0, ends with done=true
    expect(progress[0]).toEqual({ loaded: 0, total: 114, done: false });
    const last = progress[progress.length - 1];
    expect(last.done).toBe(true);
    expect(last.error).toBeUndefined();
  });

  it('isPrecached returns false before and true after a successful precache', async () => {
    global.fetch = mockFetchByEdition() as unknown as typeof fetch;
    expect(await isPrecached('en.sahih')).toBe(false);
    await precacheAllSurahs('en.sahih');
    expect(await isPrecached('en.sahih')).toBe(true);
  });

  it('does not mark precached when the bulk fetch fails', async () => {
    const failingFetch = jest.fn(async () => {
      return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    });
    global.fetch = failingFetch as unknown as typeof fetch;

    await expect(precacheAllSurahs('en.sahih')).rejects.toThrow(/Failed to fetch/);
    expect(await isPrecached('en.sahih')).toBe(false);
  });
});

describe('warmMemoryCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('loads previously precached surahs into the in-memory cache without network', async () => {
    global.fetch = mockFetchByEdition() as unknown as typeof fetch;
    await precacheAllSurahs('en.sahih');

    // Drop the fetch mock to ensure warmMemoryCache + subsequent reads do not hit the network
    const blowUp = jest.fn(() => {
      throw new Error('Network should not be hit after warmMemoryCache');
    });
    global.fetch = blowUp as unknown as typeof fetch;

    const warmed = await warmMemoryCache('en.sahih');
    expect(warmed).toBeGreaterThan(0);
    expect(blowUp).not.toHaveBeenCalled();
  });

  // Regression: the precache flag key (`surah:v1:precached:{translation}`) also
  // starts with the surah CACHE_PREFIX, so a naive prefix+suffix filter used to
  // pull it in alongside real surah payloads. JSON.parse('1') === 1 then ended
  // up in the in-memory cache and crashed searchCached with
  // "Cannot read property 'forEach' of undefined".
  it('does not load the precached flag key as if it were surah content', async () => {
    global.fetch = mockFetchByEdition() as unknown as typeof fetch;
    await precacheAllSurahs('en.sahih');
    await warmMemoryCache('en.sahih');

    // searchCached iterates every memCache entry; if the flag had been loaded,
    // this call would throw on `.ayahs.forEach` of a number.
    const q = '\u0628\u062D\u062A'; // Arabic token from makeSurah ayah 1
    expect(() => searchCached(q)).not.toThrow();
    const hits = searchCached(q);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].surah).toBe(1);
  });
});

describe('searchCached normalisation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  // Regression: the quran-tajweed edition wraps letters in nested brackets
  // shaped like `[RULE[content]`. A previous naive `/\[[^\]]*\]/` matched
  // from the OUTER `[` to the inner `]`, deleting the wrapped letter.
  // foldLetters now delegates to stripTajweed so the inner Arabic survives.
  it('finds \u0631\u0636\u0648\u0627\u0646 inside tajweed-bracketed text', async () => {
    // 47:28 fragment with the long-a vowel encoded as a dagger alef inside a
    // tajweed `[a[\u0670]` tag (idgham_w_ghunnah). Without the fix the wrapped
    // `\u0670` is consumed, normalisation produces `\u0631\u0636\u0648\u0646\u0647`, and the query misses.
    const tajweedFetch = jest.fn(async (url: string) => {
      const m = url.match(/\/quran\/([^/]+)$/);
      const edition = (m?.[1] ?? '') as Edition;
      if (edition === 'quran-uthmani') {
        const surahs = Array.from({ length: 114 }, (_, i) => {
          const num = i + 1;
          if (num === 47) {
            return {
              number: 47,
              ayahs: [
                { numberInSurah: 1, text: 'placeholder' },
                { numberInSurah: 28, text: '\u0648\u064E\u0643\u064E\u0631\u0650\u0647\u064F\u0648\u0627\u06DF \u0631\u0650\u0636\u0652\u0648\u064E[a[\u0670]\u0646\u064E\u0647\u064F\u06E5' },
              ],
            };
          }
          return makeSurah(num, 'ar', 1);
        });
        return { ok: true, status: 200, json: async () => ({ data: { surahs } }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => buildPayload(edition === 'en.sahih' ? 'en' : 'tl') } as unknown as Response;
    });
    global.fetch = tajweedFetch as unknown as typeof fetch;
    await precacheAllSurahs('en.sahih');

    const hits = searchCached('\u0631\u0636\u0648\u0627\u0646');
    const muhammad = hits.find(h => h.surah === 47 && h.ayah === 28);
    expect(muhammad).toBeDefined();
  });
});
