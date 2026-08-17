import React, { useEffect, useRef, useState } from 'react';
import { Modal, SafeAreaView, View, Text, Pressable, ScrollView, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { getSurah } from '@/data/surahs';
import { Button } from './Button';
import { SurahPickerSheet } from './SurahPickerSheet';
import { VersePickerSheet } from './VersePickerSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const GOAL_PRESETS = [5, 10, 20, 50, 100];

export function GoalEditSheet({ visible, onClose }: Props) {
  const t = useTheme();
  const s = useStrings();
  const lastRead = useAppStore(st => st.lastRead);
  const dailyGoal = useAppStore(st => st.dailyGoalVerses);
  const setLastRead = useAppStore(st => st.setLastRead);
  const setDailyGoal = useAppStore(st => st.setDailyGoal);

  const [surahNumber, setSurahNumber] = useState<number>(lastRead?.surah ?? 1);
  const [verse, setVerse] = useState<number>(lastRead?.ayah ?? 1);
  const [goal, setGoal] = useState<number>(dailyGoal);
  const [showSurah, setShowSurah] = useState(false);
  const [showVerse, setShowVerse] = useState(false);
  // Whether the goal is being entered as a free-form number rather than one
  // of the presets — seeded from the current goal so reopening the sheet on
  // an already-custom value shows the input pre-filled instead of no chip
  // active at all.
  const [customMode, setCustomMode] = useState(() => !GOAL_PRESETS.includes(dailyGoal));
  const [customText, setCustomText] = useState(() => (!GOAL_PRESETS.includes(dailyGoal) ? String(dailyGoal) : ''));
  // The custom field sits above the Save button, close to where the keyboard
  // covers. KeyboardAvoidingView's own padding calculation still left a
  // sliver covered (it commonly under-shoots by the bottom safe-area inset
  // when paired with a SafeAreaView) — reserving the keyboard's OWN reported
  // height as scroll padding is exact, since it comes straight from the
  // event rather than a platform heuristic.
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const onShow = Keyboard.addListener('keyboardDidShow', e => {
      setKbHeight(e.endCoordinates.height);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  // The Modal's `visible` prop only hides/shows this subtree — it doesn't
  // unmount it — so the useState initialisers above only ever ran once, on
  // this component's very first mount. Any goal/position set elsewhere
  // (Account settings, a previous session) after that first mount was never
  // reflected here. Re-sync from the store every time the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    setSurahNumber(lastRead?.surah ?? 1);
    setVerse(lastRead?.ayah ?? 1);
    setGoal(dailyGoal);
    setCustomMode(!GOAL_PRESETS.includes(dailyGoal));
    setCustomText(!GOAL_PRESETS.includes(dailyGoal) ? String(dailyGoal) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const surah = getSurah(surahNumber)!;

  const save = () => {
    setLastRead({ surah: surahNumber, ayah: verse });
    setDailyGoal(goal);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: t.spacing(4), paddingBottom: t.spacing(4) + kbHeight, gap: t.spacing(3) }}
        >
          <View style={{ height: 32, justifyContent: 'center' }}>
            <View style={{
              alignSelf: 'center', width: 48, height: 5, borderRadius: 3,
              backgroundColor: t.mode === 'dark' ? '#6B7280' : '#9CA3AF',
            }} />
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{
                position: 'absolute', right: 0, top: 0,
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surface,
                borderWidth: 1, borderColor: t.colors.border,
              }}
            >
              <Ionicons name="close" size={20} color={t.colors.text} />
            </Pressable>
          </View>
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 22, textAlign: 'center' }}>
            {s.goal}
          </Text>

          <Pressable onPress={() => setShowSurah(true)}>
            <View style={{
              padding: t.spacing(4), backgroundColor: t.colors.surface,
              borderRadius: t.radius.lg, flexDirection: 'row',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <View>
                <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{s.surah}</Text>
                <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 18 }}>
                  {surah.number}. {surah.englishName}
                </Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>
                  {surah.englishTranslation} · {surah.numberOfAyahs} {s.versesCount}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={t.colors.textMuted} />
            </View>
          </Pressable>

          <Pressable onPress={() => setShowVerse(true)}>
            <View style={{
              padding: t.spacing(4), backgroundColor: t.colors.surface,
              borderRadius: t.radius.lg, flexDirection: 'row',
              alignItems: 'center', justifyContent: 'space-between',
            }}>
              <View>
                <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{s.startFromVerse}</Text>
                <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 18 }}>
                  {verse} / {surah.numberOfAyahs}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={t.colors.textMuted} />
            </View>
          </Pressable>

          <View style={{
            padding: t.spacing(4), backgroundColor: t.colors.surface,
            borderRadius: t.radius.lg, gap: t.spacing(3),
          }}>
            <Text style={{ color: t.colors.text, fontWeight: '700' }}>
              {s.streakDailyGoal}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2) }}>
              {GOAL_PRESETS.map(n => {
                const active = !customMode && goal === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => { setGoal(n); setCustomMode(false); setCustomText(''); }}
                    style={{
                      paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2),
                      borderRadius: t.radius.pill,
                      backgroundColor: active ? t.accent.primary : 'transparent',
                      borderWidth: 1, borderColor: active ? t.accent.primary : t.colors.border,
                    }}
                  >
                    <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700' }}>
                      {n} {s.versesPerDay}
                    </Text>
                  </Pressable>
                );
              })}
              {/* A verse goal outside the presets (e.g. 15, 30, 250) has no
                  chip of its own otherwise — tapping this reveals a plain
                  number field instead of forcing the reader into one of the
                  fixed counts above. */}
              <Pressable
                onPress={() => { setCustomMode(true); if (!customText) setCustomText(String(goal)); }}
                style={{
                  paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2),
                  borderRadius: t.radius.pill,
                  backgroundColor: customMode ? t.accent.primary : 'transparent',
                  borderWidth: 1, borderColor: customMode ? t.accent.primary : t.colors.border,
                }}
              >
                <Text style={{ color: customMode ? t.accent.onPrimary : t.colors.text, fontWeight: '700' }}>
                  {s.goalCustomLabel}
                </Text>
              </Pressable>
            </View>
            {customMode && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                <TextInput
                  value={customText}
                  onChangeText={txt => {
                    const digits = txt.replace(/[^0-9]/g, '');
                    setCustomText(digits);
                    const n = parseInt(digits, 10);
                    if (n > 0) setGoal(n);
                  }}
                  placeholder={s.goalCustomPlaceholder}
                  placeholderTextColor={t.colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={{
                    flex: 1,
                    backgroundColor: t.colors.background,
                    borderWidth: 1, borderColor: t.accent.primary,
                    borderRadius: t.radius.md,
                    paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2.5),
                    color: t.colors.text, fontSize: 16, fontWeight: '700',
                  }}
                />
                <Text style={{ color: t.colors.textMuted, fontWeight: '600' }}>{s.versesPerDay}</Text>
              </View>
            )}
          </View>

          <Button
            label="Save"
            onPress={save}
            disabled={customMode && !(parseInt(customText, 10) > 0)}
            style={{ marginTop: t.spacing(3) }}
          />
        </ScrollView>

        <SurahPickerSheet
          visible={showSurah}
          selectedSurah={surahNumber}
          onClose={() => setShowSurah(false)}
          onSelectSurah={(n) => { setSurahNumber(n); setVerse(1); }}
        />
        <VersePickerSheet
          visible={showVerse}
          totalVerses={surah.numberOfAyahs}
          selectedVerse={verse}
          onClose={() => setShowVerse(false)}
          onSelect={setVerse}
        />
      </SafeAreaView>
    </Modal>
  );
}
