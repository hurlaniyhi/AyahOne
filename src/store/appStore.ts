import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { todayKey, weekKey, monthKey, yearKey } from '@/lib/format';
import type { AccentId } from '@/theme/palettes';
import type { AskMsg, TefseerReference, TefseerResult } from '@/lib/islamicAi';
import { DEFAULT_RECITER_ID } from '@/data/quranAudio';
import { nextHifzState, type HifzAyahState, type HifzGrade } from '@/lib/hifz';

// Cap on persisted chat history — generous enough for normal use, small
// enough that AsyncStorage stays under its per-key budget even when each
// model reply carries several references.
const ASK_HISTORY_CAP = 60;
// Cap on persisted recitation-practice attempts — enough to derive a
// meaningful "best score" per ayah without unbounded storage growth.
const RECITATION_HISTORY_CAP = 100;
// Cap on cached per-ayah tefseer results. Each entry is a small structured
// object; this keeps AsyncStorage bounded while still covering a long
// reading session without re-hitting the AI for ayahs already explained.
const TEFSEER_CACHE_CAP = 120;

export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'ar' | 'fr';
export type ArabicScript = 'uthmani' | 'indopak' | 'tajweed';
// 'page' (one Madinah-mushaf page a day) is intentionally not offered yet —
// it needs a page↔ayah index across the whole Qur'an, not just open surahs,
// which is a separate, not-yet-built data source (see HIFZ_ROADMAP.md).
export type HifzGoalType = 'whole' | 'surahs' | 'juzAmma';
const HIFZ_GOAL_TYPES: HifzGoalType[] = ['whole', 'surahs', 'juzAmma'];

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
  // alquran.cloud audio-edition id used for verse playback (see src/data/quranAudio.ts).
  reciterId: string;
  // Arabic body font size in px (continuous, clamped to ARABIC_FONT_MIN/MAX).
  arabicFontSize: number;
  showTranslation: boolean;
  showTransliteration: boolean;
  hideHasanat: boolean;
  showReadingLevel: boolean;
  // Master switch for local reminders (daily-goal nudge + Friday Al-Kahf
  // nudge). When false, syncReminders() cancels any pending schedules and
  // skips re-creating them. Defaults to true so reminders work out of the
  // box for users who grant the OS permission.
  notificationsEnabled: boolean;
  // User-customised reminder times in "HH:MM" 24-hour local form. Empty
  // string means "not customised yet"; the picker UI then opens at the
  // current wall-clock time and the scheduler falls back to 20:00 / 09:00
  // so reminders still fire if the user never opens the picker.
  goalReminderTime: string;
  kahfReminderTime: string;
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

