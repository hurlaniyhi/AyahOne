import React, { useState } from 'react';
import { Modal, SafeAreaView, View, Text, Pressable, ScrollView } from 'react-native';
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

  const surah = getSurah(surahNumber)!;

  const save = () => {
    setLastRead({ surah: surahNumber, ayah: verse });
    setDailyGoal(goal);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3) }}>
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
              Daily goal
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2) }}>
              {GOAL_PRESETS.map(n => {
                const active = goal === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setGoal(n)}
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
            </View>
          </View>

          <Button label="Save" onPress={save} style={{ marginTop: t.spacing(3) }} />
        </ScrollView>

        <SurahPickerSheet
          visible={showSurah}
          selectedSurah={surahNumber}
          onClose={() => setShowSurah(false)}
          onSelect={(n) => { setSurahNumber(n); setVerse(1); }}
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
