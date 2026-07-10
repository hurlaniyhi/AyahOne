export interface KaraokeSegment {
  wordIndex: number;
  startMs: number;
  endMs: number;
}

// QUL's forced-alignment segments are 1-based and may skip word indices
// (e.g. a 4-word ayah can have segments only for words 1 and 4 — words 2-3's
// audio got absorbed into word 4's span). The correct behaviour is for the
// last-reached segment to stay active through any such gap, not go blank or
// jump early — which is exactly what "find the last segment whose startMs
// has been reached" already gives you, since a gap just means no competing
// segment exists in that span.
//
// Returns a 0-based index into the UI's word array, or null if playback
// hasn't reached the first word yet, or has passed `durationMs`.
export function activeWordIndex(
  segments: KaraokeSegment[],
  positionMs: number,
  durationMs?: number,
): number | null {
  if (segments.length === 0) return null;
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  if (positionMs < sorted[0].startMs) return null;
  if (durationMs != null && positionMs > durationMs) return null;

  let active = sorted[0];
  for (const seg of sorted) {
    if (seg.startMs > positionMs) break;
    active = seg;
  }
  return active.wordIndex - 1;
}