// One completed "Practice Recitation" attempt, recorded after the user gets
// AI feedback on a spoken recitation of a specific ayah.
export interface RecitationAttempt {
  id: string;
  surah: number;
  ayah: number;
  score: number;
  date: string; // ISO timestamp
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
  // Whether the first-run walkthrough has been completed. Persisted so the
  // onboarding is shown exactly once, on the very first launch.
  onboardingComplete: boolean;
  lastRead: ReadingLocation | null;
  // Furthest ayah reached per surah, keyed by surah number (1-114). Lifetime
  // value; never resets. Useful for "ever-read" affordances but NOT for the
  // Friday Al-Kahf banner (which is a weekly devotional and must reset).
  surahProgress: Record<number, number>;
  // Today-scoped progress through Surah Al-Kahf, used by the Friday banner.
  // `date` is the todayKey() of the Friday the reading happened on; if the
  // current day's key differs, the banner treats progress as 0. `null` means
  // the user has never recorded Kahf reading on a Friday.
  kahfFriday: { date: string; ayah: number } | null;
  favorites: string[];  // "surah:ayah"
  bookmarks: string[];  // "surah:ayah"
  dailyGoalVerses: number;
  precache: PrecacheState;
  // Remembered Search query so the modal can be reopened with the same
  // results after the user has navigated into the reader and pressed back.
  // Intentionally NOT persisted to AsyncStorage — search state should be
  // ephemeral across app launches.
  lastSearchQuery: string;
  // todayKey() of the last day the user saw the daily-goal celebration.
  // Persisted so the modal fires AT MOST once per day even across cold
  // launches. Empty string means it has never been celebrated.
  lastGoalCelebrationDate: string;
  // Ephemeral flag set the moment today.verses crosses dailyGoalVerses for
  // the first time today. The root layout reads it to render the celebration
  // modal. Not persisted.
  celebrationVisible: boolean;
  // todayKey() of the last Friday the user saw the Surah Al-Kahf completion
  // celebration. Persisted so finishing Kahf on the same Friday across a
  // cold launch does not re-fire the modal.
  lastKahfCelebrationDate: string;
  // Ephemeral flag set the moment the user reaches ayah 110 of Surah Al-Kahf
  // on a Friday. The root layout reads it to render the Kahf celebration
  // modal. Not persisted.
  kahfCelebrationVisible: boolean;
  // Ask-AyahOne chat history. Capped to ASK_HISTORY_CAP on every append
  // so AsyncStorage stays bounded. Pending messages are dropped on hydrate.
  askHistory: AskMsg[];
  // Ephemeral request state. Not persisted: a crashed in-flight request
  // should not leave the UI permanently disabled.
  askSending: boolean;
  // Timestamp (ms) of the last accepted send. Used by the screen to enforce
  // a small cooldown that prevents accidental double-sends.
  askLastSendAt: number;
  // "Practice Recitation" attempt log, most recent last. Capped to
  // RECITATION_HISTORY_CAP on every append.
  recitationHistory: RecitationAttempt[];
  // Hifz (memorization) spaced-repetition state, keyed "surah:ayah". Absence
  // of a key means the ayah has never been reviewed.
  hifzProgress: Record<string, HifzAyahState>;
  // Consecutive days (including today) with at least one Hifz review.
  hifzStreakDays: number;
  // todayKey() of the last day a Hifz review was recorded. Empty string
  // means never. Used only to compute hifzStreakDays on the next review.
  hifzLastActivityDate: string;
  // Hifz goal wizard result. `null` type means the user hasn't set up a plan
  // yet — the hub shows a setup prompt instead of a "Today's Goal" card.
  hifzGoalType: HifzGoalType | null;
  hifzVersesPerDay: number;
  // Only meaningful when hifzGoalType === 'surahs'.
  hifzGoalSurahs: number[];
  // Free-text per-ayah notes ("similar to ayah 23", a pronunciation
  // reminder, ...), keyed "surah:ayah". Independent of hifzProgress — a
  // note can exist for an ayah regardless of its review/mastery state, and
  // survives a resetHifzAyah.
  hifzNotes: Record<string, string>;
  // Cached per-ayah tefseer (tafsir) results, keyed "surah:ayah:lang" so a
  // language switch fetches a fresh explanation rather than showing the
  // previous language's text. Capped to TEFSEER_CACHE_CAP on every write.
  tefseerCache: Record<string, TefseerResult>;

  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  setProfileName: (name: string) => void;
  setProfilePhoto: (uri: string | null) => void;
  completeOnboarding: () => void;
  setLastRead: (loc: ReadingLocation) => void;
  setDailyGoal: (n: number) => void;
  recordVerseRead: (hasanat: number, timeSec: number, pagesDelta: number) => void;
  recordSurahProgress: (surah: number, ayah: number) => void;
  toggleFavorite: (surah: number, ayah: number) => void;
  toggleBookmark: (surah: number, ayah: number) => void;
  setPrecache: (p: Partial<PrecacheState>) => void;
  setLastSearchQuery: (q: string) => void;
  dismissGoalCelebration: () => void;
  dismissKahfCelebration: () => void;
  // Ask-AyahOne actions
  appendAskMessages: (msgs: AskMsg[]) => void;
  updateAskMessage: (id: string, patch: Partial<AskMsg>) => void;
  clearAskHistory: () => void;
  setAskSending: (v: boolean) => void;
  setAskLastSendAt: (t: number) => void;
  addRecitationAttempt: (attempt: RecitationAttempt) => void;
  recordHifzReview: (surah: number, ayah: number, grade: HifzGrade) => void;
  resetHifzAyah: (surah: number, ayah: number) => void;
  setHifzGoal: (goal: { type: HifzGoalType; versesPerDay: number; surahs?: number[] }) => void;
  setHifzNote: (surah: number, ayah: number, text: string) => void;
  setTefseer: (key: string, result: TefseerResult) => void;
}

