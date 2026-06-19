import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { todayKey, weekKey, monthKey, yearKey } from '@/lib/format';
import type { AccentId } from '@/theme/palettes';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'ar' | 'fr';
export type ArabicScript = 'uthmani' | 'indopak' | 'tajweed';

// Allowed range for the Arabic font-size slider, in px. Kept here so callers
// (read screen, settings preview) can clamp / map without re-declaring it.
export const ARABIC_FONT_MIN = 18;
export const ARABIC_FONT_MAX = 48;
export const ARABIC_FONT_DEFAULT = 28;

export interface Settings {
  themeMode: ThemeMode;
  accent: AccentId;
  language: AppLanguage;
  translationId: string;
  arabicScript: ArabicScript;
  // Arabic body font size in px (continuous, clamped to ARABIC_FONT_MIN/MAX).
  arabicFontSize: number;
  showTranslation: boolean;
  showTransliteration: boolean;
  hideHasanat: boolean;
  showReadingLevel: boolean;
}

export interface BucketStats {
  hasanat: number;
  verses: number;
  timeSec: number;
  pages: number;
}

export interface Stats {
  daily:   Record<string, BucketStats>;
  weekly:  Record<string, BucketStats>;
  monthly: Record<string, BucketStats>;
  yearly:  Record<string, BucketStats>;
  // Cumulative all-time
  total:   BucketStats;
}

export interface ReadingLocation {
  surah: number;
  ayah: number;
}

export interface PrecacheState {
  running: boolean;
  loaded: number;
  total: number;
  error: string | null;
}

export interface AppState {
  hydrated: boolean;
  settings: Settings;
  stats: Stats;
  profile: { name: string; photoUri: string | null };
  lastRead: ReadingLocation | null;
  // Furthest ayah reached per surah, keyed by surah number (1-114). Drives
  // surah-level progress affordances like the Friday Al-Kahf banner.
  surahProgress: Record<number, number>;
  favorites: string[];  // "surah:ayah"
  bookmarks: string[];  // "surah:ayah"
  dailyGoalVerses: number;
  precache: PrecacheState;
  // Remembered Search query so the modal can be reopened with the same
  // results after the user has navigated into the reader and pressed back.
  // Intentionally NOT persisted to AsyncStorage — search state should be
  // ephemeral across app launches.
  lastSearchQuery: string;

  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  setProfileName: (name: string) => void;
  setProfilePhoto: (uri: string | null) => void;
  setLastRead: (loc: ReadingLocation) => void;
  setDailyGoal: (n: number) => void;
  recordVerseRead: (hasanat: number, timeSec: number, pagesDelta: number) => void;
  recordSurahProgress: (surah: number, ayah: number) => void;
  toggleFavorite: (surah: number, ayah: number) => void;
  toggleBookmark: (surah: number, ayah: number) => void;
  setPrecache: (p: Partial<PrecacheState>) => void;
  setLastSearchQuery: (q: string) => void;
}

const STORAGE_KEY = 'ayahone:state:v1';

const emptyBucket = (): BucketStats => ({ hasanat: 0, verses: 0, timeSec: 0, pages: 0 });

const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  accent: 'mihrab',
  language: 'en',
  translationId: 'en.sahih',
  arabicScript: 'uthmani',
  arabicFontSize: ARABIC_FONT_DEFAULT,
  showTranslation: true,
  showTransliteration: false,
  hideHasanat: false,
  showReadingLevel: true,
};

const DEFAULT_STATE = {
  settings: DEFAULT_SETTINGS,
  stats: { daily: {}, weekly: {}, monthly: {}, yearly: {}, total: emptyBucket() } as Stats,
  profile: { name: '', photoUri: null as string | null },
  lastRead: null as ReadingLocation | null,
  surahProgress: {} as Record<number, number>,
  favorites: [] as string[],
  bookmarks: [] as string[],
  dailyGoalVerses: 10,
  precache: { running: false, loaded: 0, total: 0, error: null } as PrecacheState,
  lastSearchQuery: '',
};

function addTo(target: BucketStats, h: number, t: number, p: number) {
  target.hasanat += h;
  target.verses += 1;
  target.timeSec += t;
  target.pages += p;
}

async function persist(state: Omit<AppState, keyof Actions | 'hydrated'>) {
  try {
    const data = JSON.stringify({
      settings: state.settings,
      stats: state.stats,
      profile: state.profile,
      lastRead: state.lastRead,
      surahProgress: state.surahProgress,
      favorites: state.favorites,
      bookmarks: state.bookmarks,
      dailyGoalVerses: state.dailyGoalVerses,
    });
    await AsyncStorage.setItem(STORAGE_KEY, data);
  } catch {
    // ignore
  }
}

