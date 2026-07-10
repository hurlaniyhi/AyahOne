import { Platform } from 'react-native';
import type { ArabicScript } from '@/store/appStore';

// Maps the selected script to the loaded font family. Both fonts are bundled
// via @expo-google-fonts and registered in app/_layout.tsx.
//   - Uthmani  → Amiri Quran (mushaf-style naskh tuned for the Madinah text)
//   - IndoPak  → Scheherazade New (heavier naskh closer to South-Asian style)
export function arabicFontFor(script: ArabicScript): string {
  return script === 'indopak' ? 'ScheherazadeNew_400Regular' : 'AmiriQuran_400Regular';
}

// Single source of truth for Arabic line-height across every surface that
// renders Quranic text (reader, recitation screen, settings previews).
// Qur'anic diacritic stacks (shadda + tanween/madda + waqf marks) sit
// noticeably taller than the base glyph, and Android's tighter line metrics
// clip that stack — plus any letter descenders (ب ت ث ن ي) — well before a
// "typical" 1.2–1.5× line-height would. These multipliers were widened after
// clipping still showed up at 2.5×/2× on more than one screen; if it recurs
// again, raise these rather than re-deriving a one-off value per screen.
export function arabicLineHeight(fontSize: number): number {
  return Math.round(fontSize * (Platform.OS === 'android' ? 3 : 2.3));
}

// Converts ASCII digits to Arabic-Indic digits (٠١٢…). Used for ayah numbers
// inside the end-of-verse rosette so they render in the same calligraphic
// font as the surrounding text.
const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export function toArabicDigits(n: number): string {
  return String(n).replace(/[0-9]/g, d => ARABIC_INDIC[+d]);
}

// Appends the standard end-of-ayah ornament (U+06DD) followed by the verse
// number. With a Quranic font installed, this composes into the familiar
// circular rosette glyph.
export function withAyahMarker(arabic: string, verseNumber: number): string {
  return `${arabic} \u06DD${toArabicDigits(verseNumber)}`;
}

// Some Uthmani text sources (including the one quranApi.ts fetches from)
// embed the Bismillah as a literal prefix of ayah 1's own text for every
// surah except Al-Fatihah (1, where it IS ayah 1) and At-Tawbah (9, which
// has none) \u2014 rather than treating it as separate, non-enumerated text.
// Hifz mode's QUL karaoke word-timestamp data takes the opposite convention:
// word 1 there is always the surah's own first word, Bismillah excluded
// entirely. Any word array driven by that timing data must have this prefix
// stripped first, or every highlight lands a full Bismillah (4 words) early.
// Comparison strips harakat/tatweel and folds alef variants so it survives
// differences in exact diacritic encoding between sources.
const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ALEF_VARIANTS_RE = /[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g;
function bismillahSkeleton(word: string): string {
  return word.replace(ALEF_VARIANTS_RE, '\u0627').replace(ARABIC_DIACRITICS_RE, '');
}
const BISMILLAH_SKELETON = ['\u0628\u0633\u0645', '\u0627\u0644\u0644\u0647', '\u0627\u0644\u0631\u062D\u0645\u0646', '\u0627\u0644\u0631\u062D\u064A\u0645'];

// Strips a detected Bismillah prefix from an already-split word array.
// Returns the input unchanged if the first words don't match \u2014 safe to call
// even when the source text turns out not to embed Bismillah after all.
export function stripBismillahPrefix(words: string[]): string[] {
  if (words.length <= BISMILLAH_SKELETON.length) return words;
  const isBismillah = BISMILLAH_SKELETON.every((skeleton, i) => bismillahSkeleton(words[i]) === skeleton);
  return isBismillah ? words.slice(BISMILLAH_SKELETON.length) : words;
}

// Tanzil-style Uthmani sources (the one quranApi.ts fetches) space-separate the
// small waqf/pause marks (\u06D6-\u06DC), sajda and rub-el-hizb marks as their
// own whitespace tokens. QUL's word-by-word karaoke timing never counts these
// as words, so a raw split(/\s+/) yields phantom "word" tiles that shift every
// highlight after the mark forward. A token that is nothing but such marks
// (harakat / dagger-alef / tatweel included) is not a real word; real words
// keep at least one base letter and pass unchanged.
const WORD_TOKEN_MARKS_RE = /[\u064B-\u065F\u0670\u06D4\u06D6-\u06ED\u0640]/g;
export function isQuranWordToken(token: string): boolean {
  return token.replace(WORD_TOKEN_MARKS_RE, '').trim().length > 0;
}
