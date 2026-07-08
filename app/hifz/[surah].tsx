import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { useHifzSurahProgress } from '@/store/selectors';
import { getSurah } from '@/data/surahs';
import { getSurahContent, type Ayah } from '@/data/quranApi';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor } from '@/lib/quranText';
import { isDue, type HifzGrade } from '@/lib/hifz';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { VerseAudioListen } from '@/components/VerseAudioListen';
import { HifzWordTile } from '@/components/hifz/HifzWordTile';
import { HifzGradeButtons } from '@/components/hifz/HifzGradeButtons';
import { HifzMilestoneModal } from '@/components/hifz/HifzMilestoneModal';

export default function HifzPracticeScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ surah: string; mode?: string }>();
  const surahNumber = Math.max(1, Math.min(114, parseInt(params.surah ?? '1', 10) || 1));
  const dueOnly = params.mode === 'due';
  const surahMeta = getSurah(surahNumber)!;
  const arabicFontFamily = arabicFontFor('uthmani');

  const settings = useAppStore(st => st.settings);
  const hifzProgress = useAppStore(st => st.hifzProgress);
  const recordHifzReview = useAppStore(st => st.recordHifzReview);
  const surahStat = useHifzSurahProgress(surahNumber, surahMeta.numberOfAyahs);

  const [ayahs, setAyahs] = useState<Ayah[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setAyahs(null);
    setLoadError(null);
    getSurahContent(surahNumber, settings.translationId, 'uthmani')
      .then(c => { if (alive) setAyahs(c.ayahs); })
      .catch(e => { if (alive) setLoadError(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [surahNumber, settings.translationId]);

  // Session queue: due-only when entered from the hub's "Due for Review"
  // row, otherwise every ayah in the surah in natural reading order (the
  // sequence memorization actually follows).
  const queue = useMemo(() => {
    if (!ayahs) return [];
    if (!dueOnly) return ayahs.map(a => a.numberInSurah);
    return ayahs
      .filter(a => {
        const st = hifzProgress[`${surahNumber}:${a.numberInSurah}`];
        return st && isDue(st);
      })
      .map(a => a.numberInSurah);
    // hifzProgress intentionally excluded — the queue is captured once when
    // the session starts so grading an ayah doesn't reshuffle the list the
    // user is currently working through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayahs, dueOnly, surahNumber]);

  const [sessionIndex, setSessionIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [milestoneVisible, setMilestoneVisible] = useState(false);

  const currentAyahNumber = queue[sessionIndex];
  const current = ayahs?.find(a => a.numberInSurah === currentAyahNumber);
  const words = useMemo(() => (current ? current.arabic.split(/\s+/).filter(Boolean) : []), [current]);
  const finished = ayahs != null && sessionIndex >= queue.length;

  const resetWordState = () => { setRevealed(new Set()); setShowAll(false); };

  const toggleWord = (i: number) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleGrade = (grade: HifzGrade) => {
    if (!current) return;
    recordHifzReview(surahNumber, current.numberInSurah, grade);
    const isLastInQueue = sessionIndex + 1 >= queue.length;
    if (isLastInQueue && !dueOnly) {
      // Check the *post-grade* progress: recordHifzReview above has already
      // committed the update, so a fresh read reflects whether this grade
      // was the one that pushed every ayah in the surah to 'mastered'.
      const updated = useAppStore.getState().hifzProgress;
      let allMastered = true;
      for (let n = 1; n <= surahMeta.numberOfAyahs; n++) {
        if (updated[`${surahNumber}:${n}`]?.strength !== 'mastered') { allMastered = false; break; }
      }
      if (allMastered) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMilestoneVisible(true);
      }
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetWordState();
    setSessionIndex(i => i + 1);
  };

  const close = () => router.back();
  const progress = queue.length ? Math.min(1, sessionIndex / queue.length) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), gap: t.spacing(3), flex: 1 }}>
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
          <Text style={{ color: t.colors.brass, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>
            {surahMeta.englishName.toUpperCase()}
          </Text>
          <View style={{
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1),
            borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
          }}>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 12 }}>
              {surahStat.mastered}/{surahStat.total}
            </Text>
          </View>
        </View>

        {queue.length > 0 && (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceMuted }}>
            <View style={{ height: 6, width: `${Math.round(progress * 100)}%`, borderRadius: 3, backgroundColor: t.accent.primary }} />
          </View>
        )}

        {!ayahs && !loadError && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={t.accent.primary} />
          </View>
        )}
        {loadError && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.colors.danger }}>{loadError}</Text>
          </View>
        )}

        {ayahs && queue.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(3), paddingHorizontal: t.spacing(6) }}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={t.colors.textMuted} />
            <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
              {s.hifzNothingDue}
            </Text>
            <Button label={s.hifzBackToHub} variant="secondary" onPress={close} />
          </View>
        )}

        {ayahs && queue.length > 0 && !finished && current && (
          <ScrollView contentContainerStyle={{ gap: t.spacing(4), paddingBottom: t.spacing(10) }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: t.colors.textMuted, textAlign: 'center', fontSize: 13 }}>
              {s.hifzAyahOf.replace('{n}', String(sessionIndex + 1)).replace('{total}', String(queue.length))}
            </Text>

            <Card watermark rounded="xl" style={{ padding: t.spacing(5), gap: t.spacing(3) }}>
              <Text
                allowFontScaling={false}
                textBreakStrategy="simple"
                style={{
                  writingDirection: 'rtl', textAlign: 'center',
                  lineHeight: arabicLineHeightFor(28),
                  paddingHorizontal: t.spacing(Platform.OS === 'android' ? 3 : 2),
                  paddingVertical: t.spacing(1.5),
                }}
              >
                {words.map((w, i) => (
                  <Text key={i}>
                    <HifzWordTile
                      word={w}
                      revealed={showAll || revealed.has(i)}
                      fontSize={28}
                      fontFamily={arabicFontFamily}
                      onPress={() => toggleWord(i)}
                    />
                    {i < words.length - 1 ? ' ' : ''}
                  </Text>
                ))}
              </Text>

              <Pressable
                onPress={() => setShowAll(v => !v)}
                style={({ pressed }) => ({
                  alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                  paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
                  borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name={showAll ? 'eye-off-outline' : 'eye-outline'} size={16} color={t.accent.primary} />
                <Text style={{ color: t.accent.primary, fontWeight: '700', fontSize: 13 }}>
                  {showAll ? s.hifzHideAll : s.hifzRevealAll}
                </Text>
              </Pressable>
            </Card>

            <VerseAudioListen surah={surahNumber} ayah={current.numberInSurah} reciterId={settings.reciterId} />

            <View style={{ gap: t.spacing(2) }}>
              <Text style={{ color: t.colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                {s.hifzGradePrompt}
              </Text>
              <HifzGradeButtons onGrade={handleGrade} />
            </View>
          </ScrollView>
        )}

        {finished && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(3), paddingHorizontal: t.spacing(6) }}>
            <Ionicons name="sparkles-outline" size={48} color={t.colors.brass} />
            <Text style={{ color: t.colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
              {s.hifzSessionComplete}
            </Text>
            <Button label={s.hifzBackToHub} onPress={close} />
          </View>
        )}
      </View>

      <HifzMilestoneModal
        visible={milestoneVisible}
        surahName={surahMeta.englishName}
        ayahCount={surahMeta.numberOfAyahs}
        onClose={() => setMilestoneVisible(false)}
      />
    </SafeAreaView>
  );
}
