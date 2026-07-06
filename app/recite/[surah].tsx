import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus,
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { getSurah } from '@/data/surahs';
import { getSurahContent, type Ayah } from '@/data/quranApi';
import { arabicFontFor } from '@/lib/quranText';
import { parseTajweedForRender, stripTajweed, TAJWEED_COLORS } from '@/lib/tajweed';
import {
  getRecitationFeedback, tajweedRulesIn, IslamicAiError,
  type RecitationFeedback, type WordFeedback,
} from '@/lib/recitationAi';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { RecordButton, formatMs } from '@/components/recitation/RecordButton';
import { ScoreGauge } from '@/components/recitation/ScoreGauge';
import { WordFeedbackChip } from '@/components/recitation/WordFeedbackChip';
import { TajweedNoteRow } from '@/components/recitation/TajweedNoteRow';
import { WordNoteSheet } from '@/components/recitation/WordNoteSheet';

type Stage = 'idle' | 'recording' | 'recorded' | 'analyzing' | 'feedback';

// Safety cap on a single take: keeps the resulting base64 payload comfortably
// under Gemini's 20MB inline-request limit (a single ayah is realistically
// well under a minute even at a slow reciting pace).
const MAX_RECORDING_SECONDS = 90;
// Below this peak dBFS, a take is almost certainly too quiet for Gemini to
// make out a recitation (a common symptom when a connected Bluetooth
// accessory's mic route isn't actually picking up the voice well). Warn
// proactively rather than only discovering this after a slow AI round trip.
const QUIET_PEAK_DBFS = -45;

