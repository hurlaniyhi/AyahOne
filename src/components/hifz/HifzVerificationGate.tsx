import { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { getSurahContent, type Ayah } from '@/data/quranApi';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor } from '@/lib/quranText';
import { parseTajweedForRender, stripTajweed, TAJWEED_COLORS } from '@/lib/tajweed';
import { getRecitationFeedback, tajweedRulesIn, IslamicAiError, type RecitationFeedback } from '@/lib/recitationAi';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { InlineNotice } from '@/components/InlineNotice';
import { RecordButton } from '@/components/recitation/RecordButton';
import { ScoreGauge } from '@/components/recitation/ScoreGauge';
import { useRecitationRecorder } from './useRecitationRecorder';

interface Props {
  surah: number;
  ayahNumbers: number[];   // memorized range, ascending
  passMark: number;
  onComplete: () => void;  // all passed OR bypass — session moves on
  onTurnOff: () => void;   // skip verification for THIS session only
}

export function HifzVerificationGate({ surah, ayahNumbers, passMark, onComplete, onTurnOff }: Props) {
  const t = useTheme();
  const s = useStrings();
  const arabicFontFamily = arabicFontFor('tajweed');
  const addRecitationAttempt = useAppStore(st => st.addRecitationAttempt);
  const markHifzVerified = useAppStore(st => st.markHifzVerified);

  // Resume point: any ayahs already verified in a previous (interrupted)
  // visit are skipped, so leaving mid-verification and returning lands on the
  // same ayah the user still owes a recitation for — not the next one.
  const initial = useMemo(() => {
    const verified = useAppStore.getState().hifzVerified;
    const passedSet = new Set(ayahNumbers.filter(n => verified[`${surah}:${n}`]));
    let idx = ayahNumbers.findIndex(n => !verified[`${surah}:${n}`]);
    if (idx === -1) idx = Math.max(0, ayahNumbers.length - 1);
    return { idx, passedSet };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, ayahNumbers.join(',')]);

  const [content, setContent] = useState<Ayah[] | null>(null);
  const [verifyIndex, setVerifyIndex] = useState(initial.idx);
  const [passed, setPassed] = useState<Set<number>>(initial.passedSet);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<RecitationFeedback | null>(null);

  const rec = useRecitationRecorder({
    micPermissionMessage: s.reciteMicPermissionBody,
    recordingErrorMessage: s.reciteRecordingError,
  });

  // Mark every ayah in the range verified so Today's Goal advances instead of
  // re-anchoring here. Used by both the offline bypass and the per-session
  // "turn off" — neither should trap the user on the same range next time.
  const markRangeVerified = () => { for (const n of ayahNumbers) markHifzVerified(surah, n); };

  useEffect(() => {
    let alive = true;
    getSurahContent(surah, 'en.sahih', 'tajweed')
      .then(c => { if (alive) setContent(c.ayahs); })
      .catch(() => { if (alive) rec.setErrorMsg(s.reciteError); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah]);

  const ayahNumber = ayahNumbers[verifyIndex];
  const ayah = content ? content[ayahNumber - 1] ?? null : null;
  const plainArabic = useMemo(() => (ayah ? stripTajweed(ayah.arabic) : ''), [ayah]);
  const rules = useMemo(() => (ayah ? tajweedRulesIn(ayah.arabic) : []), [ayah]);
  const segments = useMemo(
    () => (ayah ? parseTajweedForRender(ayah.arabic, Platform.OS === 'android') : null),
    [ayah],
  );
  const isLast = verifyIndex >= ayahNumbers.length - 1;
  const passedThis = feedback != null && feedback.recognizedSpeech && feedback.accuracyScore >= passMark;

  const submit = async () => {
    if (!rec.recordingUri || !ayah) return;
    setAnalyzing(true);
    rec.setErrorMsg(null);
    try {
      const base64 = await new File(rec.recordingUri).base64();
      const result = await getRecitationFeedback(plainArabic, rules, base64, 'audio/aac');
      setFeedback(result);
      addRecitationAttempt({
        id: `${surah}:${ayahNumber}:${Date.now()}`,
        surah, ayah: ayahNumber, score: result.accuracyScore, date: new Date().toISOString(),
      });
      void Haptics.notificationAsync(
        result.recognizedSpeech && result.accuracyScore >= passMark
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    } catch (e) {
      // Offline: bypass verification for this session (the plan setting stays
      // on so it resumes when back online). Mark the range verified so the
      // user actually advances to the next verses rather than being sent back
      // to re-record the same ayahs on Continue.
      if (e instanceof IslamicAiError && e.code === 'network') { markRangeVerified(); onComplete(); return; }
      const code = e instanceof IslamicAiError ? e.code : 'http';
      rec.setErrorMsg(code === 'no-key' ? s.reciteApiKeyMissing : code === 'blocked' ? s.reciteErrorBlocked : s.reciteError);
    } finally {
      setAnalyzing(false);
    }
  };

  const advance = () => {
    const next = new Set(passed); next.add(ayahNumber); setPassed(next);
    markHifzVerified(surah, ayahNumber);
    if (isLast) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete(); return; }
    setVerifyIndex(i => i + 1);
    setFeedback(null);
    rec.reset();
  };

  const retry = () => { setFeedback(null); rec.reset(); };

  return (
    <View style={{ flex: 1, gap: t.spacing(4) }}>
      <View style={{ alignItems: 'center', gap: t.spacing(1) }}>
        <Text style={{ color: t.colors.brass, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>
          {s.hifzVerifyGateTitle.toUpperCase()}
        </Text>
        <Text style={{ color: t.colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
          {s.hifzVerifyGateSubtitle.replace('{passMark}', String(passMark))}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing(2) }}>
        {ayahNumbers.map((n, i) => {
          const done = passed.has(n);
          const current = i === verifyIndex;
          return (
            <View key={n} style={{
              width: current ? 12 : 9, height: current ? 12 : 9, borderRadius: 6,
              backgroundColor: done ? t.colors.success : current ? t.accent.primary : t.colors.surfaceMuted,
              borderWidth: current && !done ? 2 : 0, borderColor: t.accent.primary,
            }} />
          );
        })}
      </View>

      <Card watermark rounded="xl" style={{ padding: t.spacing(5) }}>
        {!ayah ? <ActivityIndicator color={t.accent.primary} /> : (
          <Text
            allowFontScaling={false}
            textBreakStrategy="simple"
            style={{
              color: t.colors.text, fontSize: 26, lineHeight: arabicLineHeightFor(26),
              textAlign: 'center', writingDirection: 'rtl', fontFamily: arabicFontFamily,
              paddingHorizontal: t.spacing(Platform.OS === 'android' ? 3 : 2), paddingVertical: t.spacing(1.5),
            }}
          >
            {segments
              ? segments.map((seg, i) => seg.rule ? <Text key={i} style={{ color: TAJWEED_COLORS[seg.rule] }}>{seg.text}</Text> : seg.text)
              : ayah.arabic}
          </Text>
        )}
      </Card>

      {analyzing ? (
        <View style={{ alignItems: 'center', gap: t.spacing(3), paddingVertical: t.spacing(4) }}>
          <ActivityIndicator color={t.accent.primary} size="large" />
          <Text style={{ color: t.colors.textMuted, fontSize: 14 }}>{s.hifzVerifyAnalyzing}</Text>
        </View>
      ) : feedback ? (
        <View style={{ gap: t.spacing(3), alignItems: 'center' }}>
          {!feedback.recognizedSpeech ? (
            <InlineNotice tone="danger" icon="ear-outline" text={s.hifzVerifyNotRecognized} />
          ) : (
            <>
              <ScoreGauge score={feedback.accuracyScore} label={s.reciteAccuracy} />
              {passedThis ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), alignSelf: 'stretch',
                  paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(3), borderRadius: t.radius.lg,
                  backgroundColor: t.accent.primarySoft, borderLeftWidth: 3, borderLeftColor: t.colors.success,
                }}>
                  <Ionicons name="checkmark-circle" size={18} color={t.colors.success} />
                  <Text style={{ color: t.colors.success, fontWeight: '700', fontSize: 14, flex: 1 }}>
                    {(isLast ? s.hifzVerifyAllPassed : s.hifzVerifyPassed).replace('{score}', String(feedback.accuracyScore))}
                  </Text>
                </View>
              ) : (
                <InlineNotice
                  tone="danger"
                  icon="alert-circle-outline"
                  text={s.hifzVerifyFailed.replace('{passMark}', String(passMark)).replace('{score}', String(feedback.accuracyScore))}
                />
              )}
            </>
          )}
          {passedThis
            ? <Button label={isLast ? s.hifzVerifyContinue : s.hifzVerifyNext} onPress={advance} style={{ alignSelf: 'stretch' }} />
            : <Button label={s.hifzVerifyRetry} variant="secondary" onPress={retry} style={{ alignSelf: 'stretch' }} />}
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: t.spacing(2) }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '600' }}>
            {s.hifzVerifyRecordPrompt.replace('{n}', String(verifyIndex + 1)).replace('{total}', String(ayahNumbers.length))}
          </Text>
          <RecordButton
            isRecording={rec.stage === 'recording'}
            durationMillis={rec.durationMillis}
            metering={rec.metering}
            disabled={!ayah}
            onPress={rec.stage === 'recording' ? rec.stopRecording : rec.startRecording}
          />
          {rec.stage === 'recorded' && (
            <Button label={s.reciteGetFeedback} onPress={submit} style={{ alignSelf: 'stretch', marginTop: t.spacing(2) }} />
          )}
          {rec.errorMsg && <InlineNotice tone="danger" icon="alert-circle-outline" text={rec.errorMsg} />}
        </View>
      )}

      <Pressable onPress={() => { markRangeVerified(); onTurnOff(); }} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: t.spacing(2) }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
          {s.hifzVerifyTurnOff}
        </Text>
      </Pressable>
    </View>
  );
}
