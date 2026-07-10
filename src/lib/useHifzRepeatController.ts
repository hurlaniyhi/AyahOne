import { useEffect, useRef, useState } from 'react';
import type { AudioPlayer, AudioStatus } from 'expo-audio';

export type HifzRepeatMode = 'off' | 3 | 5 | 10 | 'forever';

const PAUSE_BETWEEN_REPEATS_MS = 700;

// Auto-repeat timer shared by HifzAudioPlayer and HifzKaraokePlayer — lifted
// out verbatim rather than duplicated, since the seek/pause/cleanup timing
// here is exactly the kind of subtle logic that drifts if maintained twice.
export function useHifzRepeatController(
  player: AudioPlayer,
  playerStatus: AudioStatus,
  status: 'idle' | 'loading' | 'ready' | 'error',
  speed: number,
) {
  const [repeatMode, setRepeatModeRaw] = useState<HifzRepeatMode>('off');
  const [repsDone, setRepsDone] = useState(0);
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wait a deliberate breath after a take finishes, then replay, up to the
  // chosen count — or indefinitely for "forever" until turned off.
  useEffect(() => {
    if (status !== 'ready' || repeatMode === 'off' || !playerStatus.didJustFinish) return;
    const targetReached = repeatMode !== 'forever' && repsDone + 1 >= repeatMode;
    if (targetReached) { setRepsDone(0); return; }
    repeatTimerRef.current = setTimeout(() => {
      setRepsDone(n => n + 1);
      void (async () => {
        try {
          player.setPlaybackRate(speed);
          await player.seekTo(0);
          player.play();
        } catch {
          // Silently stop repeating rather than retry-spamming a background
          // continuation — the user can always tap play again manually.
        }
      })();
    }, PAUSE_BETWEEN_REPEATS_MS);
    return () => { if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerStatus.didJustFinish, repeatMode, status]);

  const setRepeatMode = (mode: HifzRepeatMode) => {
    setRepeatModeRaw(mode);
    setRepsDone(0);
  };

  // Call when the underlying audio (surah/ayah/reciter) changes — cancels
  // any pending repeat and zeroes the rep counter without touching the
  // user's chosen repeat mode.
  const reset = () => {
    setRepsDone(0);
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current);
  };

  return { repeatMode, setRepeatMode, repsDone, reset };
}