export default function RecitationScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const surahNumber = Math.max(1, Math.min(114, parseInt(params.surah ?? '1', 10) || 1));
  const ayahNumber = Math.max(1, parseInt(params.ayah ?? '1', 10) || 1);
  const surahMeta = getSurah(surahNumber)!;
  const arabicFontFamily = arabicFontFor('tajweed');

  const addRecitationAttempt = useAppStore(st => st.addRecitationAttempt);

  const [ayah, setAyah] = useState<Ayah | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setAyah(null);
    setLoadError(null);
    // Always fetch the tajweed-tagged script here regardless of the reader's
    // display setting — this screen needs the rule markup both to colour the
    // ayah and to tell Gemini which tajweed rules are actually present.
    getSurahContent(surahNumber, 'en.sahih', 'tajweed')
      .then(c => { if (alive) setAyah(c.ayahs[ayahNumber - 1] ?? null); })
      .catch(e => { if (alive) setLoadError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [surahNumber, ayahNumber]);

  const plainArabic = useMemo(() => (ayah ? stripTajweed(ayah.arabic) : ''), [ayah]);
  const rules = useMemo(() => (ayah ? tajweedRulesIn(ayah.arabic) : []), [ayah]);
  const tajweedSegments = useMemo(
    () => (ayah ? parseTajweedForRender(ayah.arabic, Platform.OS === 'android') : null),
    [ayah],
  );

  const [stage, setStage] = useState<Stage>('idle');
  const [feedback, setFeedback] = useState<RecitationFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordFeedback | null>(null);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 100);
  // Snapshotted explicitly the moment `recorder.stop()` resolves, rather than
  // read live off `recorder`/`recorderState` in the player/upload paths —
  // guarantees playback and the feedback upload always use the exact file
  // that was just finalized, with no dependency on SharedObject property
  // timing across renders.
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [quietWarning, setQuietWarning] = useState(false);
  const peakMeteringRef = useRef(-160);
  const player = useAudioPlayer(recordingUri);
  const playerStatus = useAudioPlayerStatus(player);

  // The `forDuration` safety cap stops the native recorder on its own, but
  // `recorderState.isRecording` flipping false is the single source of truth
  // the UI reacts to, regardless of who triggered the stop.
  useEffect(() => {
    if (stage === 'recording' && !recorderState.isRecording) setStage('recorded');
  }, [recorderState.isRecording, stage]);

  useEffect(() => {
    if (stage === 'recording' && typeof recorderState.metering === 'number') {
      peakMeteringRef.current = Math.max(peakMeteringRef.current, recorderState.metering);
    }
  }, [recorderState.metering, stage]);

  const startRecording = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg(s.reciteMicPermissionBody);
      return;
    }
    setFeedback(null);
    setErrorMsg(null);
    setQuietWarning(false);
    peakMeteringRef.current = -160;
    // iOS's AVAudioSession.setActive can transiently throw "Session
    // activation failed" while the OS is still negotiating the Bluetooth
    // HFP (hands-free mic) route with a connected accessory (AirPods, etc).
    // A short retry lets that negotiation settle instead of surfacing a
    // failure the user has no way to act on.
    const ATTEMPTS = 3;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record({ forDuration: MAX_RECORDING_SECONDS });
        setStage('recording');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      } catch (e) {
        if (attempt === ATTEMPTS) {
          setErrorMsg(String((e as Error)?.message ?? e));
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
        await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }
  };

  const stopRecording = async () => {
    await recorder.stop();
    setRecordingUri(recorder.uri);
    setRecordedDurationMs(recorderState.durationMillis);
    setQuietWarning(peakMeteringRef.current < QUIET_PEAK_DBFS);
    setStage('recorded');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const reRecord = () => {
    setFeedback(null);
    setErrorMsg(null);
    setQuietWarning(false);
    setRecordingUri(null);
    setStage('idle');
  };

  const submitForFeedback = async () => {
    if (!recordingUri || !ayah) return;
    setStage('analyzing');
    setErrorMsg(null);
    try {
      const file = new File(recordingUri);
      const base64 = await file.base64();
      const result = await getRecitationFeedback(plainArabic, rules, base64, 'audio/aac');
      setFeedback(result);
      setStage('feedback');
      addRecitationAttempt({
        id: `${surahNumber}:${ayahNumber}:${Date.now()}`,
        surah: surahNumber,
        ayah: ayahNumber,
        score: result.accuracyScore,
        date: new Date().toISOString(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const code = e instanceof IslamicAiError ? e.code : 'http';
      const msg =
        code === 'no-key' ? s.reciteApiKeyMissing :
        code === 'network' ? s.reciteErrorNetwork :
        code === 'blocked' ? s.reciteErrorBlocked :
        s.reciteError;
      setErrorMsg(msg);
      setStage('recorded');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const practiceAgain = () => {
    setFeedback(null);
    setErrorMsg(null);
    setQuietWarning(false);
    setRecordingUri(null);
    setStage('idle');
  };

  const togglePlayback = async () => {
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    // `play()` activates the shared AVAudioSession under the hood, which can
    // hit the same transient "Session activation failed" race as recording
    // does while a Bluetooth accessory's audio route is still settling —
    // retry with backoff instead of failing silently.
    const ATTEMPTS = 3;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        player.play();
        return;
      } catch (e) {
        if (attempt === ATTEMPTS) {
          setErrorMsg(String((e as Error)?.message ?? e));
          return;
        }
        await new Promise(r => setTimeout(r, 400 * attempt));
      }
    }
  };

  const close = () => router.back();

  const playbackProgress = playerStatus.duration > 0 ? playerStatus.currentTime / playerStatus.duration : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), gap: t.spacing(4), flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={close}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.colors.surface, borderWidth: 0.75, borderColor: t.colors.hairline,
              transform: [{ scale: pressed ? t.pressedScale : 1 }],
            })}
          >
            <Ionicons name="close" size={20} color={t.colors.text} />
          </Pressable>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
            borderWidth: 0.75, borderColor: t.colors.hairline, backgroundColor: t.colors.surface,
            borderRadius: t.radius.pill, paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
          }}>
            <Ionicons name="mic-outline" size={13} color={t.accent.primary} />
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13 }}>
              {surahMeta.englishName} · {ayahNumber}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Text style={{ color: t.colors.brass, fontSize: 12, letterSpacing: 1, fontWeight: '700', textAlign: 'center' }}>
          {s.reciteHeaderTitle.toUpperCase()}
        </Text>

        <ScrollView contentContainerStyle={{ gap: t.spacing(4), paddingBottom: t.spacing(10) }} showsVerticalScrollIndicator={false}>
          <Card watermark rounded="xl" style={{ padding: t.spacing(5) }}>
            {loadError && <Text style={{ color: t.colors.danger }}>{loadError}</Text>}
            {!ayah && !loadError && <ActivityIndicator color={t.accent.primary} />}
            {ayah && (
              <View style={{ gap: t.spacing(3) }}>
                <Text
                  allowFontScaling={false}
                  textBreakStrategy="simple"
                  style={{
                    color: t.colors.text, fontSize: 26, lineHeight: Platform.OS === 'android' ? 60 : 48,
                    textAlign: 'center', writingDirection: 'rtl', fontFamily: arabicFontFamily,
                  }}
                >
                  {tajweedSegments
                    ? tajweedSegments.map((seg, i) =>
                        seg.rule
                          ? <Text key={i} style={{ color: TAJWEED_COLORS[seg.rule] }}>{seg.text}</Text>
                          : seg.text)
                    : ayah.arabic}
                </Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
                  {ayah.translation}
                </Text>
              </View>
            )}
          </Card>

          <Text style={{ color: t.colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
            {s.reciteInstruction}
          </Text>

          {(stage === 'idle' || stage === 'recording') && (
            <View style={{ alignItems: 'center', paddingVertical: t.spacing(3) }}>
              <RecordButton
                isRecording={stage === 'recording'}
                durationMillis={recorderState.durationMillis}
                metering={recorderState.metering}
                onPress={stage === 'recording' ? stopRecording : startRecording}
              />
              <Text style={{ color: t.colors.textMuted, fontSize: 13, marginTop: t.spacing(3), fontWeight: '600' }}>
                {stage === 'recording' ? s.reciteRecording : s.reciteTapToRecord}
              </Text>
              {errorMsg && stage === 'idle' && (
                <Text style={{ color: t.colors.danger, fontSize: 13, textAlign: 'center', marginTop: t.spacing(3), paddingHorizontal: t.spacing(4) }}>
                  {errorMsg}
                </Text>
              )}
            </View>
          )}

          {stage === 'recorded' && (
            <Card rounded="lg" style={{ gap: t.spacing(3) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
                <Pressable
                  onPress={togglePlayback}
                  style={({ pressed }) => ({
                    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: t.accent.primary, transform: [{ scale: pressed ? t.pressedScale : 1 }],
                  })}
                >
                  <Ionicons name={playerStatus.playing ? 'pause' : 'play'} size={20} color={t.accent.onPrimary} />
                </Pressable>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceMuted }}>
                  <View style={{ height: 6, width: `${Math.round(playbackProgress * 100)}%`, borderRadius: 3, backgroundColor: t.accent.primary }} />
                </View>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
                  {formatMs(recordedDurationMs)}
                </Text>
              </View>

              {quietWarning && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                  <Ionicons name="warning-outline" size={16} color={t.colors.brass} />
                  <Text style={{ color: t.colors.brass, fontSize: 13, flex: 1 }}>{s.reciteQuietWarning}</Text>
                </View>
              )}
              {errorMsg && <Text style={{ color: t.colors.danger, fontSize: 13 }}>{errorMsg}</Text>}

              <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
                <Button label={s.reciteTryAgain} variant="secondary" onPress={reRecord} style={{ flex: 1 }} />
                <Button label={s.reciteGetFeedback} onPress={submitForFeedback} style={{ flex: 1 }} />
              </View>
            </Card>
          )}

          {stage === 'analyzing' && (
            <View style={{ alignItems: 'center', gap: t.spacing(3), paddingVertical: t.spacing(5) }}>
              <ActivityIndicator color={t.accent.primary} size="large" />
              <Text style={{ color: t.colors.textMuted, fontSize: 14 }}>{s.reciteAnalyzing}</Text>
            </View>
          )}

          {stage === 'feedback' && feedback && (
            <View style={{ gap: t.spacing(4) }}>
              {!feedback.recognizedSpeech ? (
                <Card rounded="lg" style={{ alignItems: 'center', gap: t.spacing(2) }}>
                  <Ionicons name="ear-outline" size={28} color={t.colors.textMuted} />
                  <Text style={{ color: t.colors.text, textAlign: 'center', fontSize: 15 }}>{s.reciteNotRecognized}</Text>
                </Card>
              ) : (
                <>
                  <View style={{ alignItems: 'center', gap: t.spacing(3) }}>
                    <ScoreGauge score={feedback.accuracyScore} label={s.reciteAccuracy} />
                    <Text style={{ color: t.colors.text, textAlign: 'center', fontSize: 15, lineHeight: 22, paddingHorizontal: t.spacing(2) }}>
                      {feedback.summary}
                    </Text>
                  </View>

                  {feedback.words.length > 0 && (
                    <Card rounded="lg" style={{ gap: t.spacing(3) }}>
                      <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
                        {s.reciteWordsHeading.toUpperCase()}
                      </Text>
                      <Text style={{ writingDirection: 'rtl', textAlign: 'right', lineHeight: 44 }}>
                        {feedback.words.map((w, i) => (
                          <Fragment key={i}>
                            <WordFeedbackChip
                              word={w.word}
                              status={w.status}
                              fontSize={24}
                              fontFamily={arabicFontFamily}
                              onPress={() => setSelectedWord(w)}
                            />
                            {i < feedback.words.length - 1 ? ' ' : ''}
                          </Fragment>
                        ))}
                      </Text>
                    </Card>
                  )}

                  {feedback.tajweedNotes.length > 0 && (
                    <Card rounded="lg" style={{ gap: t.spacing(1) }}>
                      <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
                        {s.reciteTajweedHeading.toUpperCase()}
                      </Text>
                      {feedback.tajweedNotes.map((n, i) => <TajweedNoteRow key={i} note={n} />)}
                    </Card>
                  )}

                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), alignSelf: 'center',
                    paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2), borderRadius: t.radius.pill,
                    backgroundColor: t.accent.primarySoft,
                  }}>
                    <Ionicons name="sparkles" size={14} color={t.colors.brass} />
                    <Text style={{ color: t.colors.success, fontWeight: '700', fontSize: 13 }}>{feedback.encouragement}</Text>
                  </View>
                </>
              )}

              <Button label={s.recitePracticeAgain} variant="secondary" onPress={practiceAgain} />
            </View>
          )}
        </ScrollView>
      </View>

      <WordNoteSheet word={selectedWord} arabicFontFamily={arabicFontFamily} onClose={() => setSelectedWord(null)} />
    </SafeAreaView>
  );
}
