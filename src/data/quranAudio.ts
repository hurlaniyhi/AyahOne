// Per-ayah recitation audio, sourced from alquran.cloud's audio editions —
// the exact same host and `/v1/surah/{surah}/{edition}` shape already used
// for every text edition in quranApi.ts, just with an audio edition id so
// each ayah object carries an `audio` mp3 URL instead of `text`.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Reciter {
  id: string;
  name: string;
  style: string;
}

// Adding a reciter later is just another entry here — nothing else in the
// app hardcodes reciter identity. Every id here is a long-standing
// alquran.cloud audio-edition identifier; the in-app preview button and the
// graceful retry/error UI (useTogglePlayback, VerseAudioListen) mean a wrong
// id surfaces as a friendly "couldn't load audio" message, not a crash.
export const RECITERS: Reciter[] = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', style: 'Murattal' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit Abdul Samad', style: 'Murattal' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', style: 'Murattal' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq Al-Minshawi', style: 'Murattal' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdul Rahman Al-Sudais', style: 'Murattal' },
  { id: 'ar.saoodshuraym', name: 'Saud Al-Shuraim', style: 'Murattal' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', style: 'Murattal' },
  { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', style: 'Murattal' },
  { id: 'ar.shaatree', name: 'Abu Bakr Al-Shatri', style: 'Murattal' },
  { id: 'ar.ahmedajamy', name: 'Ahmed Al-Ajmy', style: 'Murattal' },
];

export const DEFAULT_RECITER_ID = 'ar.alafasy';

const CACHE_PREFIX = 'surahAudio:v1:';
const memCache = new Map<string, string[]>();

function cacheKey(surah: number, reciterId: string): string {
  return `${CACHE_PREFIX}${surah}:${reciterId}`;
}

async function loadFromStorage(key: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

async function saveToStorage(key: string, urls: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(urls));
  } catch {
    // Ignore persistence failures; the in-memory cache still applies.
  }
}

// Returns mp3 URLs for every ayah of `surah` recited by `reciterId`, indexed
// by `numberInSurah - 1`.
export async function getSurahAudioUrls(surah: number, reciterId: string): Promise<string[]> {
  const key = cacheKey(surah, reciterId);
  const cached = memCache.get(key);
  if (cached) return cached;

  const stored = await loadFromStorage(key);
  if (stored) {
    memCache.set(key, stored);
    return stored;
  }

  const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/${reciterId}`);
  if (!res.ok) throw new Error(`Failed to fetch audio for surah ${surah} (${reciterId}): ${res.status}`);
  const json = await res.json();
  const ayahs = json?.data?.ayahs as Array<{ audio?: string }> | undefined;
  if (!ayahs) throw new Error('Malformed audio payload');
  const urls = ayahs.map(a => String(a.audio ?? ''));
  memCache.set(key, urls);
  void saveToStorage(key, urls);
  return urls;
}

export async function getAyahAudioUrl(surah: number, numberInSurah: number, reciterId: string): Promise<string> {
  const urls = await getSurahAudioUrls(surah, reciterId);
  const url = urls[numberInSurah - 1];
  if (!url) throw new Error(`No audio found for ${surah}:${numberInSurah} (${reciterId})`);
  return url;
}
