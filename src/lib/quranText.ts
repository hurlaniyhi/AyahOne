import type { ArabicScript } from '@/store/appStore';

// Maps the selected script to the loaded font family. Both fonts are bundled
// via @expo-google-fonts and registered in app/_layout.tsx.
//   - Uthmani  → Amiri Quran (mushaf-style naskh tuned for the Madinah text)
//   - IndoPak  → Scheherazade New (heavier naskh closer to South-Asian style)
export function arabicFontFor(script: ArabicScript): string {
  return script === 'indopak' ? 'ScheherazadeNew_400Regular' : 'AmiriQuran_400Regular';
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
