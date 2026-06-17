import type { SurahContent } from './quranApi';

// Embedded fallback so the app can render verses offline if the network is
// unavailable. Currently includes only Al-Fatiha; the rest is fetched on demand.
export const FALLBACK: Record<number, SurahContent> = {
  1: {
    number: 1,
    ayahs: [
      { numberInSurah: 1, arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
        transliteration: 'Bismillahir-Rahmanir-Raheem' },
      { numberInSurah: 2, arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ',
        translation: '[All] praise is [due] to Allah, Lord of the worlds.',
        transliteration: 'Alhamdu lillahi Rabbil-alameen' },
      { numberInSurah: 3, arabic: 'ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
        translation: 'The Entirely Merciful, the Especially Merciful,',
        transliteration: 'Ar-Rahmanir-Raheem' },
      { numberInSurah: 4, arabic: 'مَـٰلِكِ يَوْمِ ٱلدِّينِ',
        translation: 'Sovereign of the Day of Recompense.',
        transliteration: 'Maliki yawmid-deen' },
      { numberInSurah: 5, arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
        translation: 'It is You we worship and You we ask for help.',
        transliteration: 'Iyyaka na\'budu wa iyyaka nasta\'een' },
      { numberInSurah: 6, arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
        translation: 'Guide us to the straight path.',
        transliteration: 'Ihdinas-siratal-mustaqeem' },
      { numberInSurah: 7, arabic: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
        translation: 'The path of those upon whom You have bestowed favor, not of those who have evoked [Your] anger or of those who are astray.',
        transliteration: 'Siratal-lazeena an\'amta alayhim, ghayril-maghdoobi alayhim wa lad-dalleen' },
    ],
  },
};
