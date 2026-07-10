import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore, type HifzGoalType } from '@/store/appStore';
import { SURAHS } from '@/data/surahs';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

const VERSES_PER_DAY_OPTIONS = [1, 2, 3, 5];

export default function HifzSetupScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const existingGoal = useAppStore(st => st.hifzGoalType);
  const existingVerses = useAppStore(st => st.hifzVersesPerDay);
  const existingSurahs = useAppStore(st => st.hifzGoalSurahs);
  const setHifzGoal = useAppStore(st => st.setHifzGoal);

  const [goalType, setGoalType] = useState<HifzGoalType>(existingGoal ?? 'whole');
  const [selectedSurahs, setSelectedSurahs] = useState<number[]>(existingSurahs);
  const [versesPerDay, setVersesPerDay] = useState<number>(existingVerses);
  const [customVerses, setCustomVerses] = useState(String(existingVerses));
  const [isCustom, setIsCustom] = useState(!VERSES_PER_DAY_OPTIONS.includes(existingVerses));

  const goalOptions: { id: HifzGoalType; icon: keyof typeof Ionicons.glyphMap; label: string; description: string }[] = [
    { id: 'whole', icon: 'globe-outline', label: s.hifzGoalWhole, description: s.hifzGoalWholeDesc },
    { id: 'surahs', icon: 'bookmarks-outline', label: s.hifzGoalSelectedSurahs, description: s.hifzGoalSelectedSurahsDesc },
    { id: 'juzAmma', icon: 'sparkles-outline', label: s.hifzGoalJuzAmma, description: s.hifzGoalJuzAmmaDesc },
  ];

  const toggleSurah = (n: number) => {
    setSelectedSurahs(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b));
  };

  const canSave = goalType !== 'surahs' || selectedSurahs.length > 0;

  const handleSave = () => {
    const finalVerses = isCustom ? Math.max(1, parseInt(customVerses, 10) || 1) : versesPerDay;
    setHifzGoal({ type: goalType, versesPerDay: finalVerses, surahs: goalType === 'surahs' ? selectedSurahs : undefined });
    router.replace('/hifz');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), gap: t.spacing(3), flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.colors.surface, borderWidth: 0.75, borderColor: t.colors.hairline,
              transform: [{ scale: pressed ? t.pressedScale : 1 }],
            })}
          >
            <Ionicons name="close" size={20} color={t.colors.text} />
          </Pressable>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 18 }}>
            {existingGoal ? s.hifzEditGoal : s.hifzSetupTitle}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ gap: t.spacing(5), paddingBottom: t.spacing(8) }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: t.colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 19, paddingHorizontal: t.spacing(3) }}>
            {s.hifzSetupSubtitle}
          </Text>

          <View style={{ gap: t.spacing(2) }}>
            <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
              {s.hifzGoalTypeLabel.toUpperCase()}
            </Text>
            {goalOptions.map(opt => {
              const active = goalType === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setGoalType(opt.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
                    padding: t.spacing(4), borderRadius: t.radius.lg,
                    backgroundColor: t.colors.surface,
                    borderWidth: active ? 1.5 : 0.75,
                    borderColor: active ? t.accent.primary : t.colors.hairline,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? t.accent.primarySoft : t.colors.surfaceMuted,
                  }}>
                    <Ionicons name={opt.icon} size={20} color={active ? t.accent.primary : t.colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: active ? t.accent.primary : t.colors.text, fontWeight: '700', fontSize: 15 }}>
                      {opt.label}
                    </Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>{opt.description}</Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={t.accent.primary} />
                  ) : (
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: t.colors.border }} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {goalType === 'surahs' && (
            <View style={{ gap: t.spacing(2) }}>
              <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
                {s.hifzSelectSurahs.toUpperCase()} {selectedSurahs.length > 0 ? `(${selectedSurahs.length})` : ''}
              </Text>
              <Card rounded="lg" style={{ padding: 0, maxHeight: 320, overflow: 'hidden' }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                  {SURAHS.map((surah, i) => {
                    const checked = selectedSurahs.includes(surah.number);
                    return (
                      <Pressable
                        key={surah.number}
                        onPress={() => toggleSurah(surah.number)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
                          paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(3),
                          borderBottomWidth: i < SURAHS.length - 1 ? 0.5 : 0,
                          borderBottomColor: t.colors.hairline,
                        }}
                      >
                        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? t.accent.primary : t.colors.textMuted} />
                        <Text style={{ flex: 1, color: t.colors.text, fontWeight: '600', fontSize: 14 }}>
                          {surah.number}. {surah.englishName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Card>
            </View>
          )}

          <View style={{ gap: t.spacing(2) }}>
            <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
              {s.hifzVersesPerDayLabel.toUpperCase()}
            </Text>
            <View style={{ flexDirection: 'row', gap: t.spacing(2) }}>
              {VERSES_PER_DAY_OPTIONS.map(n => {
                const active = !isCustom && versesPerDay === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => { setIsCustom(false); setVersesPerDay(n); }}
                    style={{
                      flex: 1, paddingVertical: t.spacing(3), borderRadius: t.radius.pill,
                      alignItems: 'center',
                      backgroundColor: active ? t.accent.primary : t.colors.surfaceMuted,
                    }}
                  >
                    <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700', fontSize: 14 }}>{n}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setIsCustom(true)}
                style={{
                  flex: 1, paddingVertical: t.spacing(3), borderRadius: t.radius.pill,
                  alignItems: 'center',
                  backgroundColor: isCustom ? t.accent.primary : t.colors.surfaceMuted,
                }}
              >
                <Text style={{ color: isCustom ? t.accent.onPrimary : t.colors.text, fontWeight: '700', fontSize: 14 }}>
                  {s.hifzCustom}
                </Text>
              </Pressable>
            </View>
            {isCustom && (
              <TextInput
                value={customVerses}
                onChangeText={setCustomVerses}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={t.colors.textMuted}
                style={{
                  borderWidth: 0.75, borderColor: t.colors.hairline, borderRadius: t.radius.md,
                  paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(3),
                  color: t.colors.text, fontSize: 16, fontWeight: '700',
                }}
              />
            )}
          </View>
        </ScrollView>

        <Button label={existingGoal ? s.hifzSaveGoal : s.hifzStartPlan} onPress={handleSave} disabled={!canSave} />
      </View>
    </SafeAreaView>
  );
}