const STORAGE_KEY = 'ayahone:state:v1';

// Surah Al-Kahf has 110 ayahs. Mirrors the constant used by notifications and
// the home banner; kept local here so the celebration trigger is self-contained.
const KAHF_TOTAL_AYAH = 110;

const emptyBucket = (): BucketStats => ({ hasanat: 0, verses: 0, timeSec: 0, pages: 0 });

const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  accent: 'mihrab',
  language: 'en',
  translationId: 'en.sahih',
  reciterId: DEFAULT_RECITER_ID,
  arabicScript: 'uthmani',
  arabicFontSize: ARABIC_FONT_DEFAULT,
  showTranslation: true,
  showTransliteration: false,
  hideHasanat: false,
  showReadingLevel: true,
  notificationsEnabled: true,
  goalReminderTime: '',
  kahfReminderTime: '',
};

const DEFAULT_STATE = {
  settings: DEFAULT_SETTINGS,
  stats: { daily: {}, weekly: {}, monthly: {}, yearly: {}, total: emptyBucket() } as Stats,
  profile: { name: '', photoUri: null as string | null },
  onboardingComplete: false,
  lastRead: null as ReadingLocation | null,
  surahProgress: {} as Record<number, number>,
  kahfFriday: null as { date: string; ayah: number } | null,
  favorites: [] as string[],
  bookmarks: [] as string[],
  dailyGoalVerses: 10,
  precache: { running: false, loaded: 0, total: 0, error: null } as PrecacheState,
  lastSearchQuery: '',
  lastGoalCelebrationDate: '',
  celebrationVisible: false,
  lastKahfCelebrationDate: '',
  kahfCelebrationVisible: false,
  askHistory: [] as AskMsg[],
  askSending: false,
  askLastSendAt: 0,
  recitationHistory: [] as RecitationAttempt[],
  hifzProgress: {} as Record<string, HifzAyahState>,
  hifzStreakDays: 0,
  hifzLastActivityDate: '',
  hifzGoalType: null as HifzGoalType | null,
  hifzVersesPerDay: 2,
  hifzGoalSurahs: [] as number[],
  hifzNotes: {} as Record<string, string>,
  tefseerCache: {} as Record<string, TefseerResult>,
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
      onboardingComplete: state.onboardingComplete,
      lastRead: state.lastRead,
      surahProgress: state.surahProgress,
      kahfFriday: state.kahfFriday,
      favorites: state.favorites,
      bookmarks: state.bookmarks,
      dailyGoalVerses: state.dailyGoalVerses,
      lastGoalCelebrationDate: state.lastGoalCelebrationDate,
      lastKahfCelebrationDate: state.lastKahfCelebrationDate,
      // Strip pending model bubbles before persisting — they represent an
      // in-flight request that can no longer be resolved across reloads.
      askHistory: state.askHistory.filter(m => !m.pending),
      recitationHistory: state.recitationHistory,
      hifzProgress: state.hifzProgress,
      hifzStreakDays: state.hifzStreakDays,
      hifzLastActivityDate: state.hifzLastActivityDate,
      hifzGoalType: state.hifzGoalType,
      hifzVersesPerDay: state.hifzVersesPerDay,
      hifzGoalSurahs: state.hifzGoalSurahs,
      hifzNotes: state.hifzNotes,
      tefseerCache: state.tefseerCache,
    });
    await AsyncStorage.setItem(STORAGE_KEY, data);
  } catch {
    // ignore
  }
}

