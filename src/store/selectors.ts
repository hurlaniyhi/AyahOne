import { useMemo } from 'react';
import { useAppStore, type BucketStats } from './appStore';
import { todayKey, weekKey, monthKey, yearKey } from '@/lib/format';

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
