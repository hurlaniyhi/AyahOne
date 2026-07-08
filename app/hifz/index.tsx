import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { SURAHS } from '@/data/surahs';
import { useHifzDueQueue, useHifzOverallStats, useHifzSurahProgress } from '@/store/selectors';
import { formatNumber } from '@/lib/format';
import { Card } from '@/components/Card';

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
  const dueQueue = useHifzDueQueue();

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
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ gap: t.spacing(4), paddingBottom: t.spacing(8) }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: t.colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 19, paddingHorizontal: t.spacing(3) }}>
            {s.hifzSubtitle}
          </Text>

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
