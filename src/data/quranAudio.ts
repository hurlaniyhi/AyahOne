// Per-ayah recitation audio, sourced from alquran.cloud's audio editions —
// the exact same host and `/v1/surah/{surah}/{edition}` shape already used
// for every text edition in quranApi.ts, just with an audio edition id so
// each ayah object carries an `audio` mp3 URL instead of `text`.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSurah } from './surahs';

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
  { id: 'ar.muhammadayyoub', name: 'Muhammad Ayyub', style: 'Murattal' },
];

export const DEFAULT_RECITER_ID = 'ar.alafasy';

const CACHE_PREFIX = 'surahAudio:v1:';
const memCache = new Map<string, string[]>();

function cacheKey(surah: number, reciterId: string): string {
  return `${CACHE_PREFIX}${surah}:${reciterId}`;
}

// everyayah.com fallback host. When alquran.cloud (primary metadata host and
// its cdn.islamic.network audio CDN) is unreachable, we synthesize per-ayah
// URLs from everyayah's deterministic scheme — no metadata fetch needed.
// Scheme: https://everyayah.com/data/{FOLDER}/{SSS}{AAA}.mp3 where SSS/AAA
// are the zero-padded 3-digit surah and ayah numbers (e.g. 001001.mp3).
// Folders below are verified (HTTP 200 for 001001.mp3) for each reciter id;
// where a reciter has no 128kbps set on everyayah, its highest available
// murattal bitrate is used instead.
const EVERYAYAH_FOLDERS: Record<string, string> = {
  'ar.alafasy': 'Alafasy_128kbps',
  'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
  'ar.husary': 'Husary_128kbps',
  'ar.minshawi': 'Minshawy_Murattal_128kbps',
  'ar.abdurrahmaansudais': 'Abdurrahmaan_As-Sudais_192kbps',
  'ar.saoodshuraym': 'Saood_ash-Shuraym_128kbps',
  'ar.mahermuaiqly': 'MaherAlMuaiqly128kbps',
  'ar.hudhaify': 'Hudhaify_128kbps',
  'ar.shaatree': 'Abu_Bakr_Ash-Shaatree_128kbps',
  'ar.ahmedajamy': 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net',
  'ar.muhammadayyoub': 'Muhammad_Ayyoub_128kbps',
};

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

// Deterministic everyayah URL for a single ayah. Returns null when the reciter
// has no everyayah mapping (so callers can skip the fallback for it).
function everyayahUrl(surah: number, ayah: number, reciterId: string): string | null {
  const folder = EVERYAYAH_FOLDERS[reciterId];
  if (!folder) return null;
  return `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

// Full everyayah URL array for a surah, indexed by numberInSurah - 1. Uses the
// bundled ayah count so no network fetch is required. Returns null when the
// reciter has no everyayah mapping or the surah count is unknown.
function everyayahSurahUrls(surah: number, reciterId: string): string[] | null {
  const folder = EVERYAYAH_FOLDERS[reciterId];
  const count = getSurah(surah)?.numberOfAyahs;
  if (!folder || !count) return null;
  return Array.from({ length: count }, (_, i) =>
    `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(i + 1)}.mp3`,
  );
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

// alquran.cloud can hang for 20s+ when its host/CDN is unreachable. Cap the
// primary fetch so the everyayah fallback takes over quickly instead of the
// user waiting through a long timeout (or hitting VerseAudioListen's 6s
// offline watchdog).
const PRIMARY_FETCH_TIMEOUT_MS = 4000;

async function fetchAlquranSurahUrls(surah: number, reciterId: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRIMARY_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}/${reciterId}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Failed to fetch audio for surah ${surah} (${reciterId}): ${res.status}`);
    const json = await res.json();
    const ayahs = json?.data?.ayahs as Array<{ audio?: string }> | undefined;
    if (!ayahs) throw new Error('Malformed audio payload');
    return ayahs.map(a => String(a.audio ?? ''));
  } finally {
    clearTimeout(timer);
  }
}

// A cached URL list is only usable if it actually has a URL for every ayah AND
// those URLs don't point at cdn.islamic.network — alquran.cloud's audio CDN,
// which is currently unreachable. Earlier app versions persisted those CDN URLs
// to storage, so a stale cache can otherwise resurface dead links and break
// playback even though the everyayah fallback would work. Treat such a cache as
// unusable so it gets re-synthesized from everyayah below.
function isUsableCache(urls: string[] | null, surah: number): boolean {
  if (!urls) return false;
  const count = getSurah(surah)?.numberOfAyahs;
  if (count && urls.length !== count) return false;
  return urls.every(u => u && !u.includes('cdn.islamic.network'));
}

// Returns mp3 URLs for every ayah of `surah` recited by `reciterId`, indexed
// by `numberInSurah - 1`. Tries alquran.cloud first; if that host is
// unreachable (or times out), falls back to everyayah.com's deterministic
// per-ayah scheme so playback still works during alquran.cloud outages.
export async function getSurahAudioUrls(surah: number, reciterId: string): Promise<string[]> {
  const key = cacheKey(surah, reciterId);
  const cached = memCache.get(key);
  if (cached && isUsableCache(cached, surah)) return cached;

  const stored = await loadFromStorage(key);
  if (isUsableCache(stored, surah)) {
    memCache.set(key, stored!);
    return stored!;
  }

  let urls: string[];
  try {
    urls = await fetchAlquranSurahUrls(surah, reciterId);
    // The primary host answered but still points at the dead CDN (or is
    // sparse) — prefer the working everyayah fallback when we have a mapping.
    if (!isUsableCache(urls, surah)) {
      const fallback = everyayahSurahUrls(surah, reciterId);
      if (fallback) urls = fallback;
    }
  } catch (err) {
    // Primary host failed. Synthesize from everyayah when we have a mapping;
    // otherwise re-throw so the caller's offline/error handling still applies.
    const fallback = everyayahSurahUrls(surah, reciterId);
    if (!fallback) throw err;
    urls = fallback;
  }
  memCache.set(key, urls);
  void saveToStorage(key, urls);
  return urls;
}

export async function getAyahAudioUrl(surah: number, numberInSurah: number, reciterId: string): Promise<string> {
  const urls = await getSurahAudioUrls(surah, reciterId);
  const url = urls[numberInSurah - 1];
  if (url) return url;
  // The surah list resolved but this specific ayah has no URL (e.g. a sparse
  // alquran.cloud payload). Try the deterministic everyayah URL before giving
  // up so a single missing entry doesn't break playback.
  const fallback = everyayahUrl(surah, numberInSurah, reciterId);
  if (fallback) return fallback;
  throw new Error(`No audio found for ${surah}:${numberInSurah} (${reciterId})`);
}

// A failed audio fetch is almost always a connectivity problem: recitation
// audio is never bundled, so the only reason getAyahAudioUrl throws (short of
// a bad reciter id) is that the alquran.cloud request couldn't reach the
// network. React Native surfaces that as a TypeError whose message contains
// "Network request failed"; treat that (and generic fetch/abort failures) as
// offline so the UI can show the connect-to-listen message instead of a
// generic error.
export function isOfflineError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('abort')
  );
}
