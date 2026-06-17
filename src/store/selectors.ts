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
