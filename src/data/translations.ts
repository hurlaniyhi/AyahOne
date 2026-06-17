// Available translation editions exposed in Settings → Account.
// Identifiers are alquran.cloud edition identifiers.
export interface TranslationOption {
  id: string;
  label: string;
  language: string;
}

export const TRANSLATIONS: TranslationOption[] = [
  { id: 'en.sahih', label: 'Saheeh International', language: 'English' },
  { id: 'en.pickthall', label: 'Pickthall', language: 'English' },
  { id: 'en.yusufali', label: 'Yusuf Ali', language: 'English' },
  { id: 'fr.hamidullah', label: 'Hamidullah', language: 'Français' },
  { id: 'es.cortes', label: 'Cortes', language: 'Español' },
  { id: 'tr.diyanet', label: 'Diyanet İşleri', language: 'Türkçe' },
  { id: 'ur.jalandhry', label: 'Jalandhry', language: 'اردو' },
  { id: 'id.indonesian', label: 'Bahasa Indonesia', language: 'Bahasa' },
];
