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
import { getKaraokeAyahData } from '@/data/hifzKaraoke';
import { arabicFontFor, arabicLineHeight as arabicLineHeightFor, stripBismillahPrefix, isQuranWordToken } from '@/lib/quranText';
import { isDue, shouldRequeueToday, type HifzGrade } from '@/lib/hifz';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { HifzAudioPlayer } from '@/components/hifz/HifzAudioPlayer';
import { HifzKaraokePlayer } from '@/components/hifz/HifzKaraokePlayer';
import { HifzWordTile } from '@/components/hifz/HifzWordTile';
import { HifzGradeButtons } from '@/components/hifz/HifzGradeButtons';
import { HifzMilestoneModal } from '@/components/hifz/HifzMilestoneModal';
import { HifzNoteSheet } from '@/components/hifz/HifzNoteSheet';

// Progressive hide ladder for ayahs that have never been reviewed before —
// starts fully revealed (a "Read" pass) and escalates through fractions of
// the ayah hidden, rather than jumping straight to a blank ayah for
// something the user has never even tried to recall. Percentage-based
// (not a fixed word count) so it scales sensibly to both a 3-word ayah and
// a 30-word one with the same number of "Hide More" taps. Already-reviewed
// ayahs skip straight to the last level (fully hidden) — that's the
// existing recall-test behaviour, unchanged.
const HIDE_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

// Standard Bismillah, shown as a non-interactive opener above ayah 1's word
// tiles for every surah except Al-Fatihah (1, where it IS ayah 1) and
// At-Tawbah (9). Kept out of the `words` array (see stripBismillahPrefix)
// since the karaoke word-timestamp data and the reciter audio it points at
// both exclude it — wiring it into the hide-ladder / karaoke index would
// throw off every word highlight by 4 words.
const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

