// Standard 30-part (Juz') division of the Qur'an — the first ayah of each
// juz, matching the division used in virtually every printed mushaf.
// NOTE: recalled from general reference knowledge, not machine-verified
// against a live source. If a boundary ever looks off by one ayah against a
// physical mushaf, this is the table to correct — nothing downstream
// hardcodes these numbers elsewhere.
import { SURAHS } from './surahs';

export interface JuzStart {
  juz: number;
  surah: number;
  ayah: number;
}

export const JUZ_STARTS: JuzStart[] = [
  { juz: 1, surah: 1, ayah: 1 },
  { juz: 2, surah: 2, ayah: 142 },
  { juz: 3, surah: 2, ayah: 253 },
  { juz: 4, surah: 3, ayah: 93 },
  { juz: 5, surah: 4, ayah: 24 },
  { juz: 6, surah: 4, ayah: 148 },
  { juz: 7, surah: 5, ayah: 82 },
  { juz: 8, surah: 6, ayah: 111 },
  { juz: 9, surah: 7, ayah: 88 },
  { juz: 10, surah: 8, ayah: 41 },
  { juz: 11, surah: 9, ayah: 93 },
  { juz: 12, surah: 11, ayah: 6 },
  { juz: 13, surah: 12, ayah: 53 },
  { juz: 14, surah: 15, ayah: 1 },
  { juz: 15, surah: 17, ayah: 1 },
  { juz: 16, surah: 18, ayah: 75 },
  { juz: 17, surah: 21, ayah: 1 },
  { juz: 18, surah: 23, ayah: 1 },
  { juz: 19, surah: 25, ayah: 21 },
  { juz: 20, surah: 27, ayah: 56 },
  { juz: 21, surah: 29, ayah: 46 },
  { juz: 22, surah: 33, ayah: 31 },
  { juz: 23, surah: 36, ayah: 28 },
  { juz: 24, surah: 39, ayah: 32 },
  { juz: 25, surah: 41, ayah: 47 },
  { juz: 26, surah: 46, ayah: 1 },
  { juz: 27, surah: 51, ayah: 31 },
  { juz: 28, surah: 58, ayah: 1 },
  { juz: 29, surah: 67, ayah: 1 },
  { juz: 30, surah: 78, ayah: 1 },
];

/** Which juz (1-30) a given ayah falls in. */
export function juzForAyah(surah: number, ayah: number): number {
  let result = 1;
  for (const j of JUZ_STARTS) {
    if (j.surah < surah || (j.surah === surah && j.ayah <= ayah)) result = j.juz;
    else break;
  }
  return result;
}

/** Every {surah, ayah} pair contained in the given juz (1-30), in order. */
export function ayahsInJuz(juz: number): { surah: number; ayah: number }[] {
  const start = JUZ_STARTS[juz - 1];
  const end = JUZ_STARTS[juz]; // undefined for juz 30 — runs to the end of the Qur'an
  if (!start) return [];

  const out: { surah: number; ayah: number }[] = [];
  let s = start.surah;
  let a = start.ayah;
  while (s <= 114) {
    if (end && (s > end.surah || (s === end.surah && a >= end.ayah))) break;
    out.push({ surah: s, ayah: a });
    const meta = SURAHS.find(x => x.number === s);
    if (!meta) break;
    if (a >= meta.numberOfAyahs) { s += 1; a = 1; } else { a += 1; }
  }
  return out;
}
