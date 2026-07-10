import { stripBismillahPrefix, isQuranWordToken } from '../quranText';

describe('stripBismillahPrefix', () => {
  it('strips a matching Bismillah prefix', () => {
    const words = ['بِسْمِ', 'اللَّهِ', 'الرَّحْمَٰنِ', 'الرَّحِيمِ', 'الٓمٓ'];
    expect(stripBismillahPrefix(words)).toEqual(['الٓمٓ']);
  });

  it('matches regardless of alef-variant / diacritic encoding differences', () => {
    // Uses the wasla alef (ٱ) form and dagger-alef madda, as Tanzil-style
    // Uthmani sources commonly do, instead of the plain-alef forms above.
    const words = ['بِسۡمِ', 'ٱللَّهِ', 'ٱلرَّحۡمَٰنِ', 'ٱلرَّحِيمِ', 'يَٰٓأَيُّهَا', 'ٱلنَّاسُ'];
    expect(stripBismillahPrefix(words)).toEqual(['يَٰٓأَيُّهَا', 'ٱلنَّاسُ']);
  });

  it('leaves a non-Bismillah word array unchanged', () => {
    const words = ['الٓمٓ'];
    expect(stripBismillahPrefix(words)).toEqual(['الٓمٓ']);
  });

  it('leaves a short array unchanged even if it partially matches', () => {
    const words = ['بِسْمِ', 'اللَّهِ'];
    expect(stripBismillahPrefix(words)).toEqual(['بِسْمِ', 'اللَّهِ']);
  });
});

describe('isQuranWordToken', () => {
  it('rejects standalone waqf / pause marks', () => {
    // The small high marks the Uthmani source space-separates: ۖ ۗ ۘ ۙ ۚ ۛ ۜ
    for (const mark of ['\u06D6', '\u06D7', '\u06D8', '\u06D9', '\u06DA', '\u06DB', '\u06DC']) {
      expect(isQuranWordToken(mark)).toBe(false);
    }
  });

  it('rejects the rub-el-hizb and sajda marks', () => {
    expect(isQuranWordToken('\u06DE')).toBe(false);
    expect(isQuranWordToken('\u06E9')).toBe(false);
  });

  it('keeps real words even when they carry diacritics or tatweel', () => {
    for (const word of ['رَيْبَ', 'فِيهِ', 'هَـٰذَا', 'يَٰٓأَيُّهَا', 'الٓمٓ']) {
      expect(isQuranWordToken(word)).toBe(true);
    }
  });

  it('filters 2:2-style tokens down to the 7 real words', () => {
    const tokens = 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًۭى لِّلْمُتَّقِينَ'.split(/\s+/);
    expect(tokens.filter(isQuranWordToken)).toHaveLength(7);
  });
});
