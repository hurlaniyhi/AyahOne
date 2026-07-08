import { nextHifzState, isDue, INTERVAL_STEPS, type HifzAyahState } from '../hifz';

// Local-time constructors throughout (not UTC ISO strings) — todayKey() reads
// local Date getters, so a UTC-suffixed time near midnight could land on a
// different local calendar day depending on the test runner's timezone.
const NOW = new Date(2026, 0, 1, 12, 0, 0); // Jan 1 2026, local noon

describe('nextHifzState', () => {
  it('starts a brand-new ayah at step 0 on a "good" grade', () => {
    const state = nextHifzState(undefined, 'good', NOW);
    expect(state.stepIndex).toBe(0);
    expect(state.strength).toBe('learning');
    expect(state.reviewCount).toBe(1);
    expect(state.dueDate).toBe('2026-01-02'); // +1 day
  });

  it('jumps a brand-new ayah to step 1 on an "easy" grade', () => {
    const state = nextHifzState(undefined, 'easy', NOW);
    expect(state.stepIndex).toBe(1);
    expect(state.dueDate).toBe('2026-01-04'); // +3 days
  });

  it('keeps a brand-new ayah at step 0 on an "again" grade', () => {
    const state = nextHifzState(undefined, 'again', NOW);
    expect(state.stepIndex).toBe(0);
    expect(state.dueDate).toBe('2026-01-02');
  });

  it('advances one step on repeated "good" grades', () => {
    let state: HifzAyahState | undefined;
    state = nextHifzState(state, 'good', NOW); // step 0
    state = nextHifzState(state, 'good', NOW); // step 1
    state = nextHifzState(state, 'good', NOW); // step 2
    expect(state.stepIndex).toBe(2);
    expect(state.strength).toBe('reviewing');
    expect(state.reviewCount).toBe(3);
  });

  it('advances two steps on "easy"', () => {
    let state = nextHifzState(undefined, 'good', NOW); // step 0
    state = nextHifzState(state, 'easy', NOW); // step 2
    expect(state.stepIndex).toBe(2);
  });

  it('resets to step 0 on "again" regardless of prior progress', () => {
    let state = nextHifzState(undefined, 'good', NOW);
    state = nextHifzState(state, 'good', NOW);
    state = nextHifzState(state, 'good', NOW);
    expect(state.stepIndex).toBeGreaterThan(0);
    state = nextHifzState(state, 'again', NOW);
    expect(state.stepIndex).toBe(0);
    expect(state.strength).toBe('learning');
  });

  it('caps stepIndex at the last interval step', () => {
    let state: HifzAyahState | undefined;
    for (let i = 0; i < 20; i++) state = nextHifzState(state, 'easy', NOW);
    expect(state!.stepIndex).toBe(INTERVAL_STEPS.length - 1);
  });

  it('reaches "mastered" strength once stepIndex hits 5', () => {
    let state: HifzAyahState | undefined;
    for (let i = 0; i < 5; i++) state = nextHifzState(state, 'good', NOW);
    expect(state!.stepIndex).toBe(4);
    expect(state!.strength).toBe('reviewing');
    state = nextHifzState(state, 'good', NOW);
    expect(state.stepIndex).toBe(5);
    expect(state.strength).toBe('mastered');
  });
});

describe('isDue', () => {
  it('is due when dueDate is today or earlier', () => {
    const state = nextHifzState(undefined, 'again', NOW); // due 2026-01-02
    expect(isDue(state, new Date(2026, 0, 2, 0, 0, 0))).toBe(true);
    expect(isDue(state, new Date(2026, 0, 3, 0, 0, 0))).toBe(true);
  });

  it('is not due before dueDate', () => {
    const state = nextHifzState(undefined, 'again', NOW); // due 2026-01-02
    expect(isDue(state, new Date(2026, 0, 1, 23, 0, 0))).toBe(false);
  });
});
