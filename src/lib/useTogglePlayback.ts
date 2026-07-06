import { useCallback } from 'react';
import { setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';

// Shared play/pause/resume toggle for every `expo-audio` playback control in
// the app (recitation-practice review, verse listening, reciter preview).
// Tapping while playing pauses; tapping while paused resumes from exactly
// where it left off, seeking back to the start only once a take has
// genuinely finished. `player.play()` activates the shared AVAudioSession
// under the hood, which can throw a transient "Session activation failed"
// while iOS is still negotiating a Bluetooth accessory's audio route — the
// retry-with-backoff absorbs that instead of failing silently or once.
export function useTogglePlayback(
  player: AudioPlayer,
  status: AudioStatus,
  onError: () => void,
) {
  return useCallback(async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    const finished = status.didJustFinish
      || (status.duration > 0 && status.currentTime >= status.duration);
    const ATTEMPTS = 4;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        // On iOS, `allowsRecording: true` (needed while recording) puts the
        // session in the `.playAndRecord` category, whose default audio
        // route is the quiet earpiece receiver rather than the main
        // speaker — that's why played-back audio can sound near-silent
        // even at full volume. Playback never needs simultaneous recording,
        // so switch to `.playback` (loud speaker by default) right before
        // every play attempt, regardless of whatever category a previous
        // recording session left active.
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (finished) await player.seekTo(0);
        player.play();
        return;
      } catch {
        if (attempt === ATTEMPTS) {
          onError();
          return;
        }
        await new Promise(r => setTimeout(r, 350 * attempt));
      }
    }
  }, [player, status, onError]);
}
