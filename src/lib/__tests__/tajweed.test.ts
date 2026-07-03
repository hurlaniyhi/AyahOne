import {
  coalesceForJoining,
  hasTajweedMarkup,
  parseTajweed,
  parseTajweedForRender,
  rebalanceCombiningMarks,
  stripTajweed,
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

  it('drops bare positional markers like [s] without leaking brackets', () => {
    // Real case from Al-Baqarah 2:190 in the quran-tajweed edition: a bare
    // `[s]` marks the sakta / waqf position and must not render as text.
    const out = parseTajweed('وَلَا تَعۡتَدُوٓاْ[s] إِنَّ');
    expect(out).toEqual([
      { text: 'وَلَا تَعۡتَدُوٓاْ' },
      { text: ' إِنَّ' },
    ]);
  });

  it('drops bare markers with the :NUM suffix', () => {
    const out = parseTajweed('foo[s:1]bar');
    expect(out).toEqual([{ text: 'foo' }, { text: 'bar' }]);
  });

  it('matches uppercase rule letters and normalises the rule key', () => {
    // The API sometimes emits `[S]` / `[H[...]` instead of the lowercase
    // form; both must be consumed and any wrapped content must surface
    // under the canonical lowercase rule.
    const wrapped = parseTajweed('بِسْمِ [H[ٱ]للَّهِ');
    expect(wrapped).toEqual([
      { text: 'بِسْمِ ' },
      { text: 'ٱ', rule: 'h' },
      { text: 'للَّهِ' },
    ]);
    const bare = parseTajweed('وَلَا تَعۡتَدُوٓاْ[S] إِنَّ');
    expect(bare).toEqual([
      { text: 'وَلَا تَعۡتَدُوٓاْ' },
      { text: ' إِنَّ' },
    ]);
  });

  // Real Al-Baqarah 2:190 fragment: `[o[ُو۠[s[ا۟]‌ۚ]` — a silent span nested
  // inside a madd-obligatory span. The legacy non-recursive regex captured
  // only up to the first `]`, leaving the inner `[s[…` markup visible in the
  // rendered Arabic. The stack-walker must surface three segments and assign
  // the silent rule (innermost) to the silent letters.
  it('handles nested rule tags (Al-Baqara 2:190 case)', () => {
    const out = parseTajweed('تَعْتَد[o[ُو۠[s[ا۟]\u200c\u06da] إِنَّ');
    expect(out).toEqual([
      { text: 'تَعْتَد' },
      { text: 'ُو۠', rule: 'o' },
      { text: 'ا۟', rule: 's' },
      { text: '\u200c\u06da', rule: 'o' },
      { text: ' إِنَّ' },
    ]);
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

  it('removes bare positional markers entirely', () => {
    expect(stripTajweed('وَلَا تَعۡتَدُوٓاْ[s] إِنَّ')).toBe('وَلَا تَعۡتَدُوٓاْ إِنَّ');
  });

  it('removes bare markers with the :NUM suffix', () => {
    expect(stripTajweed('foo[s:1]bar')).toBe('foobar');
  });

  it('strips uppercase tags the same as lowercase', () => {
    expect(stripTajweed('بِسْمِ [H[ٱ]للَّهِ')).toBe('بِسْمِ ٱللَّهِ');
    expect(stripTajweed('وَلَا تَعۡتَدُوٓاْ[S] إِنَّ')).toBe('وَلَا تَعۡتَدُوٓاْ إِنَّ');
  });

  // The 2:190 nested fragment must strip cleanly with no orphan `]` left
  // behind — the legacy regex left a trailing `]` outside the inner match.
  it('strips nested rule tags without leaking brackets', () => {
    expect(stripTajweed('تَعْتَد[o[ُو۠[s[ا۟]\u200c\u06da] إِنَّ'))
      .toBe('تَعْتَدُو۠ا۟\u200c\u06da إِنَّ');
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

describe('coalesceForJoining', () => {
  // The boundary between "ٱلرَّ" (rule g) and "حْمَ" (no rule) is safe because
  // ra is a non-left-joining letter — Arabic naturally breaks the cursive run
  // there. The boundary between "حْمَ" and "ـٰ" (rule n) cuts mim-base from
  // its dagger-alif and would break joining; same for "ـٰ"→"نِ" which cuts
  // mim-noon. The unsafe seams collapse into a single segment, and because
  // the two sides disagree on rule the merged run drops the rule rather than
  // extending the madd colour onto the surrounding plain letters.
  it('merges mid-word rule boundaries that would break cursive joining', () => {
    const out = coalesceForJoining([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَ' },
      { text: 'ـٰ', rule: 'n' },
      { text: 'نِ' },
    ]);
    expect(out).toEqual([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَـٰنِ' },
    ]);
  });

  it('leaves whitespace-separated word boundaries alone', () => {
    const out = coalesceForJoining([
      { text: 'بِسْمِ ', rule: 'h' },
      { text: 'ٱللَّهِ' },
    ]);
    expect(out).toEqual([
      { text: 'بِسْمِ ', rule: 'h' },
      { text: 'ٱللَّهِ' },
    ]);
  });

  it('leaves boundaries after a non-left-joining letter alone', () => {
    // ر (ra) is right-joining only, so the cursive run is already broken
    // after it. The colour transition can survive as-is.
    const out = coalesceForJoining([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَـٰنِ' },
    ]);
    expect(out).toEqual([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَـٰنِ' },
    ]);
  });

  it('drops the rule when merging a coloured segment with an uncoloured one', () => {
    // فَمَ (no rule) → نِ (rule a). Mim joins to noon, so the boundary is
    // unsafe and must be merged to keep joining intact on Android. The
    // merged run loses the rule rather than extending the idgham colour
    // onto the leading "فَمَ" letters — narrow colouring beats extending
    // a rule's reach.
    const out = coalesceForJoining([
      { text: 'فَمَ' },
      { text: 'نِ', rule: 'a' },
    ]);
    expect(out).toEqual([{ text: 'فَمَنِ' }]);
  });

  it('keeps the rule when merging two segments that share it', () => {
    // Contiguous same-rule runs split mid-word by the source data merge
    // back into a single coloured run — the rule isn't dropped because
    // there's no disagreement to resolve.
    const out = coalesceForJoining([
      { text: 'بَ', rule: 'q' },
      { text: 'تِ', rule: 'q' },
    ]);
    expect(out).toEqual([{ text: 'بَتِ', rule: 'q' }]);
  });

  it('is a no-op on already-coalesced input (idempotent)', () => {
    const once = coalesceForJoining([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَـٰنِ' },
    ]);
    const twice = coalesceForJoining(once);
    expect(twice).toEqual(once);
  });

  it('returns identical output for empty input', () => {
    expect(coalesceForJoining([])).toEqual([]);
  });
});

describe('rebalanceCombiningMarks', () => {
  // The alquran.cloud edition closes its rule bracket after the base letter
  // but before the trailing harakah, so the fatha on fa lands in the next
  // plain segment. Without rebalancing, fa renders in its terminal form and
  // the fatha floats free on a baseline stub.
  it('moves a leading harakah from segment N onto the base letter in N-1', () => {
    const out = rebalanceCombiningMarks([
      { text: 'صٌ\u200c\u06da ف', rule: 'f' },
      { text: '\u064Eمَنِ' },
    ]);
    expect(out).toEqual([
      { text: 'صٌ\u200c\u06da ف\u064E', rule: 'f' },
      { text: 'مَنِ' },
    ]);
  });

  it('migrates a multi-mark cluster (shadda + kasra)', () => {
    const out = rebalanceCombiningMarks([
      { text: 'م', rule: 'g' },
      { text: '\u0651\u0650نَ' },
    ]);
    expect(out).toEqual([
      { text: 'م\u0651\u0650', rule: 'g' },
      { text: 'نَ' },
    ]);
  });

  it('drops segments that become empty after their marks are moved', () => {
    const out = rebalanceCombiningMarks([
      { text: 'ف', rule: 'f' },
      { text: '\u064E', rule: 'q' },
      { text: 'مَنِ' },
    ]);
    expect(out).toEqual([
      { text: 'ف\u064E', rule: 'f' },
      { text: 'مَنِ' },
    ]);
  });

  it('is a no-op when no segment starts with a combining mark', () => {
    const input = [
      { text: 'ٱلرَّ', rule: 'g' as const },
      { text: 'حْمَـٰنِ' },
    ];
    expect(rebalanceCombiningMarks(input)).toEqual(input);
  });

  it('returns an empty array for empty input', () => {
    expect(rebalanceCombiningMarks([])).toEqual([]);
  });
});

describe('parseTajweedForRender', () => {
  it('parses, rebalances, and joining-coalesces in one pass', () => {
    // End-to-end on the Ar-Rahman fragment: the inner madd-normal mark on
    // the dagger alif is sandwiched between joining letters, so coalescing
    // absorbs it into the surrounding run and drops the rule rather than
    // colouring the whole "حْمَـٰنِ" blue.
    const out = parseTajweedForRender('[g[ٱلرَّ]حْمَ[n[ـٰ]نِ');
    expect(out).toEqual([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَـٰنِ' },
    ]);
  });

  // Real Al-Baqarah 2:194 fragment: the ikhafa wraps the base fa but the
  // fatha lives in the trailing plain segment. Rebalance heals the cluster
  // onto fa; the fa→mim boundary is then unsafe so coalesce merges it and
  // drops the rule, producing one continuous "صٌ‌ۚ فَمَنِ" shape run.
  it('heals fa+fatha across a rule boundary (2:194 case)', () => {
    const out = parseTajweedForRender('[f[صٌ\u200c\u06da ف]\u064Eمَنِ');
    expect(out).toEqual([{ text: 'صٌ\u200c\u06da فَمَنِ' }]);
  });

  // With coalesce=false (the iOS path) the joining-coalesce pass is skipped,
  // so every rule colour is kept — CoreText joins cursively across nested
  // <Text> boundaries, so there is no shaping reason to drop the madd rule.
  it('keeps every rule colour when coalesce is disabled (iOS path)', () => {
    const out = parseTajweedForRender('[g[ٱلرَّ]حْمَ[n[ـٰ]نِ', false);
    expect(out).toEqual([
      { text: 'ٱلرَّ', rule: 'g' },
      { text: 'حْمَ' },
      { text: 'ـٰ', rule: 'n' },
      { text: 'نِ' },
    ]);
  });

  it('still heals split clusters when coalesce is disabled', () => {
    // rebalance always runs, so the fatha rejoins fa even on the iOS path —
    // but the ikhafa rule on fa is preserved rather than merged away.
    const out = parseTajweedForRender('[f[صٌ\u200c\u06da ف]\u064Eمَنِ', false);
    expect(out).toEqual([
      { text: 'صٌ\u200c\u06da ف\u064E', rule: 'f' },
      { text: 'مَنِ' },
    ]);
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