type Actions = Pick<AppState,
  'setSetting' | 'setProfileName' | 'setProfilePhoto' | 'completeOnboarding' | 'setLastRead' | 'setDailyGoal' |
  'recordVerseRead' | 'recordSurahProgress' | 'toggleFavorite' | 'toggleBookmark' |
  'setPrecache' | 'setLastSearchQuery' | 'dismissGoalCelebration' | 'dismissKahfCelebration' |
  'appendAskMessages' | 'updateAskMessage' | 'clearAskHistory' | 'setAskSending' | 'setAskLastSendAt' |
  'addRecitationAttempt' | 'recordHifzReview' | 'resetHifzAyah' | 'setHifzGoal' | 'setHifzNote' |
  'setTefseer'>;

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
  completeOnboarding: () => {
    set({ onboardingComplete: true });
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
      const prevTodayVerses = stats.daily[dk].verses;
      addTo(stats.daily[dk],   hasanat, timeSec, pagesDelta);
      addTo(stats.weekly[wk],  hasanat, timeSec, pagesDelta);
      addTo(stats.monthly[mk], hasanat, timeSec, pagesDelta);
      addTo(stats.yearly[yk],  hasanat, timeSec, pagesDelta);
      addTo(stats.total,       hasanat, timeSec, pagesDelta);
      // Fire the celebration exactly once on the day the user first reaches
      // their daily verse goal. prevTodayVerses < goal && new >= goal is the
      // edge; the date guard prevents re-triggering across hot-reloads or
      // cold launches the same day.
      const goal = s.dailyGoalVerses;
      const newTodayVerses = stats.daily[dk].verses;
      const crossed = prevTodayVerses < goal && newTodayVerses >= goal;
      const alreadyCelebratedToday = s.lastGoalCelebrationDate === dk;
      if (crossed && !alreadyCelebratedToday) {
        return { stats, celebrationVisible: true, lastGoalCelebrationDate: dk };
      }
      return { stats };
    });
    void persist(get());
  },
  recordSurahProgress: (surah, ayah) => {
    if (!Number.isFinite(surah) || !Number.isFinite(ayah) || ayah < 1) return;
    set(s => {
      const prev = s.surahProgress[surah] ?? 0;
      const grew = ayah > prev;
      // Friday-scoped Al-Kahf tracker. Only fires when the user is actually
      // reading Kahf (18) AND today is Friday (getDay() === 5). The date stamp
      // means last week's progress disappears the moment the calendar rolls
      // over, so the banner never shows stale lifetime progress.
      const isFridayKahf = surah === 18 && new Date().getDay() === 5;
      let kahfFriday = s.kahfFriday;
      const today = todayKey();
      const prevKahfAyahToday = kahfFriday && kahfFriday.date === today ? kahfFriday.ayah : 0;
      if (isFridayKahf) {
        if (!kahfFriday || kahfFriday.date !== today) {
          kahfFriday = { date: today, ayah };
        } else if (ayah > kahfFriday.ayah) {
          kahfFriday = { date: today, ayah };
        }
      }
      // Fire the Kahf celebration on the exact Friday the reader first reaches
      // ayah 110. Edge guard: prev<110 && new>=110. Date guard prevents the
      // modal re-firing across hot reloads or app re-opens the same Friday.
      const crossedKahf =
        isFridayKahf &&
        prevKahfAyahToday < KAHF_TOTAL_AYAH &&
        (kahfFriday?.ayah ?? 0) >= KAHF_TOTAL_AYAH;
      const alreadyCelebratedKahfToday = s.lastKahfCelebrationDate === today;
      const fireKahf = crossedKahf && !alreadyCelebratedKahfToday;
      if (!grew && kahfFriday === s.kahfFriday && !fireKahf) return s;
      return {
        surahProgress: grew ? { ...s.surahProgress, [surah]: ayah } : s.surahProgress,
        kahfFriday,
        ...(fireKahf
          ? { kahfCelebrationVisible: true, lastKahfCelebrationDate: today }
          : null),
      };
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
  dismissGoalCelebration: () => set({ celebrationVisible: false }),
  dismissKahfCelebration: () => set({ kahfCelebrationVisible: false }),
  appendAskMessages: (msgs) => {
    set(s => {
      const next = [...s.askHistory, ...msgs];
      // Keep the most recent ASK_HISTORY_CAP messages so storage stays small.
      const trimmed = next.length > ASK_HISTORY_CAP ? next.slice(next.length - ASK_HISTORY_CAP) : next;
      return { askHistory: trimmed };
    });
    void persist(get());
  },
  updateAskMessage: (id, patch) => {
    set(s => ({ askHistory: s.askHistory.map(m => m.id === id ? { ...m, ...patch } : m) }));
    void persist(get());
  },
  clearAskHistory: () => {
    set({ askHistory: [] });
    void persist(get());
  },
  setAskSending: (v) => set({ askSending: v }),
  setAskLastSendAt: (t) => set({ askLastSendAt: t }),
  addRecitationAttempt: (attempt) => {
    set(s => {
      const next = [...s.recitationHistory, attempt];
      const trimmed = next.length > RECITATION_HISTORY_CAP ? next.slice(next.length - RECITATION_HISTORY_CAP) : next;
      return { recitationHistory: trimmed };
    });
    void persist(get());
  },
  recordHifzReview: (surah, ayah, grade) => {
    const key = `${surah}:${ayah}`;
    const today = todayKey();
    set(s => {
      let streak = s.hifzStreakDays;
      let lastActivity = s.hifzLastActivityDate;
      if (lastActivity !== today) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        streak = lastActivity === todayKey(y) ? streak + 1 : 1;
        lastActivity = today;
      }
      return {
        hifzProgress: { ...s.hifzProgress, [key]: nextHifzState(s.hifzProgress[key], grade) },
        hifzStreakDays: streak,
        hifzLastActivityDate: lastActivity,
      };
    });
    void persist(get());
  },
  resetHifzAyah: (surah, ayah) => {
    const key = `${surah}:${ayah}`;
    set(s => {
      if (!(key in s.hifzProgress)) return s;
      const next = { ...s.hifzProgress };
      delete next[key];
      return { hifzProgress: next };
    });
    void persist(get());
  },
  setHifzGoal: (goal) => {
    set({
      hifzGoalType: goal.type,
      hifzVersesPerDay: Math.max(1, Math.floor(goal.versesPerDay)),
      hifzGoalSurahs: goal.type === 'surahs' ? (goal.surahs ?? []) : [],
    });
    void persist(get());
  },
  setHifzNote: (surah, ayah, text) => {
    const key = `${surah}:${ayah}`;
    const trimmed = text.trim();
    set(s => {
      if (!trimmed) {
        if (!(key in s.hifzNotes)) return s;
        const next = { ...s.hifzNotes };
        delete next[key];
        return { hifzNotes: next };
      }
      return { hifzNotes: { ...s.hifzNotes, [key]: trimmed } };
    });
    void persist(get());
  },
  setTefseer: (key, result) => {
    set(s => {
      const next = { ...s.tefseerCache, [key]: result };
      const keys = Object.keys(next);
      if (keys.length <= TEFSEER_CACHE_CAP) return { tefseerCache: next };
      // Drop the oldest entries (string keys preserve insertion order) so the
      // cache stays bounded, keeping the most recently explained ayahs.
      const trimmed: Record<string, TefseerResult> = {};
      for (const k of keys.slice(keys.length - TEFSEER_CACHE_CAP)) trimmed[k] = next[k];
      return { tefseerCache: trimmed };
    });
    void persist(get());
  },
}));

