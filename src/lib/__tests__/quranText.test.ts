import { stripBismillahPrefix } from '../quranText';

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
