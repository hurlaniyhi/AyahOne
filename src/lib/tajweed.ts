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

// ---------------------------------------------------------------------------
// Android joining-preservation pass
// ---------------------------------------------------------------------------
// React Native renders each TajweedSegment as a nested <Text>. On Android the
// resulting Spannable is shaped by Paint/HarfBuzz, but the way ReactTextView
// chains its inner spans the cursive joining is broken at every nested-<Text>
// boundary that falls between two letters which should connect (e.g. fa-mim
// inside فَمَنِ when a rule wraps only the trailing noon). Splitting after a
// non-left-joining letter (ا د ر و ٱ …), after a whitespace, or before a
// hamza-on-the-line is visually safe because Arabic naturally breaks the
// cursive run at those points; everywhere else we coalesce the segments so
// the join survives. The later rule wins so the more specific colour is the
// one preserved on the merged run (rules accumulate forward through the
// recitation in the alquran.cloud edition).

// Right-joining-only consonants — they do NOT connect to the letter that
// follows them in the cursive run.
const NON_LEFT_JOINING = new Set<string>([
  '\u0621', // ء  hamza on the line (joins neither side)
  '\u0622', // آ  alif madda
  '\u0623', // أ  alif hamza above
  '\u0624', // ؤ  waw hamza
  '\u0625', // إ  alif hamza below
  '\u0627', // ا  alif
  '\u0629', // ة  taa marbuta
  '\u062F', // د  dal
  '\u0630', // ذ  dhal
  '\u0631', // ر  ra
  '\u0632', // ز  zay
  '\u0648', // و  waw
  '\u0671', // ٱ  alif wasla
]);

function isArabicLetter(code: number): boolean {
  return (code >= 0x0621 && code <= 0x064A) || (code >= 0x066E && code <= 0x06D3);
}

// Combining marks that sit on a base letter (harakat, dagger alif, small
// waqf signs) and do not themselves participate in cursive joining.
function isArabicMark(code: number): boolean {
  return (
    (code >= 0x064B && code <= 0x065F) ||
    code === 0x0670 ||
    (code >= 0x06D6 && code <= 0x06ED)
  );
}

// True iff the LAST consonant of `text` would join cursively to whatever
// letter follows it. Combining marks and tatweel are skipped so the decision
// is made on the actual base letter.
function endsJoinsLeft(text: string): boolean {
  for (let i = text.length - 1; i >= 0; i--) {
    const code = text.charCodeAt(i);
    if (code === 0x0640) return true;           // tatweel always joins
    if (isArabicMark(code)) continue;
    if (isArabicLetter(code)) return !NON_LEFT_JOINING.has(text[i]);
    return false;                                // whitespace / punctuation
  }
  return false;
}

// True iff the FIRST consonant of `text` would join cursively to the letter
// preceding it.
function startsJoinsRight(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x0640) return true;
    if (isArabicMark(code)) continue;
    if (isArabicLetter(code)) return code !== 0x0621;
    return false;
  }
  return false;
}

// Merges adjacent segments where the boundary would cut a cursive join. When
// the merged segments disagree on rule (including the rule-vs-no-rule case)
// the result is left UNCOLOURED — losing one rule highlight is preferable to
// extending a rule's colour onto letters that were originally plain, which
// is what users perceive as "more colour than the mushaf shows". Same-rule
// merges keep the rule so contiguous coloured runs stay intact.
export function coalesceForJoining(segments: TajweedSegment[]): TajweedSegment[] {
  const out: TajweedSegment[] = [];
  for (const seg of segments) {
    if (out.length === 0) { out.push({ ...seg }); continue; }
    const prev = out[out.length - 1];
    const wouldBreakJoin = endsJoinsLeft(prev.text) && startsJoinsRight(seg.text);
    if (wouldBreakJoin) {
      prev.text += seg.text;
      if (prev.rule !== seg.rule) prev.rule = undefined;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

// Migrates any leading combining marks of segment N onto the tail of segment
// N-1. The alquran.cloud tajweed edition wraps rule spans around the BASE
// LETTER (`[f[…ف]` ) and leaves the trailing harakah in the following plain
// segment, which splits the fa+fatha grapheme cluster across two <Text>
// elements. HarfBuzz on Android sees that as a broken cluster and renders the
// fatha as a stray mark on a baseline stub. Reuniting the cluster inside one
// segment is a prerequisite for the joining-coalesce pass below — without it
// the boundary check still treats the marks-only micro-segment as "safe" and
// leaves the broken cluster in place.
export function rebalanceCombiningMarks(segments: TajweedSegment[]): TajweedSegment[] {
  const out: TajweedSegment[] = segments.map(s => ({ ...s }));
  for (let i = 1; i < out.length; i++) {
    const cur = out[i];
    let cut = 0;
    while (cut < cur.text.length && isArabicMark(cur.text.charCodeAt(cut))) cut++;
    if (cut === 0) continue;
    out[i - 1].text += cur.text.slice(0, cut);
    cur.text = cur.text.slice(cut);
  }
  return out.filter(s => s.text.length > 0);
}

// Public entry point used by the reader. Two passes back-to-back:
//   1) rebalanceCombiningMarks heals fa+fatha / saad+kasra grapheme clusters
//      that the source data splits across a rule boundary.
//   2) coalesceForJoining then merges any remaining boundary that would still
//      cut a cursive join (fa→mim across a rule edge, mim→noon across the
//      idgham-then-ikhafa edge in "ةٌ مِّن صِيَامٍ", etc.). The rule is dropped
//      on the merged run because RN cannot colour a sub-range of a single
//      <Text> on Android without re-introducing the wrapper that broke
//      shaping in the first place.
export function parseTajweedForRender(text: string): TajweedSegment[] {
  return coalesceForJoining(rebalanceCombiningMarks(parseTajweed(text)));
}
