import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { getAyahAudioUrl, isOfflineError, RECITERS } from '@/data/quranAudio';
import { useTogglePlayback } from '@/lib/useTogglePlayback';
import { useHifzRepeatController, type HifzRepeatMode } from '@/lib/useHifzRepeatController';
import { InlineNotice } from '@/components/InlineNotice';
import { formatMs } from '@/components/recitation/RecordButton';

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

const REPEAT_OPTIONS: HifzRepeatMode[] = ['off', 3, 5, 10, 'forever'];
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

interface Props {
  surah: number;
  ayah: number;
  reciterId: string;
}

// A dedicated, Hifz-only audio control — NOT a variant of the shared
// VerseAudioListen (src/components/VerseAudioListen.tsx), which the regular
// reader also uses. Keeping this fully separate means the repeat/speed
// logic here can't regress the reader's simple listen control; the two
// share only the same lower-level building blocks (useTogglePlayback,
// getAyahAudioUrl, InlineNotice).
export function HifzAudioPlayer({ surah, ayah, reciterId }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [speed, setSpeed] = useState(1);
  // Bumped every time a fresh play is requested so retrying after reconnecting
  // replays even when the resolved URL is identical to the one that failed
  // offline — see VerseAudioListen for the same pattern.
  const [playToken, setPlayToken] = useState(0);

  const player = useAudioPlayer(audioUrl);
  const playerStatus = useAudioPlayerStatus(player);
  // Recitation audio is always streamed (never bundled), so a playback failure
  // — even with a URL already resolved — is a connectivity problem. Surface it
  // as offline so the connect-to-listen message shows instead of a generic error.
  const toggle = useTogglePlayback(player, playerStatus, () => setStatus('offline'));
  const { repeatMode, setRepeatMode, repsDone, reset: resetRepeat } = useHifzRepeatController(player, playerStatus, status, speed);

  // Audio always corresponds to what's on screen — stop and forget the
  // previous take, and cancel any pending repeat, the moment the ayah (or
  // reciter) changes.
  useEffect(() => {
    setAudioUrl(null);
    setStatus('idle');
    resetRepeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayah, reciterId]);

  // Once the fetched URL lands, the player above has already been
  // reconstructed with it — safe to start playback here.
  //
  // player.replace() is essential for the offline→reconnect retry: expo-audio
  // caches the failed/unloaded state on the player instance, and since the URL
  // is unchanged useAudioPlayer won't rebuild the player, so a bare play()
  // would just replay the cached failure. replace() forces a fresh fetch of
  // the (same) source so it actually downloads once the network is back.
  useEffect(() => {
    if (playToken > 0 && audioUrl) {
      player.replace(audioUrl);
      void toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken]);

  // Offline watchdog for the case where the audio URL was cached before going
  // offline: getAyahAudioUrl then succeeds from cache, so load() reaches
  // playback, but expo-audio silently can't fetch the remote mp3 and
  // player.play() never throws. If a requested play hasn't loaded or started
  // after a grace period, surface it as offline. (A fresh, uncached fetch
  // already fails earlier in load()'s catch.)
  useEffect(() => {
    if (playToken === 0 || status !== 'ready') return;
    if (playerStatus.isLoaded || playerStatus.playing) return;
    const id = setTimeout(() => {
      if (!playerStatus.isLoaded && !playerStatus.playing) setStatus('offline');
    }, 6000);
    return () => clearTimeout(id);
  }, [playToken, status, playerStatus.isLoaded, playerStatus.playing]);

  useEffect(() => {
    if (status === 'ready') player.setPlaybackRate(speed);
  }, [speed, status, player]);

  const load = async () => {
    setStatus('loading');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = await getAyahAudioUrl(surah, ayah, reciterId);
      setAudioUrl(url);
      setStatus('ready');
      setPlayToken(n => n + 1);
    } catch (e) {
      setStatus(isOfflineError(e) ? 'offline' : 'error');
    }
  };

  const reciterName = RECITERS.find(r => r.id === reciterId)?.name ?? '';
  const playbackProgress = playerStatus.duration > 0 ? playerStatus.currentTime / playerStatus.duration : 0;
  const remainingMs = playerStatus.duration > 0
    ? Math.max(0, (playerStatus.duration - playerStatus.currentTime) * 1000)
    : 0;
  // The mp3 is still downloading/buffering: a play was requested but the audio
  // isn't playing yet and hasn't finished loading (or is actively re-buffering
  // mid-stream). Drives the spinner inside the play circle. Once paused after
  // load, isLoaded stays true, so this is false and the play icon returns.
  const buffering = playToken > 0 && !playerStatus.playing && (playerStatus.isBuffering || !playerStatus.isLoaded);

  if (status === 'offline' || status === 'error') {
    const offline = status === 'offline';
    return (
      <View style={{ gap: t.spacing(2) }}>
        <InlineNotice
          tone={offline ? 'warning' : 'danger'}
          icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
          text={offline ? `${s.audioOfflineTitle} — ${s.audioOfflineMessage}` : s.audioError}
        />
        <Pressable
          onPress={load}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
            borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: t.accent.primary, fontWeight: '700', fontSize: 13 }}>{s.reciteTryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <Pressable
        onPress={load}
        disabled={status === 'loading'}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), alignSelf: 'flex-start',
          borderWidth: 0.75, borderColor: t.colors.hairline, backgroundColor: t.colors.surface,
          borderRadius: t.radius.pill, paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {status === 'loading' ? (
          <ActivityIndicator size="small" color={t.accent.primary} />
        ) : (
          <Ionicons name="play-circle" size={16} color={t.accent.primary} />
        )}
        <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>
          {status === 'loading' ? s.audioLoading : `${s.audioListen} · ${reciterName}`}
        </Text>
      </Pressable>
    );
  }

  // status === 'ready'
  return (
    <View style={{
      gap: t.spacing(3),
      padding: t.spacing(3), borderRadius: t.radius.lg,
      backgroundColor: t.colors.surfaceMuted,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
        <Pressable
          onPress={toggle}
          disabled={buffering}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            backgroundColor: t.accent.primary,
            transform: [{ scale: pressed ? t.pressedScale : 1 }],
          })}
        >
          {buffering ? (
            <ActivityIndicator size="small" color={t.accent.onPrimary} />
          ) : (
            <Ionicons name={playerStatus.playing ? 'pause' : 'play'} size={16} color={t.accent.onPrimary} />
          )}
        </Pressable>
        <View style={{ flex: 1, height: 5, borderRadius: 2.5, backgroundColor: t.colors.border }}>
          <View style={{ height: 5, width: `${Math.round(playbackProgress * 100)}%`, borderRadius: 2.5, backgroundColor: t.accent.primary }} />
        </View>
        <Text style={{ color: t.colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] }}>
          {formatMs(remainingMs)}
        </Text>
      </View>
      <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>
        {reciterName}
        {repeatMode !== 'off' && (
          <Text style={{ color: t.accent.primary }}>
            {'  ·  '}{repeatMode === 'forever' ? s.hifzRepeatForeverActive : s.hifzRepeatActive.replace('{n}', String(repsDone + 1)).replace('{total}', String(repeatMode))}
          </Text>
        )}
      </Text>

      <View style={{ gap: t.spacing(1) }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {s.hifzRepeat}
        </Text>
        <View style={{ flexDirection: 'row', gap: t.spacing(1) }}>
          {REPEAT_OPTIONS.map(mode => {
            const active = repeatMode === mode;
            return (
              <Pressable
                key={String(mode)}
                onPress={() => setRepeatMode(mode)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: t.spacing(1.5), borderRadius: t.radius.pill,
                  alignItems: 'center',
                  backgroundColor: active ? t.accent.primary : t.colors.surface,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: active ? t.accent.onPrimary : t.colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                  {mode === 'off' ? s.hifzRepeatOff : mode === 'forever' ? '∞' : `×${mode}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: t.spacing(1) }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {s.hifzSpeed}
        </Text>
        <View style={{ flexDirection: 'row', gap: t.spacing(1) }}>
          {SPEED_OPTIONS.map(sp => {
            const active = speed === sp;
            return (
              <Pressable
                key={sp}
                onPress={() => setSpeed(sp)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: t.spacing(1.5), borderRadius: t.radius.pill,
                  alignItems: 'center',
                  backgroundColor: active ? t.accent.primary : t.colors.surface,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: active ? t.accent.onPrimary : t.colors.textMuted, fontWeight: '700', fontSize: 12 }}>
                  {sp}×
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
