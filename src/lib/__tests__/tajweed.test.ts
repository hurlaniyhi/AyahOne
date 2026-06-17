import {
  parseTajweed,
  stripTajweed,
  hasTajweedMarkup,
  TAJWEED_COLORS,
  TAJWEED_LABELS,
  TAJWEED_LEGEND_ORDER,
} from '../tajweed';

describe('parseTajweed', () => {
  it('returns a single plain segment for unmarked text', () => {
    const out = parseTajweed('بسم الله');
    expect(out).toEqual([{ text: 'بسم الله' }]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseTajweed('')).toEqual([]);
  });

  it('extracts a single rule with surrounding plain text', () => {
    const out = parseTajweed('بِسْمِ [h[ٱ]للَّهِ');
    expect(out).toEqual([
      { text: 'بِسْمِ ' },
      { text: 'ٱ', rule: 'h' },
      { text: 'للَّهِ' },
    ]);
  });

  it('supports the optional :NUM suffix on the opening tag', () => {
    const out = parseTajweed('[h:1[ٱ]للَّهِ');
    expect(out).toEqual([
      { text: 'ٱ', rule: 'h' },
      { text: 'للَّهِ' },
    ]);
  });

  it('parses multiple consecutive rule spans in order', () => {
    const out = parseTajweed('[g[ٱلرَّ]حْمَ[n[ـٰ]نِ');
    expect(out).toEqual([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَ' },
      { text: 'ـٰ', rule: 'n' },
      { text: 'نِ' },
    ]);
  });

  it('leaves unrecognised bracket sequences as plain text', () => {
    // `z` is not a defined rule code; the regex must not match it.
    const out = parseTajweed('foo [z[bar] baz');
    expect(out).toEqual([{ text: 'foo [z[bar] baz' }]);
  });

  it('covers every declared rule code', () => {
    const allRules = Object.keys(TAJWEED_COLORS) as Array<keyof typeof TAJWEED_COLORS>;
    for (const r of allRules) {
      const out = parseTajweed(`x[${r}[y]z`);
      expect(out).toEqual([
        { text: 'x' },
        { text: 'y', rule: r },
        { text: 'z' },
      ]);
    }
  });
});

describe('stripTajweed', () => {
  it('is a no-op for unmarked text', () => {
    expect(stripTajweed('بسم الله')).toBe('بسم الله');
  });

  it('removes the bracket wrappers but keeps inner text', () => {
    expect(stripTajweed('بِسْمِ [h[ٱ]للَّهِ')).toBe('بِسْمِ ٱللَّهِ');
  });

  it('handles the :NUM variant', () => {
    expect(stripTajweed('[h:1[ٱ]للَّهِ')).toBe('ٱللَّهِ');
  });

  it('strips multiple spans', () => {
    expect(stripTajweed('[g[ٱلرَّ]حْمَ[n[ـٰ]نِ')).toBe('ٱلرَّحْمَـٰنِ');
  });

  it('keeps unrelated brackets untouched', () => {
    expect(stripTajweed('keep [z[me]')).toBe('keep [z[me]');
  });
});

describe('hasTajweedMarkup', () => {
  it('returns true when at least one rule span is present', () => {
    expect(hasTajweedMarkup('foo [h[ٱ]bar')).toBe(true);
  });

  it('returns false for plain Arabic', () => {
    expect(hasTajweedMarkup('بِسْمِ ٱللَّهِ')).toBe(false);
  });

  it('is reentrant — repeated calls return the same result', () => {
    const s = 'foo [n[ـٰ]bar';
    expect(hasTajweedMarkup(s)).toBe(true);
    expect(hasTajweedMarkup(s)).toBe(true);
    expect(hasTajweedMarkup(s)).toBe(true);
  });
});

describe('legend metadata', () => {
  it('declares a label for every colour', () => {
    for (const r of Object.keys(TAJWEED_COLORS)) {
      expect(TAJWEED_LABELS[r as keyof typeof TAJWEED_LABELS]).toBeTruthy();
    }
  });

  it('legend order references each rule exactly once', () => {
    const colorKeys = Object.keys(TAJWEED_COLORS).sort();
    const orderKeys = [...TAJWEED_LEGEND_ORDER].sort();
    expect(orderKeys).toEqual(colorKeys);
  });
});
