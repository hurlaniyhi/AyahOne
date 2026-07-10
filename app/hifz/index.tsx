import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { SURAHS, getSurah } from '@/data/surahs';
import { useAppStore } from '@/store/appStore';
import {
  useHifzDueQueue, useHifzJuzStats, useHifzMostForgotten, useHifzOverallStats, useHifzSurahProgress, useHifzTodaysGoal,
} from '@/store/selectors';
import { formatNumber } from '@/lib/format';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

function SurahProgressRow({ surahNumber, name, translation, totalAyahs, onPress }: {
  surahNumber: number; name: string; translation: string; totalAyahs: number; onPress: () => void;
}) {
  const t = useTheme();
  const progress = useHifzSurahProgress(surahNumber, totalAyahs);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
        paddingVertical: t.spacing(3), paddingHorizontal: t.spacing(1),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: progress.percent === 100 ? t.accent.primarySoft : t.colors.surfaceMuted,
      }}>
        {progress.percent === 100 ? (
          <Ionicons name="checkmark" size={18} color={t.accent.primary} />
        ) : (
          <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 12 }}>{surahNumber}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
          {name} <Text style={{ color: t.colors.textMuted, fontWeight: '500', fontSize: 12 }}>· {translation}</Text>
        </Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: t.colors.surfaceMuted }}>
          <View style={{ height: 4, width: `${progress.percent}%`, borderRadius: 2, backgroundColor: t.accent.primary }} />
        </View>
      </View>
      <Text style={{ color: t.colors.textMuted, fontSize: 12, fontWeight: '600', width: 32, textAlign: 'right' }}>
        {progress.percent}%
      </Text>
      <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
    </Pressable>
  );
}

