import { useMemo } from 'react';
import { useAppStore, type BucketStats } from './appStore';
import { todayKey, weekKey, monthKey, yearKey } from '@/lib/format';
import { SURAHS } from '@/data/surahs';
import { JUZ_STARTS, ayahsInJuz, juzForAyah } from '@/data/juz';

const TOTAL_QURAN_AYAHS = SURAHS.reduce((sum, s) => sum + s.numberOfAyahs, 0);

const empty: BucketStats = { hasanat: 0, verses: 0, timeSec: 0, pages: 0 };

export function useTodayStats(): BucketStats {
  return useAppStore(s => s.stats.daily[todayKey()] ?? empty);
}

export function useWeekStats(): BucketStats {
  return useAppStore(s => s.stats.weekly[weekKey()] ?? empty);
}

export function useMonthStats(): BucketStats {
  return useAppStore(s => s.stats.monthly[monthKey()] ?? empty);
}

export function useYearStats(): BucketStats {
  return useAppStore(s => s.stats.yearly[yearKey()] ?? empty);
}

export function useTotalStats(): BucketStats {
  return useAppStore(s => s.stats.total);
}

/**
 * Returns a vector of `days` daily values for the given metric, oldest→newest,
 * ending on today. Used for *unlabelled* sparklines on the StatRow cards.
 * Selects the stable `daily` record from the store and derives the slice via
 * useMemo so the returned array reference is stable across renders.
 *
 * NOTE: This series is chronological ("last N days"), NOT calendar-week
 * aligned. For the labelled M T W T F S S strip on Home use
 * `useWeekdaySeries` instead, otherwise the day labels won't line up with
 * the values they describe.
 */
export function useDailySeries(metric: keyof BucketStats, days = 7): number[] {
  const daily = useAppStore(s => s.stats.daily);
  return useMemo(() => {
    const out: number[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      out.push(daily[todayKey(d)]?.[metric] ?? 0);
    }
    return out;
  }, [daily, metric, days]);
}

/**
 * Pure date-math helper behind `useWeekdaySeries`. Exposed so the slot
 * computation can be unit-tested without a React renderer.
 *
 * Given a `daily` store keyed by todayKey() strings, a `metric`, and a
 * reference `now`, returns a 7-value vector indexed Mon(0)…Sun(6) for the
 * calendar week containing `now`. Days after `now` inside that same week
 * naturally read as 0 because they have no entry in `daily`.
 */
export function weekdaySeriesFor(
  daily: Record<string, BucketStats>,
  metric: keyof BucketStats,
  now: Date,
): number[] {
  const out: number[] = [];
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push(daily[todayKey(d)]?.[metric] ?? 0);
  }
  return out;
}

/**
 * Returns a 7-value vector aligned to the current calendar week, Monday→Sunday,
 * so it can be plotted directly against a fixed `['M','T','W','T','F','S','S']`
 * label strip. Days *after* today inside the current week are 0 (the user
 * cannot have read on a day that hasn't happened yet). The Monday anchor is
 * computed as `today - ((getDay()+6) % 7)` so Mon→0 … Sun→6 regardless of the
 * runtime's locale-default first-day-of-week.
 */
export function useWeekdaySeries(metric: keyof BucketStats): number[] {
  const daily = useAppStore(s => s.stats.daily);
  return useMemo(() => weekdaySeriesFor(daily, metric, new Date()), [daily, metric]);
}

/**
 * Best "Practice Recitation" score ever recorded for a given ayah, or `null`
 * if it has never been practiced. Drives the "practiced" tint on the mic
 * entry-point icon in the reader.
 */
export function useBestRecitationScore(surah: number, ayah: number): number | null {
  const history = useAppStore(s => s.recitationHistory);
  return useMemo(() => {
    let best: number | null = null;
    for (const a of history) {
      if (a.surah === surah && a.ayah === ayah && (best === null || a.score > best)) best = a.score;
    }
    return best;
  }, [history, surah, ayah]);
}