type Actions = Pick<AppState,
  'setSetting' | 'setProfileName' | 'setProfilePhoto' | 'setLastRead' | 'setDailyGoal' |
  'recordVerseRead' | 'recordSurahProgress' | 'toggleFavorite' | 'toggleBookmark'>;

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  ...DEFAULT_STATE,
  setSetting: (k, v) => {
    set(s => ({ settings: { ...s.settings, [k]: v } }));
    void persist(get());
  },
  setProfileName: name => {
    set(s => ({ profile: { ...s.profile, name } }));
    void persist(get());
  },
  setProfilePhoto: uri => {
    set(s => ({ profile: { ...s.profile, photoUri: uri } }));
    void persist(get());
  },
  setLastRead: loc => {
    set({ lastRead: loc });
    void persist(get());
  },
  setDailyGoal: n => {
    set({ dailyGoalVerses: Math.max(1, Math.floor(n)) });
    void persist(get());
  },
  recordVerseRead: (hasanat, timeSec, pagesDelta) => {
    const now = new Date();
    const dk = todayKey(now), wk = weekKey(now), mk = monthKey(now), yk = yearKey(now);
    set(s => {
      const stats: Stats = {
        daily:   { ...s.stats.daily },
        weekly:  { ...s.stats.weekly },
        monthly: { ...s.stats.monthly },
        yearly:  { ...s.stats.yearly },
        total:   { ...s.stats.total },
      };
      stats.daily[dk]   = { ...(stats.daily[dk]   ?? emptyBucket()) };
      stats.weekly[wk]  = { ...(stats.weekly[wk]  ?? emptyBucket()) };
      stats.monthly[mk] = { ...(stats.monthly[mk] ?? emptyBucket()) };
      stats.yearly[yk]  = { ...(stats.yearly[yk]  ?? emptyBucket()) };
      addTo(stats.daily[dk],   hasanat, timeSec, pagesDelta);
      addTo(stats.weekly[wk],  hasanat, timeSec, pagesDelta);
      addTo(stats.monthly[mk], hasanat, timeSec, pagesDelta);
      addTo(stats.yearly[yk],  hasanat, timeSec, pagesDelta);
      addTo(stats.total,       hasanat, timeSec, pagesDelta);
      return { stats };
    });
    void persist(get());
  },
  recordSurahProgress: (surah, ayah) => {
    if (!Number.isFinite(surah) || !Number.isFinite(ayah) || ayah < 1) return;
    set(s => {
      const prev = s.surahProgress[surah] ?? 0;
      if (ayah <= prev) return s;
      return { surahProgress: { ...s.surahProgress, [surah]: ayah } };
    });
    void persist(get());
  },
  toggleFavorite: (surah, ayah) => {
    const k = `${surah}:${ayah}`;
    set(s => ({
      favorites: s.favorites.includes(k) ? s.favorites.filter(x => x !== k) : [...s.favorites, k],
    }));
    void persist(get());
  },
  toggleBookmark: (surah, ayah) => {
    const k = `${surah}:${ayah}`;
    set(s => ({
      bookmarks: s.bookmarks.includes(k) ? s.bookmarks.filter(x => x !== k) : [...s.bookmarks, k],
    }));
    void persist(get());
  },
  setPrecache: (p) => set(s => ({ precache: { ...s.precache, ...p } })),
  setLastSearchQuery: (q) => set({ lastSearchQuery: q }),
}));

export async function hydrateAppStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Migrate the legacy enum-based Arabic font size ('small'/'medium'/…) to
      // the new continuous px value so users upgrading from older builds keep
      // a sensible default rather than getting a NaN font.
      const incomingSettings = data.settings ?? {};
      const rawSize = incomingSettings.arabicFontSize;
      if (typeof rawSize === 'string') {
        const legacy: Record<string, number> = { small: 22, medium: 28, large: 34, xlarge: 40 };
        incomingSettings.arabicFontSize = legacy[rawSize] ?? ARABIC_FONT_DEFAULT;
      } else if (typeof rawSize !== 'number' || Number.isNaN(rawSize)) {
        incomingSettings.arabicFontSize = ARABIC_FONT_DEFAULT;
      } else {
        incomingSettings.arabicFontSize = Math.max(
          ARABIC_FONT_MIN,
          Math.min(ARABIC_FONT_MAX, rawSize),
        );
      }
      useAppStore.setState({
        settings: { ...DEFAULT_SETTINGS, ...incomingSettings },
        stats: data.stats ?? DEFAULT_STATE.stats,
        profile: { ...DEFAULT_STATE.profile, ...(data.profile ?? {}) },
        lastRead: data.lastRead ?? null,
        surahProgress: data.surahProgress ?? {},
        favorites: data.favorites ?? [],
        bookmarks: data.bookmarks ?? [],
        dailyGoalVerses: data.dailyGoalVerses ?? DEFAULT_STATE.dailyGoalVerses,
      });
    }
  } finally {
    useAppStore.setState({ hydrated: true });
  }
}