export default function HifzHub() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const overall = useHifzOverallStats();
  const juzStats = useHifzJuzStats();
  const dueQueue = useHifzDueQueue();
  const goalType = useAppStore(st => st.hifzGoalType);
  const todaysGoal = useHifzTodaysGoal();
  const mostForgotten = useHifzMostForgotten(5);

  const dueBySurah = new Map<number, number>();
  for (const { surah } of dueQueue) dueBySurah.set(surah, (dueBySurah.get(surah) ?? 0) + 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: t.spacing(4), paddingTop: t.spacing(2), gap: t.spacing(4), flex: 1 }}>
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
            <Ionicons name="arrow-back" size={20} color={t.colors.text} />
          </Pressable>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 20 }}>{s.hifzTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
            {overall.streakDays > 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: t.spacing(1),
                paddingHorizontal: t.spacing(2.5), paddingVertical: t.spacing(1),
                borderRadius: t.radius.pill, backgroundColor: t.accent.primarySoft,
              }}>
                <Ionicons name="flame" size={14} color={t.colors.brass} />
                <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 12 }}>{overall.streakDays}</Text>
              </View>
            )}
            <Pressable
              onPress={() => router.push('/hifz/search')}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surface, borderWidth: 0.75, borderColor: t.colors.hairline,
                transform: [{ scale: pressed ? t.pressedScale : 1 }],
              })}
            >
              <Ionicons name="search-outline" size={18} color={t.colors.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/hifz/setup')}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surface, borderWidth: 0.75, borderColor: t.colors.hairline,
                transform: [{ scale: pressed ? t.pressedScale : 1 }],
              })}
            >
              <Ionicons name="options-outline" size={18} color={t.colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ gap: t.spacing(4), paddingBottom: t.spacing(8) }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: t.colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 19, paddingHorizontal: t.spacing(3) }}>
            {s.hifzSubtitle}
          </Text>

          {!goalType ? (
            <Pressable onPress={() => router.push('/hifz/setup')}>
              <Card watermark rounded="xl" style={{ alignItems: 'center', gap: t.spacing(2), paddingVertical: t.spacing(5) }}>
                <Ionicons name="compass-outline" size={32} color={t.accent.primary} />
                <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
                  {s.hifzSetupPromptTitle}
                </Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: t.spacing(4) }}>
                  {s.hifzSetupPromptSubtitle}
                </Text>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), marginTop: t.spacing(1),
                  paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2.5),
                  borderRadius: t.radius.pill, backgroundColor: t.accent.primary,
                }}>
                  <Text style={{ color: t.accent.onPrimary, fontWeight: '800', fontSize: 14 }}>{s.hifzSetupPromptCta}</Text>
                  <Ionicons name="arrow-forward" size={16} color={t.accent.onPrimary} />
                </View>
              </Card>
            </Pressable>
          ) : todaysGoal ? (
            <Card watermark rounded="xl" style={{ gap: t.spacing(3) }}>
              <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                {s.hifzTodaysGoal}
              </Text>
              <View>
                <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 18 }}>
                  {getSurah(todaysGoal.surah)?.englishName}
                </Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 13, marginTop: 2 }}>
                  {todaysGoal.startAyah === todaysGoal.endAyah
                    ? s.hifzGoalAyahSingle.replace('{ayah}', String(todaysGoal.startAyah))
                    : s.hifzGoalAyahRange.replace('{start}', String(todaysGoal.startAyah)).replace('{end}', String(todaysGoal.endAyah))}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceMuted }}>
                <View style={{
                  height: 6, borderRadius: 3, backgroundColor: t.accent.primary,
                  width: `${Math.min(100, Math.round((todaysGoal.doneToday / (todaysGoal.endAyah - todaysGoal.startAyah + 1)) * 100))}%`,
                }} />
              </View>
              <Button
                label={s.onbContinue}
                onPress={() => router.push(`/hifz/${todaysGoal.surah}?start=${todaysGoal.startAyah}&end=${todaysGoal.endAyah}`)}
                right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />}
              />
            </Card>
          ) : (
            <Card watermark rounded="xl" style={{ alignItems: 'center', gap: t.spacing(2), paddingVertical: t.spacing(5) }}>
              <Ionicons name="trophy-outline" size={32} color={t.colors.brass} />
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
                {s.hifzGoalScopeComplete}
              </Text>
            </Card>
          )}

          {/* Qur'an completion — the "big picture" number, distinct from the
              memorized/due tiles below which are raw counts. */}
          <Card watermark rounded="xl" style={{ gap: t.spacing(3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                {s.hifzQuranCompletion}
              </Text>
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 16 }}>{overall.completionPercent}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceMuted }}>
              <View style={{ height: 6, width: `${Math.min(100, overall.completionPercent)}%`, borderRadius: 3, backgroundColor: t.accent.primary }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                {juzStats.currentJuz != null
                  ? s.hifzCurrentJuz.replace('{juz}', String(juzStats.currentJuz))
                  : s.hifzNoJuzYet}
              </Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                {s.hifzJuzCompleted.replace('{count}', String(juzStats.juzCompleted))}
              </Text>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
            <View style={{ flex: 1 }}>
              <Card watermark style={{ gap: t.spacing(2) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                  <Ionicons name="layers-outline" size={18} color={t.accent.primary} />
                  <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {s.hifzMemorized}
                  </Text>
                </View>
                <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 32 }}>{formatNumber(overall.totalMemorized)}</Text>
              </Card>
            </View>
            <View style={{ flex: 1 }}>
              <Card watermark style={{ gap: t.spacing(2) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                  <Ionicons name="time-outline" size={18} color={t.colors.brass} />
                  <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {s.hifzDueToday}
                  </Text>
                </View>
                <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 32 }}>{formatNumber(overall.dueToday)}</Text>
              </Card>
            </View>
          </View>

          {dueBySurah.size > 0 && (
            <View style={{ gap: t.spacing(2) }}>
              <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
                {s.hifzDueForReview.toUpperCase()}
              </Text>
              <Card rounded="lg" style={{ gap: 0 }}>
                {Array.from(dueBySurah.entries()).map(([surahNumber, count], i, arr) => {
                  const meta = SURAHS.find(x => x.number === surahNumber);
                  if (!meta) return null;
                  return (
                    <Pressable
                      key={surahNumber}
                      onPress={() => router.push(`/hifz/${surahNumber}?mode=due`)}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
                        paddingVertical: t.spacing(3),
                        borderBottomWidth: i < arr.length - 1 ? 0.5 : 0,
                        borderBottomColor: t.colors.hairline,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="refresh-circle-outline" size={22} color={t.accent.primary} />
                      <Text style={{ flex: 1, color: t.colors.text, fontWeight: '700', fontSize: 14 }}>{meta.englishName}</Text>
                      <View style={{ paddingHorizontal: t.spacing(2), paddingVertical: 2, borderRadius: t.radius.pill, backgroundColor: t.accent.primarySoft }}>
                        <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 12 }}>{count}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          )}

          {mostForgotten.length > 0 && (
            <View style={{ gap: t.spacing(2) }}>
              <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
                {s.hifzMostForgotten.toUpperCase()}
              </Text>
              <Card rounded="lg" style={{ gap: 0 }}>
                {mostForgotten.map((item, i) => {
                  const meta = getSurah(item.surah);
                  if (!meta) return null;
                  return (
                    <Pressable
                      key={`${item.surah}:${item.ayah}`}
                      onPress={() => router.push(`/hifz/${item.surah}?start=${item.ayah}&end=${item.ayah}`)}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
                        paddingVertical: t.spacing(3),
                        borderBottomWidth: i < mostForgotten.length - 1 ? 0.5 : 0,
                        borderBottomColor: t.colors.hairline,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="alert-circle-outline" size={22} color={t.colors.danger} />
                      <Text style={{ flex: 1, color: t.colors.text, fontWeight: '700', fontSize: 14 }}>
                        {meta.englishName} · {item.ayah}
                      </Text>
                      <View style={{ paddingHorizontal: t.spacing(2), paddingVertical: 2, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted }}>
                        <Text style={{ color: t.colors.danger, fontWeight: '800', fontSize: 12 }}>
                          {s.hifzForgottenTimes.replace('{count}', String(item.lapses))}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          )}

          {overall.totalMemorized === 0 && (
            <Card rounded="lg" style={{ alignItems: 'center', gap: t.spacing(2), paddingVertical: t.spacing(5) }}>
              <Ionicons name="book-outline" size={32} color={t.colors.textMuted} />
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>
                {s.hifzEmptyTitle}
              </Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: t.spacing(4) }}>
                {s.hifzEmptySubtitle}
              </Text>
            </Card>
          )}

          <View style={{ gap: t.spacing(1) }}>
            <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>
              {s.hifzAllSurahs.toUpperCase()}
            </Text>
            <View>
              {SURAHS.map((surah, i) => (
                <View key={surah.number} style={{ borderBottomWidth: i < SURAHS.length - 1 ? 0.5 : 0, borderBottomColor: t.colors.hairline }}>
                  <SurahProgressRow
                    surahNumber={surah.number}
                    name={surah.englishName}
                    translation={surah.englishTranslation}
                    totalAyahs={surah.numberOfAyahs}
                    onPress={() => router.push(`/hifz/${surah.number}`)}
                  />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
