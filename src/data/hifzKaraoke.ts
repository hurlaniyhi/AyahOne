// Per-word audio timestamps for Hifz karaoke word-sync, sourced from QUL
// (Quranic Universal Library, Tarteel AI) exports and preprocessed by
// scripts/build-hifz-karaoke-data.mjs into the per-surah files this module
// reads. This is local bundled data, not a network fetch — unlike
// quranAudio.ts's alquran.cloud calls, everything here is synchronous.
//
// Only some reciters (and, within a reciter, only some surahs/ayahs) have
// karaoke data — `getKaraokeAyahData` returning null is the expected,
// non-error case for "no data here," and callers should fall back to the
// existing non-karaoke HifzAudioPlayer rather than showing an error state.

import { KARAOKE_SURAH_MODULES } from './hifzKaraokeManifest';

export interface RawKaraokeAyah {
  audioUrl: string;
  durationMs: number;
  segments: [number, number, number][]; // [wordIndex, startMs, endMs], 1-based word index
}

export type RawKaraokeSurah = Record<string, RawKaraokeAyah>; // keyed by ayah number as string

export interface KaraokeSegment {
  wordIndex: number;
  startMs: number;
  endMs: number;
}

export interface KaraokeAyahData {
  audioUrl: string;
  durationMs: number;
  segments: KaraokeSegment[];
}

export function hasKaraokeSurah(reciterId: string, surah: number): boolean {
  return Boolean(KARAOKE_SURAH_MODULES[reciterId]?.[surah]);
}

const surahCache = new Map<string, RawKaraokeSurah | null>();

function loadSurah(reciterId: string, surah: number): RawKaraokeSurah | null {
  const cacheKey = `${reciterId}:${surah}`;
  if (surahCache.has(cacheKey)) return surahCache.get(cacheKey)!;

  const loader = KARAOKE_SURAH_MODULES[reciterId]?.[surah];
  let data: RawKaraokeSurah | null = null;
  if (loader) {
    try {
      data = loader();
    } catch {
      data = null;
    }
  }
  surahCache.set(cacheKey, data);
  return data;
}

// Synchronous — this is local bundled data, not a network fetch. Returns
// null whenever the reciter has no karaoke data at all, this surah has none,
// or this specific ayah has no segment entry (all real, expected cases —
// most reciters and any not-yet-generated surah/ayah fall in here).
export function getKaraokeAyahData(reciterId: string, surah: number, ayah: number): KaraokeAyahData | null {
  const surahData = loadSurah(reciterId, surah);
  const raw = surahData?.[String(ayah)];
  if (!raw) return null;
  return {
    audioUrl: raw.audioUrl,
    durationMs: raw.durationMs,
    segments: raw.segments.map(([wordIndex, startMs, endMs]) => ({ wordIndex, startMs, endMs })),
  };
}
