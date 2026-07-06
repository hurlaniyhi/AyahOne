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
