// Hasanat (reward) calculation: each Arabic letter in a verse counts as 10 hasanat.
// The Arabic letter ranges used here cover the basic Arabic block letters plus the
// extended letters that appear in Uthmani Quran orthography. Diacritics (harakat),
// tatweel (U+0640), and spaces are intentionally excluded so the count reflects
// letters only — consistent with the well-known Tirmidhi narration.
const ARABIC_LETTER_RE = /[\u0621-\u063F\u0641-\u064A\u0671-\u06D3]/g;

export function countArabicLetters(text: string): number {
  if (!text) return 0;
  const m = text.match(ARABIC_LETTER_RE);
  return m ? m.length : 0;
}

export function hasanatFor(text: string): number {
  return countArabicLetters(text) * 10;
}
