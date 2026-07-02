import { goalBadgeState } from '../DailyGoalBadge';

// The badge itself is a thin presentational wrapper; its only real logic is the
// met/extra computation, which is extracted into `goalBadgeState`. These tests
// pin that logic so the "goal complete" indicator and the "+N beyond goal"
// counter can never silently drift.
describe('goalBadgeState', () => {
  it('is not met while below the goal (no extra)', () => {
    expect(goalBadgeState(3, 10)).toEqual({ met: false, extra: 0 });
    expect(goalBadgeState(0, 10)).toEqual({ met: false, extra: 0 });
    expect(goalBadgeState(9, 10)).toEqual({ met: false, extra: 0 });
  });

  it('is met exactly at the goal with zero extra', () => {
    expect(goalBadgeState(10, 10)).toEqual({ met: true, extra: 0 });
    expect(goalBadgeState(1, 1)).toEqual({ met: true, extra: 0 });
  });

  it('reports verses read beyond the goal as extra', () => {
    expect(goalBadgeState(11, 10)).toEqual({ met: true, extra: 1 });
    expect(goalBadgeState(25, 10)).toEqual({ met: true, extra: 15 });
    expect(goalBadgeState(114, 5)).toEqual({ met: true, extra: 109 });
  });

  it('never returns a negative extra', () => {
    expect(goalBadgeState(0, 5).extra).toBe(0);
    expect(goalBadgeState(2, 5).extra).toBe(0);
  });
});
