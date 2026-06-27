// Parser and color palette for the alquran.cloud `quran-tajweed` edition.
//
// The edition wraps ranges of the Uthmani text in bracket tags. The common
// shape is `[X[content]` or `[X:NUM[content]` where X is a single lowercase
// letter encoding a tajweed rule:
//
//   h ham_wasl              n madda_normal         q qalaqah
//   s silent                p madda_permissible    c ikhafa_shafawi
//   l laam_shamsiyah        m madda_necessary      f ikhafa
//   o madda_obligatory      w iqlab                i idgham_shafawi
//   a idgham_w_ghunnah      u idgham_no_ghunnah    d idgham_mutajanisayn
//   b idgham_mutaqaribayn   g ghunnah

export type TajweedRule =
  | 'h' | 's' | 'l' | 'n' | 'p' | 'm' | 'o'
  | 'q' | 'c' | 'f' | 'w' | 'i' | 'a' | 'u'
  | 'd' | 'b' | 'g';

export interface TajweedSegment {
  text: string;
  rule?: TajweedRule;
}

// Standard tanzil.net / Quranic-Universal-Library color set, slightly tuned
// for legibility on both light and dark mushaf cards.
export const TAJWEED_COLORS: Record<TajweedRule, string> = {
  h: '#AAAAAA', s: '#AAAAAA', l: '#AAAAAA',
  n: '#537FFF', p: '#4050E0', m: '#000EBC', o: '#2144C1',
  q: '#DD0008',
  c: '#D500B7', f: '#9400A8',
  w: '#26BFFD',
  i: '#58B800', a: '#169200', u: '#169777',
  d: '#A1A1A1', b: '#A1A1A1',
  g: '#FF7E1E',
};

export const TAJWEED_LABELS: Record<TajweedRule, string> = {
  h: 'Hamzat al-Wasl', s: 'Silent', l: 'Lam Shamsiyyah',
  n: 'Madd 2', p: 'Madd 4-5', m: 'Madd 6', o: 'Madd Obligatory',
  q: 'Qalqalah',
  c: 'Ikhfa Shafawi', f: 'Ikhfa',
  w: 'Iqlab',
  i: 'Idgham Shafawi', a: 'Idgham w/ Ghunnah', u: 'Idgham no Ghunnah',
  d: 'Idgham Mutajanisayn', b: 'Idgham Mutaqaribayn',
  g: 'Ghunnah',
};

// Order used by the on-screen legend so related rules sit next to each other.
export const TAJWEED_LEGEND_ORDER: TajweedRule[] = [
  'h', 's', 'l', 'g', 'q', 'w',
  'n', 'p', 'm', 'o',
  'f', 'c', 'i', 'a', 'u', 'd', 'b',
];

const RULE_CHARS = 'hslnpmoqcfwiaudbg';
const RULE_CHAR_RE = /[hslnpmoqcfwiaudbg]/i;
// Detector regex \u2014 only used by hasTajweedMarkup() to quickly tell whether
// an ayah carries any rule markup at all. The real parser is hand-rolled
// below because the edition emits NESTED tags (e.g. Al-Baqarah 2:190 contains
// `[o[\u064f\u0648\u0653[s[\u0627\u0652]\u200c\u06da]` \u2014 a silent rule inside a madd-obligatory rule)
// which a single non-recursive regex cannot describe.
const TAG_RE = new RegExp(
  `\\[([${RULE_CHARS}])(?::\\d+)?(?:\\[|\\])`,
  'gi',
);

interface OpeningTag {
  rule: TajweedRule;
  end: number;             // index of the character AFTER the consumed opener
  kind: 'wrapped' | 'bare';
}

// Tries to match a tajweed opener starting at `i`. Returns the parsed tag or
// `null` if the position is not a recognised opener. Recognises:
//   [X[      [X:NUM[       \u2014 wrapped rule, content runs until its matching ]
//   [X]      [X:NUM]       \u2014 bare positional marker (sakta / waqf, no content)
// X is a single rule letter (case-insensitive). Unknown letters or non-numeric
// suffixes cause this to bail out so the surrounding text is preserved.
function matchOpeningTag(text: string, i: number): OpeningTag | null {
  if (text.charCodeAt(i) !== 0x5b /* [ */) return null;
  let p = i + 1;
  const letter = text[p];
  if (!letter || !RULE_CHAR_RE.test(letter)) return null;
  const rule = letter.toLowerCase() as TajweedRule;
  p++;
  if (text[p] === ':') {
    p++;
    const numStart = p;
    while (p < text.length && text[p] >= '0' && text[p] <= '9') p++;
    if (p === numStart) return null;
  }
  if (text[p] === '[') return { rule, end: p + 1, kind: 'wrapped' };
  if (text[p] === ']') return { rule, end: p + 1, kind: 'bare' };
  return null;
}

// Stack-based parser that honours nested tags. The innermost rule wins when
// a span is wrapped by more than one (e.g. the `silent` letters inside a
// `madd_obligatory` span render in the silent colour, which matches every
// reference mushaf). Plain text outside any tag has `rule` undefined.
export function parseTajweed(text: string): TajweedSegment[] {
  const segments: TajweedSegment[] = [];
  const stack: TajweedRule[] = [];
  let buf = '';

  const flush = () => {
    if (!buf) return;
    const rule = stack.length ? stack[stack.length - 1] : undefined;
    segments.push(rule ? { text: buf, rule } : { text: buf });
    buf = '';
  };

  let i = 0;
  while (i < text.length) {
    const tag = matchOpeningTag(text, i);
    if (tag) {
      flush();
      if (tag.kind === 'wrapped') stack.push(tag.rule);
      i = tag.end;
      continue;
    }
    if (text[i] === ']' && stack.length > 0) {
      flush();
      stack.pop();
      i++;
      continue;
    }
    buf += text[i];
    i++;
  }
  flush();
  return segments;
}

// Strips all tajweed brackets, leaving just the underlying Arabic text. Used
// when we need a clean string for hasanat counting or search indexing. Uses
// the same stack-walker as parseTajweed so nested tags are fully consumed.
export function stripTajweed(text: string): string {
  let out = '';
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const tag = matchOpeningTag(text, i);
    if (tag) {
      if (tag.kind === 'wrapped') depth++;
      i = tag.end;
      continue;
    }
    if (text[i] === ']' && depth > 0) {
      depth--;
      i++;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

export function hasTajweedMarkup(text: string): boolean {
  TAG_RE.lastIndex = 0;
  return TAG_RE.test(text);
}