// Defensively filters incoming persisted Hifz data down to entries matching
// the current HifzAyahState shape — protects against an older on-device
// schema (e.g. the previous stepIndex-based version) producing entries
// missing `intervalDays`/`dueDate`, which would otherwise break every date
// comparison downstream (isDue, due-queue sorting, etc).
function sanitizeHifzProgress(raw: unknown): Record<string, HifzAyahState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, HifzAyahState> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as Partial<HifzAyahState> | null;
    if (v && typeof v.intervalDays === 'number' && typeof v.dueDate === 'string') {
      out[key] = v as HifzAyahState;
    }
  }
  return out;
}

// Filters persisted tefseer cache down to entries matching the current
// TefseerResult shape, so a malformed or older on-device entry can't crash
// the sheet renderer (which maps over reflections/references).
function sanitizeTefseerCache(raw: unknown): Record<string, TefseerResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, TefseerResult> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as Partial<TefseerResult> | null;
    if (v && typeof v.summary === 'string' && Array.isArray(v.reflections) && Array.isArray(v.references)) {
      out[key] = {
        summary: v.summary,
        context: typeof v.context === 'string' ? v.context : '',
        reflections: v.reflections.filter((r): r is string => typeof r === 'string'),
        references: v.references as TefseerReference[],
      };
    }
  }
  return out;
}

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
        onboardingComplete: data.onboardingComplete === true,
        lastRead: data.lastRead ?? null,
        surahProgress: data.surahProgress ?? {},
        kahfFriday: data.kahfFriday && typeof data.kahfFriday === 'object'
          && typeof data.kahfFriday.date === 'string'
          && typeof data.kahfFriday.ayah === 'number'
          ? data.kahfFriday : null,
        favorites: data.favorites ?? [],
        bookmarks: data.bookmarks ?? [],
        dailyGoalVerses: data.dailyGoalVerses ?? DEFAULT_STATE.dailyGoalVerses,
        lastGoalCelebrationDate: data.lastGoalCelebrationDate ?? '',
        lastKahfCelebrationDate: data.lastKahfCelebrationDate ?? '',
        // Strip pending messages on hydrate — they can never resolve now.
        askHistory: Array.isArray(data.askHistory) ? data.askHistory.filter((m: AskMsg) => !m.pending) : [],
        recitationHistory: Array.isArray(data.recitationHistory) ? data.recitationHistory : [],
        hifzProgress: sanitizeHifzProgress(data.hifzProgress),
        hifzStreakDays: typeof data.hifzStreakDays === 'number' ? data.hifzStreakDays : 0,
        hifzLastActivityDate: typeof data.hifzLastActivityDate === 'string' ? data.hifzLastActivityDate : '',
        hifzGoalType: HIFZ_GOAL_TYPES.includes(data.hifzGoalType) ? data.hifzGoalType : null,
        hifzVersesPerDay: typeof data.hifzVersesPerDay === 'number' && data.hifzVersesPerDay > 0
          ? data.hifzVersesPerDay : DEFAULT_STATE.hifzVersesPerDay,
        hifzGoalSurahs: Array.isArray(data.hifzGoalSurahs) ? data.hifzGoalSurahs.filter((n: unknown) => typeof n === 'number') : [],
        hifzNotes: data.hifzNotes && typeof data.hifzNotes === 'object' && !Array.isArray(data.hifzNotes) ? data.hifzNotes : {},
        tefseerCache: sanitizeTefseerCache(data.tefseerCache),
      });
    }
  } finally {
    useAppStore.setState({ hydrated: true });
  }
}
