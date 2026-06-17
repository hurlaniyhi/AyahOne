import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useTodayStats, useWeekStats, useTotalStats } from '@/store/selectors';
import { useStrings } from '@/i18n/strings';
import { getSurah } from '@/data/surahs';
import { Button } from '@/components/Button';
import { StatTile } from '@/components/StatTile';
import { PrecacheBanner } from '@/components/PrecacheBanner';
import { GoalEditSheet } from '@/components/GoalEditSheet';
import { formatDuration, formatNumber } from '@/lib/format';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HomeScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const profile = useAppStore(st => st.profile);
  const lastRead = useAppStore(st => st.lastRead);
  const dailyGoal = useAppStore(st => st.dailyGoalVerses);
  const hideHasanat = useAppStore(st => st.settings.hideHasanat);
  const today = useTodayStats();
  const week = useWeekStats();
  const total = useTotalStats();
  const [range, setRange] = useState<'today' | 'week' | 'all'>('today');
  const [goalEditOpen, setGoalEditOpen] = useState(false);

  const bucket = range === 'today' ? today : range === 'week' ? week : total;
  const goalSurah = getSurah(lastRead?.surah ?? 24);
  const goalAyah = lastRead?.ayah ?? 1;
  const progress = Math.min(1, today.verses / Math.max(1, dailyGoal));
  const todayDow = (new Date().getDay() + 6) % 7; // 0=Mon

  const weekdayStrip = useMemo(() => WEEKDAYS.map((w, i) => {
    const active = i === todayDow;
    return (
      <View key={i} style={{
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: active ? t.accent.primary : t.colors.border,
        backgroundColor: active ? t.accent.primary : 'transparent',
      }}>
        <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '600' }}>{w}</Text>
      </View>
    );
  }), [todayDow, t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(4) }}>
        {/* Header */}
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
              <Text style={{ color: t.colors.textMuted, fontSize: 14 }}>{s.greeting}</Text>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 18 }}>
                {profile.name || 'Friend'}
              </Text>
            </View>
          </View>
          {!hideHasanat && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
              borderWidth: 1, borderColor: t.colors.border,
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
              borderRadius: 16,
            }}>
              <Ionicons name="stats-chart-outline" size={18} color={t.colors.text} />
              <View style={{ width: 1, height: 16, backgroundColor: t.colors.border }} />
              <Ionicons name="book" size={16} color={t.accent.primary} />
              <Text style={{ color: t.colors.text, fontWeight: '700' }}>{formatNumber(today.hasanat)}</Text>
            </View>
          )}
        </View>

        {/* Weekday strip */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          borderWidth: 1, borderColor: t.colors.border,
          borderRadius: t.radius.pill, paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
        }}>
          {weekdayStrip}
        </View>

        <PrecacheBanner />

        {new Date().getDay() === 5 && (
          <Pressable
            onPress={() => router.push('/read/18?ayah=1')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
              padding: t.spacing(4), borderRadius: t.radius.lg,
              backgroundColor: t.colors.surface,
              borderWidth: 1, borderColor: t.accent.primary,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.accent.primarySoft,
            }}>
              <Ionicons name="sunny" size={20} color={t.accent.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.colors.text, fontWeight: '700' }}>{s.fridayKahfTitle}</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                {s.fridayKahfSubtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
          </Pressable>
        )}

        {/* Goal card */}
        <LinearGradient
          colors={t.accent.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: t.radius.lg,
            padding: t.spacing(5),
            gap: t.spacing(3),
            shadowColor: t.accent.primary,
            shadowOpacity: t.mode === 'dark' ? 0.45 : 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: t.accent.onPrimary, fontWeight: '800', fontSize: 28 }}>{s.goal}</Text>
              <Pressable
                onPress={() => setGoalEditOpen(true)}
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2), marginTop: 4 }}
              >
                <Text style={{ color: t.accent.onPrimary, fontWeight: '600' }}>
                  {goalSurah?.number}. {goalSurah?.englishName} | {goalAyah}/{goalSurah?.numberOfAyahs}
                </Text>
                <Ionicons name="pencil" size={14} color={t.accent.onPrimary} />
              </Pressable>
            </View>
            <Text style={{ color: t.accent.onPrimary, fontWeight: '700', fontSize: 18 }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: '#FFFFFF66', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${progress * 100}%`, backgroundColor: '#FFFFFF' }} />
          </View>
          <Text style={{ color: t.accent.onPrimary, fontWeight: '600' }}>
            {today.verses}/{dailyGoal} {s.versesPerDay}
          </Text>
          <Button
            label={s.readQuran}
            variant="secondary"
            style={{ backgroundColor: '#000', alignSelf: 'stretch' }}
            textStyle={{ color: '#FFF' }}
            onPress={() => router.push(`/read/${goalSurah?.number ?? 1}?ayah=${goalAyah}`)}
          />
        </LinearGradient>

        {/* Range tabs */}
        <View style={{ flexDirection: 'row', gap: t.spacing(2) }}>
          {(['today', 'week', 'all'] as const).map(k => {
            const active = range === k;
            return (
              <Pressable key={k} onPress={() => setRange(k)} style={{
                paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(2),
                borderRadius: t.radius.pill,
                backgroundColor: active ? t.accent.primary : 'transparent',
              }}>
                <Text style={{ color: active ? t.accent.onPrimary : t.colors.textMuted, fontWeight: '700' }}>
                  {k === 'today' ? s.today : k === 'week' ? s.week : s.all}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
          {!hideHasanat && (
            <View style={{ flex: 1 }}>
              <StatTile label={s.hasanat} value={formatNumber(bucket.hasanat)} icon="heart" accent={t.colors.tileRose} iconBg="#F472B6" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <StatTile label={s.verses} value={formatNumber(bucket.verses)} icon="document-text" accent={t.colors.tileBlue} iconBg="#60A5FA" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
          <View style={{ flex: 1 }}>
            <StatTile label={s.time} value={formatDuration(bucket.timeSec)} icon="time" accent={t.colors.tileAmber} iconBg="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <StatTile label={s.pages} value={formatNumber(bucket.pages)} icon="documents" accent={t.colors.tileEmerald} iconBg="#34D399" />
          </View>
        </View>
      </ScrollView>
      <GoalEditSheet visible={goalEditOpen} onClose={() => setGoalEditOpen(false)} />
    </SafeAreaView>
  );
}
