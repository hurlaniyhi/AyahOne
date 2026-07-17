import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { weekdaySeriesFor, useHifzTodaysGoal, type HifzTodaysGoal } from '../selectors';
import { todayKey } from '@/lib/format';
import { useAppStore, type BucketStats } from '../appStore';
import type { HifzAyahState } from '@/lib/hifz';

// Helper: build a daily map where the seven days of the calendar week
// containing `anchor` are keyed Mon..Sun with the supplied verses counts.
function buildWeek(anchor: Date, verses: [number, number, number, number, number, number, number]): Record<string, BucketStats> {
  const daysSinceMonday = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - daysSinceMonday);
  const out: Record<string, BucketStats> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out[todayKey(d)] = { verses: verses[i], hasanat: 0, timeSec: 0, pages: 0 };
  }
  return out;
}

describe('weekdaySeriesFor', () => {
  // Saturday 2025-06-28 — Mon..Sun = Jun 23..29. The week is fully populated
  // in the daily map; the selector should return them in Mon..Sun order
  // regardless of `now` falling mid-week.
  it('aligns values to Mon..Sun for a Saturday anchor', () => {
    const sat = new Date(2025, 5, 28); // 2025-06-28 (Sat)
    const daily = buildWeek(sat, [1, 2, 3, 4, 5, 6, 7]);
    expect(weekdaySeriesFor(daily, 'verses', sat)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  // Verify every weekday anchors to the same Monday: feed a fully-populated
  // week and rotate `now` across all 7 days — the output must be identical.
  it('anchors to the same Monday regardless of the day of week', () => {
    // Week of Mon 2025-06-23 .. Sun 2025-06-29.
    const monday = new Date(2025, 5, 23);
    const daily = buildWeek(monday, [10, 20, 30, 40, 50, 60, 70]);
    for (let i = 0; i < 7; i++) {
      const anchor = new Date(monday);
      anchor.setDate(monday.getDate() + i);
      expect(weekdaySeriesFor(daily, 'verses', anchor)).toEqual([10, 20, 30, 40, 50, 60, 70]);
    }
  });

  // Future days inside the current week must read as 0: the user can't have
  // read on a day that hasn't happened yet. Seed only Mon..Wed and assert
  // Thu..Sun render as zeros even though the anchor is Wednesday.
  it('returns 0 for future days inside the same week', () => {
    const wed = new Date(2025, 5, 25); // Wed 2025-06-25
    const monday = new Date(wed);
    monday.setDate(wed.getDate() - 2);
    const daily: Record<string, BucketStats> = {};
    [3, 5, 8].forEach((v, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      daily[todayKey(d)] = { verses: v, hasanat: 0, timeSec: 0, pages: 0 };
    });
    expect(weekdaySeriesFor(daily, 'verses', wed)).toEqual([3, 5, 8, 0, 0, 0, 0]);
  });

  // Spanning week boundaries: a Monday anchor must not leak last week's
  // Sunday value into the new week's Monday slot.
  it('does not leak the previous week\u2019s Sunday into Monday', () => {
    const lastSun = new Date(2025, 5, 22); // Sun 2025-06-22 — end of prior week
    const thisMon = new Date(2025, 5, 23); // Mon 2025-06-23 — start of new week
    const daily: Record<string, BucketStats> = {
      [todayKey(lastSun)]: { verses: 99, hasanat: 0, timeSec: 0, pages: 0 },
    };
    expect(weekdaySeriesFor(daily, 'verses', thisMon)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  // Empty store: all zeros regardless of anchor.
  it('returns all zeros when the daily map is empty', () => {
    const fri = new Date(2025, 5, 27); // Fri 2025-06-27
    expect(weekdaySeriesFor({}, 'verses', fri)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  // The metric argument selects the right field from each bucket.
  it('reads the requested metric, not always verses', () => {
    const tue = new Date(2025, 5, 24); // Tue 2025-06-24
    const monday = new Date(tue);
    monday.setDate(tue.getDate() - 1);
    const daily: Record<string, BucketStats> = {
      [todayKey(monday)]: { verses: 1, hasanat: 100, timeSec: 60, pages: 1 },
      [todayKey(tue)]:    { verses: 2, hasanat: 200, timeSec: 120, pages: 2 },
    };
    expect(weekdaySeriesFor(daily, 'hasanat', tue)).toEqual([100, 200, 0, 0, 0, 0, 0]);
    expect(weekdaySeriesFor(daily, 'timeSec', tue)).toEqual([60, 120, 0, 0, 0, 0, 0]);
  });
});

// A minimal memorized-ayah state — only the fields useHifzTodaysGoal reads
// (lastReviewedAt, via todayKey) matter; the rest satisfy the type.
function memorized(): HifzAyahState {
  return {
    intervalDays: 7, easeFactor: 2, strength: 'reviewing',
    dueDate: '2999-01-01', lastReviewedAt: '2020-01-01T00:00:00.000Z',
    reviewCount: 1, lapses: 0,
  };
}

// Render the hook via a tiny host component and return its latest value.
function renderTodaysGoal(): HifzTodaysGoal | null {
  let captured: HifzTodaysGoal | null = null;
  function Host() { captured = useHifzTodaysGoal(); return null; }
  act(() => { TestRenderer.create(React.createElement(Host)); });
  return captured;
}

describe('useHifzTodaysGoal — verification anchoring', () => {
  // Snapshot & restore the store so these tests don't leak into each other.
  const snapshot = useAppStore.getState();
  afterEach(() => { act(() => { useAppStore.setState(snapshot, true); }); });

  // Scope to Surah 112 (Al-Ikhlas, 4 ayahs), 4 verses/day, all 4 memorized.
  function seedAllMemorized(verify: boolean) {
    act(() => {
      useAppStore.setState({
        hifzGoalType: 'surahs', hifzVersesPerDay: 4, hifzGoalSurahs: [112],
        hifzProgress: { '112:1': memorized(), '112:2': memorized(), '112:3': memorized(), '112:4': memorized() },
        hifzVerifyRecitation: verify, hifzVerified: {},
      });
    });
  }

  it('with verification off, a fully-memorized scope yields no new goal', () => {
    seedAllMemorized(false);
    expect(renderTodaysGoal()).toBeNull();
  });

  it('with verification on, an unverified memorized run stays the current goal', () => {
    seedAllMemorized(true); // memorized but none verified
    const goal = renderTodaysGoal();
    expect(goal).toEqual(expect.objectContaining({ surah: 112, startAyah: 1, endAyah: 4 }));
  });

  it('anchors to the first unverified ayah, not the next unmemorized one', () => {
    seedAllMemorized(true);
    act(() => { useAppStore.setState({ hifzVerified: { '112:1': true } }); }); // ayah 1 verified
    const goal = renderTodaysGoal();
    expect(goal).toEqual(expect.objectContaining({ surah: 112, startAyah: 2, endAyah: 4 }));
  });

  it('returns null once every ayah in scope is verified', () => {
    seedAllMemorized(true);
    act(() => {
      useAppStore.setState({ hifzVerified: { '112:1': true, '112:2': true, '112:3': true, '112:4': true } });
    });
    expect(renderTodaysGoal()).toBeNull();
  });
});
