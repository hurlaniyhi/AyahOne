import { nextHifzState, isDue, shouldRequeueToday, type HifzAyahState } from '../hifz';

// Local-time constructors throughout (not UTC ISO strings) — todayKey() reads
// local Date getters, so a UTC-suffixed time near midnight could land on a
// different local calendar day depending on the test runner's timezone.
const NOW = new Date(2026, 0, 1, 12, 0, 0); // Jan 1 2026, local noon

describe('nextHifzState', () => {
  it('schedules a brand-new "good" ayah about a week out', () => {
    const state = nextHifzState(undefined, 'good', NOW);
    expect(state.intervalDays).toBe(7);
    expect(state.dueDate).toBe('2026-01-08');
    expect(state.strength).toBe('reviewing');
    expect(state.reviewCount).toBe(1);
    expect(state.lapses).toBe(0);
  });

  it('schedules a brand-new "easy" ayah 2 weeks out', () => {
    const state = nextHifzState(undefined, 'easy', NOW);
    expect(state.intervalDays).toBe(14);
    expect(state.dueDate).toBe('2026-01-15');
  });

  it('schedules "difficult" for tomorrow regardless of history', () => {
    const state = nextHifzState(undefined, 'difficult', NOW);
    expect(state.intervalDays).toBe(1);
    expect(state.dueDate).toBe('2026-01-02');
    expect(state.strength).toBe('learning');
  });

  it('schedules "forgotten" for tomorrow and records a lapse', () => {
    const state = nextHifzState(undefined, 'forgotten', NOW);
    expect(state.intervalDays).toBe(1);
    expect(state.dueDate).toBe('2026-01-02');
    expect(state.lapses).toBe(1);
    expect(state.strength).toBe('learning');
  });

  it('flags "forgotten" (and only "forgotten") for a same-day requeue', () => {
    expect(shouldRequeueToday('forgotten')).toBe(true);
    expect(shouldRequeueToday('difficult')).toBe(false);
    expect(shouldRequeueToday('good')).toBe(false);
    expect(shouldRequeueToday('easy')).toBe(false);
  });

  it('grows the interval on repeated "good" grades', () => {
    let state = nextHifzState(undefined, 'good', NOW); // 7 days, ease 2.0
    expect(state.intervalDays).toBe(7);
    state = nextHifzState(state, 'good', NOW); // 7 * 2.0 = 14
    expect(state.intervalDays).toBe(14);
    state = nextHifzState(state, 'good', NOW); // 14 * 2.0 = 28
    expect(state.intervalDays).toBe(28);
  });

  it('grows faster and raises ease on repeated "easy" grades', () => {
    let state = nextHifzState(undefined, 'easy', NOW); // 14 days, ease -> 2.15
    expect(state.intervalDays).toBe(14);
    expect(state.easeFactor).toBeCloseTo(2.15);
    state = nextHifzState(state, 'easy', NOW); // 14 * (2.15+0.15) = 32.2 -> 32
    expect(state.intervalDays).toBe(32);
  });

  it('pulls the interval and ease back down after a long streak hits "forgotten"', () => {
    let state = nextHifzState(undefined, 'good', NOW);
    state = nextHifzState(state, 'good', NOW);
    state = nextHifzState(state, 'good', NOW);
    expect(state.intervalDays).toBeGreaterThan(7);
    const easeBefore = state.easeFactor;
    state = nextHifzState(state, 'forgotten', NOW);
    expect(state.intervalDays).toBe(1);
    expect(state.easeFactor).toBeLessThan(easeBefore);
    expect(state.lapses).toBe(1);
  });

  it('caps the interval at the maximum', () => {
    let state: HifzAyahState | undefined;
    for (let i = 0; i < 30; i++) state = nextHifzState(state, 'easy', NOW);
    expect(state!.intervalDays).toBeLessThanOrEqual(240);
  });

  it('never lets easeFactor drop below the floor', () => {
    let state: HifzAyahState | undefined;
    for (let i = 0; i < 20; i++) state = nextHifzState(state, 'forgotten', NOW);
    expect(state!.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('reaches "mastered" once the interval clears 30 days with no lapses', () => {
    let state = nextHifzState(undefined, 'good', NOW); // 7
    expect(state.strength).toBe('reviewing');
    state = nextHifzState(state, 'good', NOW); // 14
    expect(state.strength).toBe('reviewing');
    state = nextHifzState(state, 'good', NOW); // 28
    expect(state.strength).toBe('reviewing');
    state = nextHifzState(state, 'good', NOW); // 56
    expect(state.intervalDays).toBeGreaterThanOrEqual(30);
    expect(state.strength).toBe('mastered');
  });

  it('a past lapse keeps strength at "reviewing" even once the interval is long', () => {
    let state = nextHifzState(undefined, 'forgotten', NOW); // lapse recorded
    for (let i = 0; i < 6; i++) state = nextHifzState(state, 'good', NOW);
    expect(state.intervalDays).toBeGreaterThanOrEqual(30);
    expect(state.lapses).toBe(1);
    expect(state.strength).toBe('reviewing');
  });
});

describe('isDue', () => {
  it('is due when dueDate is today or earlier', () => {
    const state = nextHifzState(undefined, 'difficult', NOW); // due 2026-01-02
    expect(isDue(state, new Date(2026, 0, 2, 0, 0, 0))).toBe(true);
    expect(isDue(state, new Date(2026, 0, 3, 0, 0, 0))).toBe(true);
  });

  it('is not due before dueDate', () => {
    const state = nextHifzState(undefined, 'difficult', NOW); // due 2026-01-02
    expect(isDue(state, new Date(2026, 0, 1, 23, 0, 0))).toBe(false);
  });
});
