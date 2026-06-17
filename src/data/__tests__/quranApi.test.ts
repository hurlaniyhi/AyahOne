import AsyncStorage from '@react-native-async-storage/async-storage';
import { precacheAllSurahs, isPrecached, searchCached, warmMemoryCache, type PrecacheProgress } from '../quranApi';

type Edition = 'quran-uthmani' | 'en.sahih' | 'en.transliteration';

function makeSurah(num: number, prefix: string, ayahCount: number) {
  return {
    number: num,
    ayahs: Array.from({ length: ayahCount }, (_, i) => ({
      numberInSurah: i + 1,
      text: `${prefix}-S${num}A${i + 1}`,
    })),
  };
}

function buildPayload(editionPrefix: string) {
  return {
    data: {
      surahs: [makeSurah(1, editionPrefix, 7), makeSurah(2, editionPrefix, 3)],
    },
  };
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
    const s1 = await AsyncStorage.getItem('surah:v1:1:en.sahih');
    const s2 = await AsyncStorage.getItem('surah:v1:2:en.sahih');
    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();

    const s1Parsed = JSON.parse(s1!);
    expect(s1Parsed.number).toBe(1);
    expect(s1Parsed.ayahs).toHaveLength(7);
    expect(s1Parsed.ayahs[0]).toEqual({
      numberInSurah: 1,
      arabic: 'ar-S1A1',
      translation: 'en-S1A1',
      transliteration: 'tl-S1A1',
    });

    // Flag written for this translation
    expect(await AsyncStorage.getItem('surah:v1:precached:en.sahih')).toBe('1');

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

    await expect(warmMemoryCache('en.sahih')).resolves.toBeUndefined();
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
    expect(() => searchCached('ar-S1A1')).not.toThrow();
    const hits = searchCached('ar-S1A1');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].surah).toBe(1);
  });
});
