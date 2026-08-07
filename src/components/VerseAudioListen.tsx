import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { getAyahAudioUrl, isOfflineError, RECITERS } from '@/data/quranAudio';
import { useTogglePlayback } from '@/lib/useTogglePlayback';
import { InlineNotice } from '@/components/InlineNotice';
import { formatMs } from '@/components/recitation/RecordButton';

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'offline';

interface Props {
  surah: number;
  ayah: number;
  reciterId: string;
  // Fired the moment a fresh play is requested here, so a parent running its
  // own playback (e.g. page-mode continuous recitation) can stop first — the
  // two must never sound at once.
  onPlaybackStart?: () => void;
}

// Compact "Listen" pill that expands into an inline mini-player once tapped.
// Mounted inside the ayah card in the reader (app/read/[surah].tsx).
export function VerseAudioListen({ surah, ayah, reciterId, onPlaybackStart }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  // Bumped every time a fresh play is requested. The play effect keys on this
  // rather than on `audioUrl` alone, so retrying after reconnecting replays
  // even when the resolved URL is identical to the one that failed offline
  // (setting the same URL wouldn't re-fire an audioUrl-only effect).
  const [playToken, setPlayToken] = useState(0);
  // Whether the play the effect below is about to act on is a retry of the
  // SAME url as before (true) or a brand-new url (false) — set in `load()`,
  // read once by the effect. Only the retry case needs `player.replace()`;
  // calling it on a brand-new url raced it against the fresh native load that
  // `useAudioPlayer(audioUrl)` already kicked off for that same url during
  // this render (below), leaving the player stuck "buffering" forever and
  // eventually mis-reported as offline even while online.
  const isRetryOfSameUrlRef = useRef(false);
  // Mirrors `audioUrl` so `load()` can tell a fresh url from a same-url retry
  // without closing over a stale value.
  const audioUrlRef = useRef(audioUrl);
  audioUrlRef.current = audioUrl;

  // 250ms sampling (vs. the 500ms default) so the player reports isLoaded/
  // isBuffering/playing promptly — the offline watchdog below relies on seeing
  // fresh status, and the everyayah fallback host can take several seconds to
  // deliver an mp3, so stale status would otherwise trip a false offline.
  const player = useAudioPlayer(audioUrl, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);
  // Latest status mirrored into a ref so the hard-ceiling watchdog below can
  // read it when its one-shot timer fires without re-arming on every status
  // change (which is what lets a perpetually-"buffering" offline attempt hang).
  const playerStatusRef = useRef(playerStatus);
  playerStatusRef.current = playerStatus;
  // Latest UI status mirrored for the one-shot hard-ceiling watchdog so it can
  // bail if the play was superseded (ayah/reciter changed → status reset) before
  // the ceiling fired.
  const statusRef = useRef(status);
  statusRef.current = status;
  // Recitation audio is always streamed (never bundled), so a playback failure
  // — even with a URL already resolved — is a connectivity problem. Surface it
  // as offline so the connect-to-listen message shows instead of a generic error.
  const toggle = useTogglePlayback(player, playerStatus, () => setStatus('offline'));

  // Audio always corresponds to what's on screen — stop and forget the
  // previous take the moment the ayah (or reciter) changes.
  useEffect(() => {
    setAudioUrl(null);
    setStatus('idle');
  }, [surah, ayah, reciterId]);

  // Once the fetched URL lands, the player above has already been
  // reconstructed with it (useAudioPlayer recreates synchronously during
  // render when its source changes) — safe to start playback here.
  //
  // player.replace() is ONLY needed for the offline→reconnect retry: expo-audio
  // caches the failed/unloaded state on the player instance, and since the URL
  // is unchanged useAudioPlayer won't rebuild the player, so a bare play()
  // would just replay the cached failure. replace() forces a fresh fetch of
  // the (same) source so it actually downloads once the network is back. For a
  // brand-new url, useAudioPlayer already started loading it fresh this same
  // render — calling replace() too would issue a second, redundant load
  // request for that url and race the first one.
  useEffect(() => {
    if (playToken > 0 && audioUrl) {
      if (isRetryOfSameUrlRef.current) player.replace(audioUrl);
      void toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken]);

  // Soft offline watchdog for the case where the audio URL was cached before
  // going offline: getAyahAudioUrl then succeeds from cache, so load() reaches
  // playback, but expo-audio silently can't fetch the remote mp3 and
  // player.play() never throws. If a requested play isn't loaded, playing, or
  // even buffering after a short grace period, it's plainly stuck → offline.
  // (A fresh, uncached fetch already fails earlier in load()'s catch.)
  //
  // The everyayah fallback host is slow (an mp3 can take 5–13s to arrive), so
  // while isBuffering is true the file is actively downloading — don't call that
  // offline here; the hard-ceiling watchdog below covers the case where
  // buffering never actually resolves (true offline can report buffering
  // indefinitely).
  useEffect(() => {
    if (playToken === 0 || status !== 'ready') return;
    if (playerStatus.isLoaded || playerStatus.playing || playerStatus.isBuffering) return;
    const id = setTimeout(() => {
      if (!playerStatus.isLoaded && !playerStatus.playing && !playerStatus.isBuffering) setStatus('offline');
    }, 8000);
    return () => clearTimeout(id);
  }, [playToken, status, playerStatus.isLoaded, playerStatus.playing, playerStatus.isBuffering]);

  // Hard-ceiling watchdog: a one-shot timer armed the moment a play is
  // requested (keyed on playToken only, so status changes never re-arm it).
  // When offline, expo-audio can sit "buffering" forever without ever loading,
  // which the soft watchdog above intentionally tolerates — this ceiling is the
  // backstop. If, after a ceiling well above everyayah's worst real load time
  // (~13s), the audio still hasn't actually loaded or started playing, treat it
  // as offline regardless of the buffering flag so the retry UI can appear.
  useEffect(() => {
    if (playToken === 0) return;
    const id = setTimeout(() => {
      // Bail if this play was superseded (ayah/reciter changed → status reset).
      if (statusRef.current !== 'ready') return;
      const st = playerStatusRef.current;
      if (!st.isLoaded && !st.playing) setStatus('offline');
    }, 25000);
    return () => clearTimeout(id);
  }, [playToken]);

  const load = async () => {
    setStatus('loading');
    onPlaybackStart?.();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const url = await getAyahAudioUrl(surah, ayah, reciterId);
      isRetryOfSameUrlRef.current = url === audioUrlRef.current;
      setAudioUrl(url);
      setStatus('ready');
      // Request playback via the token so an unchanged URL still replays.
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

  // status === 'ready' — inline mini-player.
  return (
    <View style={{
      gap: t.spacing(2),
      padding: t.spacing(3), borderRadius: t.radius.lg,
      backgroundColor: t.colors.surfaceMuted,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
        <Pressable
          onPress={() => { if (!playerStatus.playing) onPlaybackStart?.(); void toggle(); }}
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
      <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600' }}>{reciterName}</Text>
    </View>
  );
}
