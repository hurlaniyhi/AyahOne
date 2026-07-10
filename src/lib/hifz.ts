// Spaced-repetition scheduling for Hifz (memorization) review, keyed per ayah.
//
// Four grades, matching how memorization actually feels to self-assess:
//   Forgotten  -> couldn't recall at all. Review again today AND tomorrow.
//   Difficult  -> got there, but shaky. Review tomorrow.
//   Good       -> recalled it properly. Review in about a week.
//   Easy       -> recalled it confidently. Review in 2-4 weeks.
// A per-ayah `easeFactor` lets repeated "Good"/"Easy" grades grow the
// interval further each time (real spaced repetition), while "Difficult"/
// "Forgotten" pull it back down — rather than a flat "always exactly 7 days"
// rule, which would never adapt to an ayah the user knows cold after months
// of review.

import { todayKey } from './format';

export type HifzGrade = 'forgotten' | 'difficult' | 'good' | 'easy';
export type HifzStrength = 'learning' | 'reviewing' | 'mastered';

export interface HifzAyahState {
  intervalDays: number;
  easeFactor: number;
  strength: HifzStrength;
  dueDate: string;        // todayKey()-style YYYY-MM-DD
  lastReviewedAt: string; // ISO timestamp
  reviewCount: number;
  lapses: number;         // number of times graded 'forgotten' — powers "most forgotten" tracking
}

const DEFAULT_EASE = 2.0;
const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 240;

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, ease);
}

function strengthFor(intervalDays: number, lapses: number): HifzStrength {
  if (intervalDays >= 30 && lapses === 0) return 'mastered';
  if (intervalDays >= 7) return 'reviewing';
  return 'learning';
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function nextHifzState(prev: HifzAyahState | undefined, grade: HifzGrade, now: Date = new Date()): HifzAyahState {
  const prevInterval = prev?.intervalDays ?? 0;
  const prevEase = prev?.easeFactor ?? DEFAULT_EASE;
  const prevLapses = prev?.lapses ?? 0;

  let intervalDays: number;
  let easeFactor: number;
  let lapses = prevLapses;

  switch (grade) {
    case 'forgotten':
      intervalDays = 1;
      easeFactor = clampEase(prevEase - 0.3);
      lapses = prevLapses + 1;
      break;
    case 'difficult':
      intervalDays = 1;
      easeFactor = clampEase(prevEase - 0.15);
      break;
    case 'good':
      intervalDays = prevInterval < 7 ? 7 : Math.round(prevInterval * prevEase);
      easeFactor = prevEase;
      break;
    case 'easy':
      intervalDays = prevInterval < 14 ? 14 : Math.round(prevInterval * (prevEase + 0.15));
      easeFactor = clampEase(prevEase + 0.15);
      break;
  }
  intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);

  return {
    intervalDays,
    easeFactor,
    strength: strengthFor(intervalDays, lapses),
    dueDate: todayKey(addDays(now, intervalDays)),
    lastReviewedAt: now.toISOString(),
    reviewCount: (prev?.reviewCount ?? 0) + 1,
    lapses,
  };
}

export function isDue(state: HifzAyahState, now: Date = new Date()): boolean {
  return state.dueDate <= todayKey(now);
}

// "Forgotten" schedules a normal tomorrow due-date via nextHifzState, but the
// product spec also wants an immediate same-day retry — since the app only
// has day-granularity due dates, that second pass is modeled at the session
// level (the practice screen re-queues the ayah later in the current
// session) rather than in the persisted schedule itself.
export function shouldRequeueToday(grade: HifzGrade): boolean {
  return grade === 'forgotten';
}
