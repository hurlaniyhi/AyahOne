import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPageContent, pageForAyah } from '../mushafPages';
import type { SurahContent } from '../quranApi';

// mushafPages assembles pages purely from getSurahContent + the per-ayah `page`
// field. getSurahContent serves from AsyncStorage before ever touching the
// network, so seeding storage directly (under a NON-default translation id so
// the bundled offline combo is skipped) exercises the assembler without any
// fetch mocking. A unique translation id per suite run also side-steps the
// module-level in-memory cache carrying state between assertions.
const TR = 'test.mushaf';
const SCRIPT = 'uthmani';

function storageKey(surah: number): string {
  // Matches quranApi's cacheKey shape for a non-default translation on the
  // default script: `surah:v2:{surah}:{translation}`.
  return `surah:v2:${surah}:${TR}`;
}

function ayah(numberInSurah: number, page: number): SurahContent['ayahs'][number] {
  return {
    numberInSurah,
    arabic: `\u0628\u062D S?A${numberInSurah}`,
    translation: `t${numberInSurah}`,
    transliteration: `tl${numberInSurah}`,
    page,
  };
}

async function seed(surah: number, ayahs: SurahContent['ayahs']): Promise<void> {
  const content: SurahContent = { number: surah, ayahs };
  await AsyncStorage.setItem(storageKey(surah), JSON.stringify(content));
}

// Synthetic three-surah corpus. Page 4 is the interesting one: it holds the
// last ayah of surah 10, all of surah 11, and the first ayah of surah 12 — a
// page that spans TWO surah boundaries.
async function seedCorpus(): Promise<void> {
  await seed(10, [ayah(1, 3), ayah(2, 3), ayah(3, 4)]);        // last ayah on page 4
  await seed(11, [ayah(1, 4), ayah(2, 4)]);                    // entirely on page 4
  await seed(12, [ayah(1, 4), ayah(2, 5), ayah(3, 5)]);        // first ayah on page 4
}

describe('mushafPages', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await seedCorpus();
  });

  describe('pageForAyah', () => {
    it('resolves the page of a given ayah', async () => {
      expect(await pageForAyah(10, 1, TR, SCRIPT)).toBe(3);
      expect(await pageForAyah(10, 3, TR, SCRIPT)).toBe(4);
      expect(await pageForAyah(12, 2, TR, SCRIPT)).toBe(5);
    });

    it('returns null when the ayah is missing', async () => {
      expect(await pageForAyah(10, 99, TR, SCRIPT)).toBeNull();
    });
  });

  describe('getPageContent', () => {
    it('stitches a page that spans two surah boundaries', async () => {
      const page = await getPageContent(4, 11, TR, SCRIPT);

      expect(page.page).toBe(4);
      expect(page.surahs).toEqual([10, 11, 12]);
      // Every ayah on page 4, in mushaf order (surah asc, then ayah asc).
      expect(page.ayahs.map(a => `${a.surah}:${a.numberInSurah}`)).toEqual([
        '10:3', '11:1', '11:2', '12:1',
      ]);
      // Ayahs from adjacent surahs NOT on page 4 are excluded.
      expect(page.ayahs.some(a => a.surah === 10 && a.numberInSurah === 1)).toBe(false);
      expect(page.ayahs.some(a => a.surah === 12 && a.numberInSurah === 2)).toBe(false);
    });

    it('finds the page even when the anchor surah is not on it', async () => {
      // Anchor on surah 10 while requesting page 5 (only surah 12 touches it).
      const page = await getPageContent(5, 10, TR, SCRIPT);
      expect(page.surahs).toEqual([12]);
      expect(page.ayahs.map(a => `${a.surah}:${a.numberInSurah}`)).toEqual([
        '12:2', '12:3',
      ]);
    });

    it('returns an empty page when nothing sits on it', async () => {
      const page = await getPageContent(99, 11, TR, SCRIPT);
      expect(page.ayahs).toEqual([]);
      expect(page.surahs).toEqual([]);
    });

    it('does not pull ayahs from a non-adjacent surah that shares the page number', async () => {
      // Surah 1 also lives on page 4 but is separated from the 10/11/12 block by
      // surahs 2-9 (which are absent from the corpus). The outward walk must
      // stop at the first gap and not vacuum in this far-away surah.
      await seed(1, [ayah(1, 4)]);
      const page = await getPageContent(4, 11, TR, SCRIPT);
      expect(page.surahs).toEqual([10, 11, 12]);
      expect(page.ayahs.some(a => a.surah === 1)).toBe(false);
    });
  });
});
