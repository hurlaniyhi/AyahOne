import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useTodayStats, useWeekStats, useTotalStats, useDailySeries, useWeekdaySeries } from '@/store/selectors';
import { useStrings } from '@/i18n/strings';
import { getSurah } from '@/data/surahs';
import { Button } from '@/components/Button';
import { StatRow } from '@/components/StatRow';
import { StreakBars } from '@/components/StreakBars';
import { ArabesqueMark } from '@/components/ArabesqueMark';
import { GoalEditSheet } from '@/components/GoalEditSheet';
import { formatDuration, formatNumber, todayKey } from '@/lib/format';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HomeScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const profile = useAppStore(st => st.profile);
  const lastRead = useAppStore(st => st.lastRead);
  // Friday-scoped Al-Kahf progress (resets every Friday). The Friday banner
  // reads from this rather than lifetime surahProgress[18] so old reads from
  // previous weeks don't pre-fill today's progress bar.
  const kahfFriday = useAppStore(st => st.kahfFriday);
  const dailyGoal = useAppStore(st => st.dailyGoalVerses);
  const hideHasanat = useAppStore(st => st.settings.hideHasanat);
  const today = useTodayStats();
  const week = useWeekStats();
  const total = useTotalStats();
  // Calendar-week aligned (Mon→Sun) so the labelled M T W T F S S strip on the
  // StreakBars card lines up with the values it describes.
  const weekdayVerses = useWeekdaySeries('verses');
  // Chronological last-7-days series — only used for the unlabelled sparklines
  // on the StatRow cards, where Monday-alignment is not meaningful.
  const versesSeries = useDailySeries('verses', 7);
  const hasanatSeries = useDailySeries('hasanat', 7);
  const timeSeries = useDailySeries('timeSec', 7);
  const pagesSeries = useDailySeries('pages', 7);
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today');
  const [goalEditOpen, setGoalEditOpen] = useState(false);

  const bucket = range === 'today' ? today : range === 'week' ? week : total;
  const goalSurah = getSurah(lastRead?.surah ?? 24);
  const goalAyah = lastRead?.ayah ?? 1;
  const progress = Math.min(1, today.verses / Math.max(1, dailyGoal));
  const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), paddingBottom: t.spacing(8), gap: t.spacing(4) }}>
        {/* Header — compact identity row, no gauge on the right */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
            <Pressable
              onPress={() => router.push('/settings/account')}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
                backgroundColor: profile.photoUri ? 'transparent' : t.accent.primarySoft,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: t.accent.primary,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={{ width: 44, height: 44 }} />
              ) : (
                <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 16 }}>
                  {(profile.name || 'F').trim().charAt(0).toUpperCase()}
                </Text>
              )}
            </Pressable>
            <View>
              <Text style={{ color: t.colors.textMuted, fontSize: 13, letterSpacing: 0.3 }}>{s.greeting}</Text>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20, marginTop: 1 }}>
                {profile.name || 'Friend'}
              </Text>
            </View>
          </View>
          {!hideHasanat && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
              borderWidth: 0.75, borderColor: t.colors.hairline,
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
              borderRadius: t.radius.pill,
              backgroundColor: t.colors.surface,
            }}>
              <Ionicons name="sparkles" size={14} color={t.colors.brass} />
              <Text style={{ color: t.colors.text, fontWeight: '700' }}>{formatNumber(today.hasanat)}</Text>
            </View>
          )}
        </View>

        {/* Streak — replaces Quranly's pill weekday row */}
        <StreakBars values={weekdayVerses} labels={WEEKDAYS} todayIndex={todayDow} goal={dailyGoal} />

        {new Date().getDay() === 5 && (() => {
          const KAHF_TOTAL = 110;
          // Only count progress if the stored entry actually belongs to TODAY.
          // A `kahfFriday` from a previous Friday must read as zero this week.
          const todaysAyah = kahfFriday && kahfFriday.date === todayKey() ? kahfFriday.ayah : 0;
          const kahfRead = Math.min(KAHF_TOTAL, todaysAyah);
          const kahfPct = kahfRead / KAHF_TOTAL;
          const kahfResume = Math.min(KAHF_TOTAL, Math.max(1, todaysAyah || 1));
          return (
            <Pressable
              // `nosave=1` keeps the Reading menu's "Start Reading Quran" pointer
              // on the user's last menu-driven session; the banner still grows
              // surahProgress[18] so this card reflects real progress.
              onPress={() => router.push(`/read/18?ayah=${kahfResume}&nosave=1`)}
              style={{
                padding: t.spacing(4), borderRadius: t.radius.lg, gap: t.spacing(3),
                backgroundColor: t.colors.surface,
                borderWidth: 0.75, borderColor: t.colors.brass,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: t.accent.primarySoft,
                }}>
                  <Ionicons name="sunny" size={20} color={t.colors.brass} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{s.fridayKahfTitle}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                    {s.fridayKahfSubtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
              </View>
              <View>
                <View style={{ height: 6, backgroundColor: t.colors.surfaceMuted, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${kahfPct * 100}%`, backgroundColor: t.colors.brass, borderRadius: 3 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing(1) }}>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{kahfRead}/{KAHF_TOTAL} verses</Text>
                  <Text style={{ color: t.colors.brass, fontSize: 12, fontWeight: '700' }}>{Math.round(kahfPct * 100)}%</Text>
                </View>
              </View>
            </Pressable>
          );
        })()}

        {/* Ribbon hero — parchment card with vertical accent ribbon and arabesque watermark */}
        <View style={{
          borderRadius: t.radius.xl,
          backgroundColor: t.colors.surface,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: t.mode === 'dark' ? 0.35 : 0.08,
          shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
          elevation: 4,
        }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: t.accent.primary }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: -32, bottom: -32, opacity: t.mode === 'dark' ? 0.10 : 0.07 }}>
            <ArabesqueMark size={180} color={t.colors.brass} />
          </View>
          <View style={{ padding: t.spacing(5), paddingLeft: t.spacing(6), gap: t.spacing(3) }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>
                  {s.goal}
                </Text>
                <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 30, marginTop: 2 }}>
                  {today.verses}<Text style={{ color: t.colors.textMuted, fontSize: 18, fontWeight: '600' }}> / {dailyGoal} {s.versesPerDay}</Text>
                </Text>
                <Pressable
                  onPress={() => setGoalEditOpen(true)}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), marginTop: 4 }}
                >
                  <Text style={{ color: t.colors.textMuted, fontWeight: '600' }}>
                    {goalSurah?.number}. {goalSurah?.englishName} · {goalAyah}/{goalSurah?.numberOfAyahs}
                  </Text>
                  <Ionicons name="pencil" size={13} color={t.colors.textMuted} />
                </Pressable>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 28 }}>{Math.round(progress * 100)}%</Text>
              </View>
            </View>
            <View style={{ height: 6, backgroundColor: t.colors.surfaceMuted, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${progress * 100}%`, backgroundColor: t.accent.primary, borderRadius: 3 }} />
            </View>
            <Button
              label={s.readQuran}
              onPress={() => router.push(`/read/${goalSurah?.number ?? 1}?ayah=${goalAyah}`)}
              style={{ alignSelf: 'stretch', marginTop: t.spacing(1) }}
            />
          </View>
        </View>

        {/* Range tabs — segmented control on a parchment track */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: t.colors.surfaceMuted,
          padding: t.spacing(1),
          borderRadius: t.radius.pill,
        }}>
          {(['today', 'week', 'all'] as const).map(k => {
            const active = range === k;
            return (
              <Pressable key={k} onPress={() => setRange(k)} style={{
                flex: 1,
                paddingVertical: t.spacing(2),
                borderRadius: t.radius.pill,
                backgroundColor: active ? t.colors.surfaceElevated : 'transparent',
                alignItems: 'center',
                ...(active ? {
                  shadowColor: '#000',
                  shadowOpacity: t.mode === 'dark' ? 0.30 : 0.06,
                  shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                } : null),
              }}>
                <Text style={{ color: active ? t.colors.text : t.colors.textMuted, fontWeight: '700', fontSize: 13 }}>
                  {k === 'today' ? s.today : k === 'week' ? s.week : s.all}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Stat shelves — monochrome rows with sparklines */}
        {!hideHasanat && (
          <StatRow label={s.hasanat} value={formatNumber(bucket.hasanat)} icon="sparkles" tint={t.colors.brass} series={hasanatSeries} />
        )}
        <StatRow label={s.verses} value={formatNumber(bucket.verses)} icon="book-outline" tint={t.accent.primary} series={versesSeries} />
        <StatRow label={s.time} value={formatDuration(bucket.timeSec)} icon="time-outline" tint={t.colors.tileBlue} series={timeSeries} />
        <StatRow label={s.pages} value={formatNumber(bucket.pages)} icon="documents-outline" tint={t.colors.tileEmerald} series={pagesSeries} />
      </ScrollView>
      <GoalEditSheet visible={goalEditOpen} onClose={() => setGoalEditOpen(false)} />
    </SafeAreaView>
  );
}