/**
 * Ayahs whose Hifz spaced-repetition `dueDate` has arrived, oldest-due
 * first. Powers the hub's "Due for Review" queue.
 */
export function useHifzDueQueue(limit?: number): { surah: number; ayah: number }[] {
  const progress = useAppStore(s => s.hifzProgress);
  return useMemo(() => {
    const today = todayKey();
    const due = Object.entries(progress)
      .filter(([, state]) => state.dueDate <= today)
      .sort((a, b) => a[1].dueDate.localeCompare(b[1].dueDate))
      .map(([key]) => {
        const [surah, ayah] = key.split(':').map(Number);
        return { surah, ayah };
      });
    return limit ? due.slice(0, limit) : due;
  }, [progress, limit]);
}

/**
 * Hifz progress for one surah. `memorized` counts any ayah with at least one
 * recorded review (regardless of strength tier); `mastered` counts only
 * those that have reached the 'mastered' tier — the hub can show either or
 * both depending on how much nuance a given view wants.
 */
export function useHifzSurahProgress(surah: number, totalAyahs: number): { memorized: number; mastered: number; total: number; percent: number } {
  const progress = useAppStore(s => s.hifzProgress);
  return useMemo(() => {
    let memorized = 0;
    let mastered = 0;
    for (let ayah = 1; ayah <= totalAyahs; ayah++) {
      const state = progress[`${surah}:${ayah}`];
      if (!state) continue;
      memorized++;
      if (state.strength === 'mastered') mastered++;
    }
    return { memorized, mastered, total: totalAyahs, percent: totalAyahs ? Math.round((memorized / totalAyahs) * 100) : 0 };
  }, [progress, surah, totalAyahs]);
}

/** Headline Hifz numbers for the hub header and the Reading-tab entry tile. */
export function useHifzOverallStats(): {
  totalMemorized: number; totalMastered: number; dueToday: number;
  completionPercent: number; streakDays: number;
} {
  const progress = useAppStore(s => s.hifzProgress);
  const streakDays = useAppStore(s => s.hifzStreakDays);
  return useMemo(() => {
    const today = todayKey();
    let totalMemorized = 0;
    let totalMastered = 0;
    let dueToday = 0;
    for (const state of Object.values(progress)) {
      totalMemorized++;
      if (state.strength === 'mastered') totalMastered++;
      if (state.dueDate <= today) dueToday++;
    }
    const completionPercent = TOTAL_QURAN_AYAHS
      ? Math.round((totalMastered / TOTAL_QURAN_AYAHS) * 1000) / 10 // one decimal place
      : 0;
    return { totalMemorized, totalMastered, dueToday, completionPercent, streakDays };
  }, [progress, streakDays]);
}

/**
 * Which juz (1-30) the user most recently worked on (by `lastReviewedAt`
 * across all Hifz progress), and how many of the 30 juz are fully
 * 'mastered'. `currentJuz` is `null` until at least one ayah has been
 * reviewed.
 */
export function useHifzJuzStats(): { currentJuz: number | null; juzCompleted: number } {
  const progress = useAppStore(s => s.hifzProgress);
  return useMemo(() => {
    let currentJuz: number | null = null;
    let latest = '';
    for (const [key, state] of Object.entries(progress)) {
      if (state.lastReviewedAt > latest) {
        latest = state.lastReviewedAt;
        const [surah, ayah] = key.split(':').map(Number);
        currentJuz = juzForAyah(surah, ayah);
      }
    }
    let juzCompleted = 0;
    for (let juz = 1; juz <= JUZ_STARTS.length; juz++) {
      const ayahs = ayahsInJuz(juz);
      if (ayahs.length > 0 && ayahs.every(({ surah, ayah }) => progress[`${surah}:${ayah}`]?.strength === 'mastered')) {
        juzCompleted++;
      }
    }
    return { currentJuz, juzCompleted };
  }, [progress]);
}

