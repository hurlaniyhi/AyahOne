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
 * ending on today. Used to draw sparklines and the StreakBars chart.
 * Selects the stable `daily` record from the store and derives the slice via
 * useMemo so the returned array reference is stable across renders.
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