export default function HifzPracticeScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ surah: string; mode?: string; start?: string; end?: string }>();
  const surahNumber = Math.max(1, Math.min(114, parseInt(params.surah ?? '1', 10) || 1));
  const dueOnly = params.mode === 'due';
  // Optional ayah range (e.g. from the hub's "Today's Goal" card) — scopes
  // the session to a slice of the surah instead of the whole thing. Ignored
  // when dueOnly is set; absent entirely for the normal "practice this
  // surah" entry point, which behaves exactly as before.
  const rangeStart = params.start ? parseInt(params.start, 10) : null;
  const rangeEnd = params.end ? parseInt(params.end, 10) : null;
  const surahMeta = getSurah(surahNumber)!;
  const arabicFontFamily = arabicFontFor('uthmani');

  const settings = useAppStore(st => st.settings);
  const recordHifzReview = useAppStore(st => st.recordHifzReview);
  const setHifzNote = useAppStore(st => st.setHifzNote);
  const surahStat = useHifzSurahProgress(surahNumber, surahMeta.numberOfAyahs);
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);

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
  // sequence memorization actually follows). Mutable (not a memo) because a
  // "Forgotten" grade re-inserts the ayah a few slots ahead for a same-day
  // retry — captured once via getState() so it doesn't reshuffle mid-session
  // as hifzProgress updates from grading.
  const [sessionQueue, setSessionQueue] = useState<number[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [hideLevel, setHideLevel] = useState(HIDE_FRACTIONS.length - 1);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!ayahs) return;
    if (dueOnly) {
      const progress = useAppStore.getState().hifzProgress;
      setSessionQueue(
        ayahs
          .filter(a => {
            const st = progress[`${surahNumber}:${a.numberInSurah}`];
            return st && isDue(st);
          })
          .map(a => a.numberInSurah),
      );
    } else if (rangeStart != null && rangeEnd != null) {
      setSessionQueue(
        ayahs
          .filter(a => a.numberInSurah >= rangeStart && a.numberInSurah <= rangeEnd)
          .map(a => a.numberInSurah),
      );
    } else {
      setSessionQueue(ayahs.map(a => a.numberInSurah));
    }
    setSessionIndex(0);
    setRevealed(new Set());
    setShowAll(false);
  }, [ayahs, dueOnly, surahNumber, rangeStart, rangeEnd]);

  const currentAyahNumber = sessionQueue[sessionIndex];
  const current = ayahs?.find(a => a.numberInSurah === currentAyahNumber);
  const showBismillah = current?.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9;
  const words = useMemo(() => {
    if (!current) return [];
    // filter(isQuranWordToken) drops space-separated waqf/pause marks so the
    // tile count matches QUL's word-by-word timing — otherwise every karaoke
    // highlight after a mark drifts forward. See isQuranWordToken in quranText.
    const split = current.arabic.split(/\s+/).filter(Boolean).filter(isQuranWordToken);
    return showBismillah ? stripBismillahPrefix(split) : split;
  }, [current, showBismillah]);
  const finished = ayahs != null && sessionIndex >= sessionQueue.length;

  const currentKey = current ? `${surahNumber}:${current.numberInSurah}` : null;
  const existingProgress = useAppStore(st => (currentKey ? st.hifzProgress[currentKey] : undefined));
  const currentNote = useAppStore(st => (currentKey ? st.hifzNotes[currentKey] : undefined));
  const isNewAyah = !existingProgress;
  const atMaxHideLevel = hideLevel >= HIDE_FRACTIONS.length - 1;
  const hiddenTailCount = words.length ? Math.round(HIDE_FRACTIONS[hideLevel] * words.length) : 0;
  const tailStartIndex = words.length - hiddenTailCount;

  // A brand-new ayah starts fully revealed (level 0) so the first pass is a
  // "Read" step, not an immediate blank test; an ayah already in progress
  // (has a hifzProgress entry) jumps straight to the last level — the
  // existing full-hide recall test, unchanged for anyone already reviewing.
  useEffect(() => {
    if (currentAyahNumber == null) return;
    setRevealed(new Set());
    setShowAll(false);
    setHideLevel(isNewAyah ? 0 : HIDE_FRACTIONS.length - 1);
    setActiveWordIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAyahNumber, isNewAyah]);

  // Karaoke word-sync only during the fully-revealed "Read" step
  // (hideLevel === 0) — highlighting which word is being spoken while words
  // are hidden would defeat the recall test. getKaraokeAyahData already
  // encodes "this reciter+ayah has QUL timestamp data"; null here just means
  // render the existing non-karaoke HifzAudioPlayer instead.
  const karaokeData = useMemo(
    () => (hideLevel === 0 && current ? getKaraokeAyahData(settings.reciterId, surahNumber, current.numberInSurah) : null),
    [hideLevel, settings.reciterId, surahNumber, current],
  );

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
    const ayahNumber = current.numberInSurah;
    recordHifzReview(surahNumber, ayahNumber, grade);

    const isLastInQueue = sessionIndex + 1 >= sessionQueue.length;
    if (isLastInQueue && !dueOnly) {
      // Check the *post-grade* progress: recordHifzReview above has already
      // committed the update, so a fresh read reflects whether this grade
      // was the one that pushed every ayah in the surah to 'mastered'. A
      // "Forgotten" grade can never be the trigger here — the ayah it was
      // just given can't simultaneously be 'mastered' — so no false positive.
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

    // "Forgotten" means review again today, not just tomorrow — re-insert a
    // few ayahs ahead (or at the very end if the session is nearly over) so
    // the user hits it again before finishing this session.
    if (shouldRequeueToday(grade)) {
      setSessionQueue(prev => {
        const insertAt = Math.min(prev.length, sessionIndex + 4);
        return [...prev.slice(0, insertAt), ayahNumber, ...prev.slice(insertAt)];
      });
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetWordState();
    setSessionIndex(i => i + 1);
  };

  const close = () => router.back();
  const progress = sessionQueue.length ? Math.min(1, sessionIndex / sessionQueue.length) : 0;

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

        {sessionQueue.length > 0 && (
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

        {ayahs && sessionQueue.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing(3), paddingHorizontal: t.spacing(6) }}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={t.colors.textMuted} />
            <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
              {s.hifzNothingDue}
            </Text>
            <Button label={s.hifzBackToHub} variant="secondary" onPress={close} />
          </View>
        )}

        {ayahs && sessionQueue.length > 0 && !finished && current && (
          <ScrollView contentContainerStyle={{ gap: t.spacing(4), paddingBottom: t.spacing(10) }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: t.colors.textMuted, textAlign: 'center', fontSize: 13 }}>
              {s.hifzAyahOf.replace('{n}', String(sessionIndex + 1)).replace('{total}', String(sessionQueue.length))}
            </Text>

            <Card watermark rounded="xl" style={{ padding: t.spacing(5), gap: t.spacing(3) }}>
              <Pressable
                onPress={() => setNoteSheetVisible(true)}
                hitSlop={10}
                style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: t.spacing(1) }}
              >
                <Ionicons
                  name={currentNote ? 'document-text' : 'document-text-outline'}
                  size={18}
                  color={currentNote ? t.accent.primary : t.colors.textMuted}
                />
              </Pressable>

              {showBismillah && (
                <Text
                  allowFontScaling={false}
                  textBreakStrategy="simple"
                  style={{
                    color: t.colors.brass, writingDirection: 'rtl', textAlign: 'center',
                    fontSize: 22, lineHeight: arabicLineHeightFor(22),
                    fontFamily: arabicFontFamily,
                    paddingHorizontal: t.spacing(Platform.OS === 'android' ? 3 : 2),
                  }}
                >
                  {BISMILLAH}
                </Text>
              )}

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
                {words.map((w, i) => {
                  const inHiddenTail = i >= tailStartIndex;
                  return (
                    <Text key={i}>
                      <HifzWordTile
                        word={w}
                        revealed={!inHiddenTail || showAll || revealed.has(i)}
                        active={activeWordIndex === i}
                        fontSize={28}
                        fontFamily={arabicFontFamily}
                        onPress={() => toggleWord(i)}
                      />
                      {i < words.length - 1 ? ' ' : ''}
                    </Text>
                  );
                })}
              </Text>

              {isNewAyah && hideLevel === 0 && (
                <Text style={{ color: t.colors.textMuted, fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>
                  {s.hifzNewAyahHint}
                </Text>
              )}

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

            {karaokeData ? (
              <HifzKaraokePlayer
                surah={surahNumber}
                ayah={current.numberInSurah}
                reciterId={settings.reciterId}
                onActiveWordChange={setActiveWordIndex}
              />
            ) : (
              <HifzAudioPlayer surah={surahNumber} ayah={current.numberInSurah} reciterId={settings.reciterId} />
            )}

            {atMaxHideLevel ? (
              <View style={{ gap: t.spacing(2) }}>
                <Text style={{ color: t.colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                  {s.hifzGradePrompt}
                </Text>
                <HifzGradeButtons onGrade={handleGrade} />
              </View>
            ) : (
              <View style={{ gap: t.spacing(2) }}>
                <Button
                  label={s.hifzHideMore}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRevealed(new Set());
                    setShowAll(false);
                    setHideLevel(l => Math.min(HIDE_FRACTIONS.length - 1, l + 1));
                  }}
                  right={<Ionicons name="eye-off-outline" size={18} color={t.accent.onPrimary} />}
                />
                <Pressable
                  onPress={() => {
                    setRevealed(new Set());
                    setShowAll(false);
                    setHideLevel(HIDE_FRACTIONS.length - 1);
                  }}
                  style={({ pressed }) => ({ alignSelf: 'center', opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 13 }}>
                    {s.hifzSkipToTest}
                  </Text>
                </Pressable>
              </View>
            )}
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
      <HifzNoteSheet
        visible={noteSheetVisible}
        initialText={currentNote ?? ''}
        onSave={text => { if (current) setHifzNote(surahNumber, current.numberInSurah, text); }}
        onClose={() => setNoteSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
