import AsyncStorage from '@react-native-async-storage/async-storage';

// getSurahAudioUrls / getAyahAudioUrl are require()'d fresh inside each test
// (after jest.resetModules) so the module's in-memory audio cache never leaks
// a resolved list from one test into the next.

// Surah 1 (Al-Fatiha) has 7 ayahs; Surah 108 (Al-Kawthar) has 3. Both counts
// come from the bundled surahs.ts metadata the fallback relies on.
const FATIHA_AYAHS = 7;

// Simulates a healthy alquran.cloud payload whose per-ayah URLs point at a
// LIVE host (not the dead cdn.islamic.network), so getSurahAudioUrls keeps them.
function alquranPayload(surah: number, ayahCount: number, host = 'https://audio.example.test') {
  return {
    data: {
      ayahs: Array.from({ length: ayahCount }, (_, i) => ({
        audio: `${host}/${surah}-${i + 1}.mp3`,
      })),
    },
  };
}

describe('getSurahAudioUrls / getAyahAudioUrl everyayah fallback', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
    // Reset the module's in-memory cache between tests so each exercises a
    // fresh fetch path.
    jest.resetModules();
  });

  it('uses alquran.cloud URLs when the primary fetch succeeds with a live host', async () => {
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => alquranPayload(1, FATIHA_AYAHS),
    } as unknown as Response));
    global.fetch = fetchMock as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.alafasy');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls).toHaveLength(FATIHA_AYAHS);
    expect(urls[0]).toBe('https://audio.example.test/1-1.mp3');
  });

  it('replaces dead cdn.islamic.network URLs from a successful fetch with everyayah', async () => {
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    // alquran.cloud answers, but its URLs point at the unreachable CDN.
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => alquranPayload(1, FATIHA_AYAHS, 'https://cdn.islamic.network/quran/audio/128/ar.alafasy'),
    } as unknown as Response)) as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.alafasy');

    expect(urls[0]).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
  });

  it('ignores a stale persisted cdn.islamic.network cache and uses everyayah', async () => {
    // Require the module and its AsyncStorage together so the seeded value is
    // visible to the same mock instance the module reads through. The mock's
    // export shape can be either the object or its `.default`, so resolve both.
    const StorageMod = require('@react-native-async-storage/async-storage');
    const Storage = StorageMod.default ?? StorageMod;
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    // Simulate an older session having persisted dead CDN URLs to storage.
    const dead = Array.from({ length: FATIHA_AYAHS }, (_, i) =>
      `https://cdn.islamic.network/quran/audio/128/ar.alafasy/1-${i + 1}.mp3`);
    await Storage.setItem('surahAudio:v1:1:ar.alafasy', JSON.stringify(dead));
    // Primary host also down, so the only healthy path is everyayah.
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.alafasy');

    expect(urls[0]).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
  });

  it('uses a healthy persisted cache without fetching', async () => {
    const StorageMod = require('@react-native-async-storage/async-storage');
    const Storage = StorageMod.default ?? StorageMod;
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    const live = Array.from({ length: FATIHA_AYAHS }, (_, i) =>
      `https://audio.example.test/1-${i + 1}.mp3`);
    await Storage.setItem('surahAudio:v1:1:ar.alafasy', JSON.stringify(live));
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.alafasy');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(urls[0]).toBe('https://audio.example.test/1-1.mp3');
  });

  it('falls back to deterministic everyayah URLs when the primary fetch fails', async () => {
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    const fetchMock = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.alafasy');

    expect(urls).toHaveLength(FATIHA_AYAHS);
    // Scheme: https://everyayah.com/data/{FOLDER}/{SSS}{AAA}.mp3
    expect(urls[0]).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
    expect(urls[6]).toBe('https://everyayah.com/data/Alafasy_128kbps/001007.mp3');
  });

  it('falls back when the primary fetch times out (aborts)', async () => {
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    const fetchMock = jest.fn(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.alafasy');

    expect(urls[0]).toBe('https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
  });

  it('uses the mapped 192kbps folder for reciters with no 128kbps set', async () => {
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const urls = await getUrls(1, 'ar.abdulbasitmurattal');

    expect(urls[0]).toBe('https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/001001.mp3');
  });

  it('re-throws when the reciter has no everyayah mapping', async () => {
    const { getSurahAudioUrls: getUrls } = require('../quranAudio');
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    await expect(getUrls(1, 'ar.unknownreciter')).rejects.toThrow('Network request failed');
  });

  it('getAyahAudioUrl returns the everyayah URL for a single ayah on fallback', async () => {
    const { getAyahAudioUrl: getOne } = require('../quranAudio');
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const url = await getOne(108, 3, 'ar.alafasy');

    expect(url).toBe('https://everyayah.com/data/Alafasy_128kbps/108003.mp3');
  });
});
