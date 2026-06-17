import { countArabicLetters, hasanatFor } from '../hasanat';

describe('countArabicLetters', () => {
  it('returns 0 for empty input', () => {
    expect(countArabicLetters('')).toBe(0);
  });

  it('returns 0 for non-Arabic text', () => {
    expect(countArabicLetters('Hello world 123')).toBe(0);
  });

  it('ignores spaces', () => {
    // بسم = 3, الله = 4 -> 7 letters total
    expect(countArabicLetters('بسم الله')).toBe(7);
  });

  it('ignores diacritics (harakat) and tatweel', () => {
    // Same letters as "بسم الله" but with harakat applied
    const withHarakat = 'بِسْمِ اللَّهِ';
    expect(countArabicLetters(withHarakat)).toBe(7);
  });

  it('ignores tatweel (kashida) elongation char', () => {
    expect(countArabicLetters('سـلام')).toBe(4); // س ل ا م
  });

  it('counts the Bismillah letters (19)', () => {
    // The canonical count of letters in the Basmala is 19.
    const bismillah = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    expect(countArabicLetters(bismillah)).toBe(19);
  });

  it('counts mixed Arabic + Latin text correctly', () => {
    expect(countArabicLetters('hello سلام world')).toBe(4);
  });
});

describe('hasanatFor', () => {
  it('returns 10 hasanat per Arabic letter', () => {
    expect(hasanatFor('بسم الله')).toBe(70);
  });

  it('returns 0 for empty / non-Arabic input', () => {
    expect(hasanatFor('')).toBe(0);
    expect(hasanatFor('English only')).toBe(0);
  });

  it('matches the canonical Bismillah hasanat (190)', () => {
    const bismillah = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    expect(hasanatFor(bismillah)).toBe(190);
  });
});
