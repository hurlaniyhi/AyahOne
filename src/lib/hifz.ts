// Spaced-repetition scheduling for Hifz (memorization) review, keyed per ayah.
// A deterministic step table (rather than exponential multiplication) keeps
// intervals predictable and avoids floating-point drift across many reviews.

import { todayKey } from './format';

export type HifzGrade = 'again' | 'good' | 'easy';
export type HifzStrength = 'learning' | 'reviewing' | 'mastered';

export interface HifzAyahState {
  stepIndex: number;
  strength: HifzStrength;
  dueDate: string;        // todayKey()-style YYYY-MM-DD
  lastReviewedAt: string; // ISO timestamp
  reviewCount: number;
}

// Days until next review at each step. Index advances on 'good' (+1) or
// 'easy' (+2), resets to 0 on 'again'.
export const INTERVAL_STEPS = [1, 3, 7, 14, 30, 60, 90, 180];

function strengthFor(stepIndex: number): HifzStrength {
  if (stepIndex >= 5) return 'mastered';
  if (stepIndex >= 2) return 'reviewing';
  return 'learning';
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function nextHifzState(prev: HifzAyahState | undefined, grade: HifzGrade, now: Date = new Date()): HifzAyahState {
  const prevStep = prev?.stepIndex ?? -1;
  const stepIndex =
    grade === 'again' ? 0
    : grade === 'easy' ? Math.min(INTERVAL_STEPS.length - 1, prevStep + 2)
    : Math.min(INTERVAL_STEPS.length - 1, prevStep + 1);

  return {
    stepIndex,
    strength: strengthFor(stepIndex),
    dueDate: todayKey(addDays(now, INTERVAL_STEPS[stepIndex])),
    lastReviewedAt: now.toISOString(),
    reviewCount: (prev?.reviewCount ?? 0) + 1,
  };
}

export function isDue(state: HifzAyahState, now: Date = new Date()): boolean {
  return state.dueDate <= todayKey(now);
}