export interface HifzTodaysGoal {
  surah: number;
  startAyah: number;
  endAyah: number;
  target: number;
  doneToday: number;
}

/**
 * Today's new-memorization target, derived from the Hifz goal wizard
 * (`hifzGoalType`/`hifzVersesPerDay`/`hifzGoalSurahs`): the next run of
 * never-reviewed ayahs in the configured scope, capped at `versesPerDay`
 * ayahs and — deliberately — never crossing a surah boundary, so the
 * practice screen (which is always scoped to one surah) can open it
 * directly. Returns `null` when no goal has been set up yet, or when the
 * whole scope has already been touched.
 */
export function useHifzTodaysGoal(): HifzTodaysGoal | null {
  const goalType = useAppStore(s => s.hifzGoalType);
  const versesPerDay = useAppStore(s => s.hifzVersesPerDay);
  const goalSurahs = useAppStore(s => s.hifzGoalSurahs);
  const progress = useAppStore(s => s.hifzProgress);
  const verifyRecitation = useAppStore(s => s.hifzVerifyRecitation);
  const verified = useAppStore(s => s.hifzVerified);

  return useMemo(() => {
    if (!goalType) return null;

    const scope: { surah: number; ayah: number }[] = [];
    if (goalType === 'whole') {
      for (const surahMeta of SURAHS) {
        for (let ayah = 1; ayah <= surahMeta.numberOfAyahs; ayah++) scope.push({ surah: surahMeta.number, ayah });
      }
    } else if (goalType === 'surahs') {
      for (const surahNum of [...goalSurahs].sort((a, b) => a - b)) {
        const meta = SURAHS.find(x => x.number === surahNum);
        if (!meta) continue;
        for (let ayah = 1; ayah <= meta.numberOfAyahs; ayah++) scope.push({ surah: surahNum, ayah });
      }
    } else {
      scope.push(...ayahsInJuz(30)); // Juz Amma
    }

    // When verification is on, an ayah only counts as "done" once its
    // recitation has also been verified — so a memorized-but-unverified run
    // stays the current goal, and leaving the verification screen and coming
    // back re-opens the same range instead of skipping ahead.
    const isDone = ({ surah, ayah }: { surah: number; ayah: number }) =>
      !!progress[`${surah}:${ayah}`] && (!verifyRecitation || !!verified[`${surah}:${ayah}`]);

    const firstNewIndex = scope.findIndex(a => !isDone(a));
    if (firstNewIndex === -1) return null;

    const start = scope[firstNewIndex];
    let endAyah = start.ayah;
    let count = 1;
    for (let i = firstNewIndex + 1; i < scope.length && count < versesPerDay; i++) {
      const next = scope[i];
      if (next.surah !== start.surah) break;
      if (isDone(next)) break;
      endAyah = next.ayah;
      count++;
    }

    const today = todayKey();
    let doneToday = 0;
    for (let a = start.ayah; a <= endAyah; a++) {
      const st = progress[`${start.surah}:${a}`];
      if (st && todayKey(new Date(st.lastReviewedAt)) === today) doneToday++;
    }

    return { surah: start.surah, startAyah: start.ayah, endAyah, target: versesPerDay, doneToday };
  }, [goalType, versesPerDay, goalSurahs, progress, verifyRecitation, verified]);
}

/**
 * The ayahs graded "Forgotten" most often, most-forgotten first. Excludes
 * anything with zero lapses — this is a "what needs extra attention" list,
 * not a full inventory.
 */
export function useHifzMostForgotten(limit = 10): { surah: number; ayah: number; lapses: number }[] {
  const progress = useAppStore(s => s.hifzProgress);
  return useMemo(() => {
    return Object.entries(progress)
      .filter(([, state]) => state.lapses > 0)
      .map(([key, state]) => {
        const [surah, ayah] = key.split(':').map(Number);
        return { surah, ayah, lapses: state.lapses };
      })
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, limit);
  }, [progress, limit]);
}
