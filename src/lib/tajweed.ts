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
const TAG_RE = new RegExp(`\\[([${RULE_CHARS}])(?::\\d+)?\\[([^\\]]*)\\]`, 'g');

export function parseTajweed(text: string): TajweedSegment[] {
  const segments: TajweedSegment[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ text: text.slice(lastIdx, m.index) });
    }
    segments.push({ text: m[2], rule: m[1] as TajweedRule });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    segments.push({ text: text.slice(lastIdx) });
  }
  return segments;
}

// Strips all tajweed brackets, leaving just the underlying Arabic text. Used
// when we need a clean string for hasanat counting or search indexing.
export function stripTajweed(text: string): string {
  return text.replace(TAG_RE, '$2');
}

export function hasTajweedMarkup(text: string): boolean {
  TAG_RE.lastIndex = 0;
  return TAG_RE.test(text);
}
