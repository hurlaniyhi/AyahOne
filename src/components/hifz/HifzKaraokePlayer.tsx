import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { RECITERS } from '@/data/quranAudio';
import { getKaraokeAyahData } from '@/data/hifzKaraoke';
import { activeWordIndex } from '@/lib/hifzKaraoke';
import { useTogglePlayback } from '@/lib/useTogglePlayback';
import { useHifzRepeatController, type HifzRepeatMode } from '@/lib/useHifzRepeatController';
import { InlineNotice } from '@/components/InlineNotice';
import { formatMs } from '@/components/recitation/RecordButton';

type Status = 'idle' | 'loading' | 'ready' | 'error';

const REPEAT_OPTIONS: HifzRepeatMode[] = ['off', 3, 5, 10, 'forever'];
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

interface Props {
  surah: number;
  ayah: number;
  reciterId: string;
  onActiveWordChange?: (index: number | null) => void;
}

// A sibling to HifzAudioPlayer, not a modification of it — rendered instead
// of it only when the current reciter+ayah has QUL word-timestamp data (see
// app/hifz/[surah].tsx). Streams from the segment data's own `audioUrl`
// (audio.qurancdn.com), which is a DIFFERENT file than getAyahAudioUrl()'s
// alquran.cloud stream for the same reciter — the timestamps only line up
// with this exact recording, so this can't reuse that lookup.
export function HifzKaraokePlayer({ surah, ayah, reciterId, onActiveWordChange }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [speed, setSpeed] = useState(1);

  const karaokeData = useMemo(() => getKaraokeAyahData(reciterId, surah, ayah), [reciterId, surah, ayah]);

  // 100ms cadence (vs. HifzAudioPlayer's unset 500ms default) gives several
  // samples across even the shortest observed word segment (~350ms in the
  // real QUL sample) — smooth enough highlighting without a manual polling
  // loop; expo-audio's updateInterval option handles the sampling itself.
  const player = useAudioPlayer(audioUrl, { updateInterval: 100 });
  const playerStatus = useAudioPlayerStatus(player);
  const toggle = useTogglePlayback(player, playerStatus, () => setStatus('error'));
  const { repeatMode, setRepeatMode, repsDone, reset: resetRepeat } = useHifzRepeatController(player, playerStatus, status, speed);

  useEffect(() => {
    setAudioUrl(null);
    setStatus('idle');
    resetRepeat();
    onActiveWordChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayah, reciterId]);

  useEffect(() => {
    if (audioUrl) void toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    if (status === 'ready') player.setPlaybackRate(speed);
  }, [speed, status, player]);

  const activeIndex = useMemo(() => {
    if (!karaokeData || status !== 'ready') return null;
    return activeWordIndex(karaokeData.segments, playerStatus.currentTime * 1000, karaokeData.durationMs);
  }, [karaokeData, playerStatus.currentTime, status]);

  useEffect(() => {
    onActiveWordChange?.(activeIndex);
  }, [activeIndex, onActiveWordChange]);

  const load = () => {
    if (!karaokeData) { setStatus('error'); return; }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAudioUrl(karaokeData.audioUrl);
    setStatus('ready');
  };

  const reciterName = RECITERS.find(r => r.id === reciterId)?.name ?? '';
  const playbackProgress = playerStatus.duration > 0 ? playerStatus.currentTime / playerStatus.duration : 0;
  const remainingMs = playerStatus.duration > 0
    ? Math.max(0, (playerStatus.duration - playerStatus.currentTime) * 1000)
    : 0;

  if (status === 'error') {
    return (
      <View style={{ gap: t.spacing(2) }}>
        <InlineNotice tone="danger" icon="alert-circle-outline" text={s.audioError} />
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
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            backgroundColor: t.accent.primary,
            transform: [{ scale: pressed ? t.pressedScale : 1 }],
          })}
        >
          <Ionicons name={playerStatus.playing ? 'pause' : 'play'} size={16} color={t.accent.onPrimary} />
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
