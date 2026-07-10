import { activeWordIndex, type KaraokeSegment } from '../hifzKaraoke';

// Real sample from QUL (Sudais, 1:1 — Bismillah, 4 words). Segments only
// cover words 1 and 4: words 2-3's audio was absorbed into word 4's span by
// forced alignment. This is the load-bearing gap case the whole module
// exists to handle correctly.
const BISMILLAH: KaraokeSegment[] = [
  { wordIndex: 1, startMs: 380, endMs: 730 },
  { wordIndex: 4, startMs: 740, endMs: 3082 },
];

describe('activeWordIndex', () => {
  it('returns null before the first word starts', () => {
    expect(activeWordIndex(BISMILLAH, 100)).toBeNull();
  });

  it('returns the first word at its exact start', () => {
    expect(activeWordIndex(BISMILLAH, 380)).toBe(0);
  });

  it('stays on the first word while inside its own span', () => {
    expect(activeWordIndex(BISMILLAH, 700)).toBe(0);
  });

  it('stays on the first word through the absorbed words-2-3 gap', () => {
    expect(activeWordIndex(BISMILLAH, 735)).toBe(0);
  });

  it('jumps to word 4 once its segment starts', () => {
    expect(activeWordIndex(BISMILLAH, 740)).toBe(3);
  });

  it('stays on word 4 through the rest of its span', () => {
    expect(activeWordIndex(BISMILLAH, 3000)).toBe(3);
  });

  it('returns null once positionMs passes the provided duration', () => {
    expect(activeWordIndex(BISMILLAH, 3200, 3000)).toBeNull();
  });

  it('returns null for an ayah with no segments at all', () => {
    expect(activeWordIndex([], 500)).toBeNull();
  });

  it('handles out-of-order segment input the same as sorted input', () => {
    const shuffled: KaraokeSegment[] = [BISMILLAH[1], BISMILLAH[0]];
    expect(activeWordIndex(shuffled, 700)).toBe(0);
    expect(activeWordIndex(shuffled, 740)).toBe(3);
  });
});
