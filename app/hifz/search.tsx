import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { searchCached, type SearchHit } from '@/data/quranApi';
import { getSurah } from '@/data/surahs';
import { arabicFontFor } from '@/lib/quranText';
import { stripTajweed } from '@/lib/tajweed';
import type { HifzAyahState } from '@/lib/hifz';

type StatusFilter = 'all' | 'mastered' | 'reviewing' | 'learning' | 'none';

// A Hifz-scoped search — separate from the shared app/search.tsx (which
// every reading feature uses) so annotating results with memorization
// status can't regress that general-purpose screen. Reuses the same
// underlying searchCached() index, read-only.
export default function HifzSearchScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const progress = useAppStore(st => st.hifzProgress);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const hits = useMemo(() => (query.trim() ? searchCached(query) : []), [query]);

  const statusFor = (hit: SearchHit): { key: Exclude<StatusFilter, 'all'>; label: string; color: string } => {
    const state: HifzAyahState | undefined = progress[`${hit.surah}:${hit.ayah}`];
    if (!state) return { key: 'none', label: s.hifzStatusNotStarted, color: t.colors.textMuted };
    if (state.strength === 'mastered') return { key: 'mastered', label: s.hifzStatusMemorized, color: t.colors.success };
    if (state.strength === 'reviewing') return { key: 'reviewing', label: s.hifzStatusReviewing, color: t.colors.brass };
    return { key: 'learning', label: s.hifzStatusLearning, color: t.accent.primary };
  };

  const filtered = hits.filter(h => filter === 'all' || statusFor(h).key === filter);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: s.hifzFilterAll },
    { key: 'mastered', label: s.hifzStatusMemorized },
    { key: 'reviewing', label: s.hifzStatusReviewing },
    { key: 'learning', label: s.hifzStatusLearning },
    { key: 'none', label: s.hifzStatusNotStarted },
  ];

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
            <Ionicons name="arrow-back" size={20} color={t.colors.text} />
          </Pressable>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 18 }}>{s.hifzSearchTitle}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
          borderWidth: 0.75, borderColor: t.colors.hairline, backgroundColor: t.colors.surface,
          borderRadius: t.radius.pill, paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(1),
        }}>
          <Ionicons name="search-outline" size={18} color={t.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder={s.searchPlaceholder}
            placeholderTextColor={t.colors.textMuted}
            style={{
              flex: 1, paddingVertical: t.spacing(3), color: t.colors.text,
              fontSize: 18, textAlign: 'right', writingDirection: 'rtl',
            }}
          />
        </View>

        {query.trim().length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing(2) }}>
            {filters.map(f => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={{
                    paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1.5),
                    borderRadius: t.radius.pill,
                    backgroundColor: active ? t.accent.primary : t.colors.surfaceMuted,
                  }}
                >
                  <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700', fontSize: 12 }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <ScrollView contentContainerStyle={{ gap: t.spacing(2), paddingBottom: t.spacing(8) }} showsVerticalScrollIndicator={false}>
          {query.trim().length > 0 && filtered.length === 0 && (
            <Text style={{ color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing(6) }}>
              {s.noResults}
            </Text>
          )}
          {filtered.map(hit => {
            const meta = getSurah(hit.surah);
            const status = statusFor(hit);
            return (
              <Pressable
                key={`${hit.surah}:${hit.ayah}`}
                onPress={() => router.push(`/hifz/${hit.surah}?start=${hit.ayah}&end=${hit.ayah}`)}
                style={({ pressed }) => ({
                  gap: t.spacing(2),
                  padding: t.spacing(4), borderRadius: t.radius.md,
                  backgroundColor: t.colors.surface, borderWidth: 0.75, borderColor: t.colors.hairline,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                    {meta?.number}. {meta?.englishName} · {hit.ayah}
                  </Text>
                  <View style={{ paddingHorizontal: t.spacing(2), paddingVertical: 2, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted }}>
                    <Text style={{ color: status.color, fontWeight: '800', fontSize: 11 }}>{status.label}</Text>
                  </View>
                </View>
                <Text
                  numberOfLines={2}
                  style={{ color: t.colors.text, fontSize: 20, textAlign: 'right', writingDirection: 'rtl', fontFamily: arabicFontFor('uthmani') }}
                >
                  {stripTajweed(hit.arabic)}
                </Text>
                {hit.translation ? (
                  <Text numberOfLines={2} style={{ color: t.colors.textMuted, fontSize: 13 }}>{hit.translation}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
