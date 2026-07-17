import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { getSurah } from '@/data/surahs';
import { getSurahContent, type Ayah } from '@/data/quranApi';
import { arabicFontFor } from '@/lib/quranText';
import { stripTajweed } from '@/lib/tajweed';

type Tab = 'favorites' | 'bookmarks';

export default function SavedScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const favorites = useAppStore(st => st.favorites);
  const bookmarks = useAppStore(st => st.bookmarks);
  const toggleFavorite = useAppStore(st => st.toggleFavorite);
  const toggleBookmark = useAppStore(st => st.toggleBookmark);
  const translationId = useAppStore(st => st.settings.translationId);
  const arabicScript = useAppStore(st => st.settings.arabicScript);
  const arabicFamily = arabicFontFor(arabicScript);

  const [tab, setTab] = useState<Tab>(params.tab === 'bookmarks' ? 'bookmarks' : 'favorites');
  const [contents, setContents] = useState<Record<number, Ayah[]>>({});

  // Load ayah text for every surah referenced by either list. The default
  // combo is bundled offline, so this resolves instantly for most users.
  useEffect(() => {
    let alive = true;
    const surahs = Array.from(new Set([...favorites, ...bookmarks].map(k => Number(k.split(':')[0]))));
    Promise.all(surahs.map(async n => [n, (await getSurahContent(n, translationId, arabicScript)).ayahs] as const))
      .then(entries => { if (alive) setContents(Object.fromEntries(entries)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [favorites, bookmarks, translationId, arabicScript]);

  const keys = tab === 'favorites' ? favorites : bookmarks;
  const items = useMemo(() => keys.map(k => {
    const [surah, ayah] = k.split(':').map(Number);
    const found = contents[surah]?.find(a => a.numberInSurah === ayah);
    return {
      k, surah, ayah,
      meta: getSurah(surah),
      arabic: found?.arabic ?? '',
      translation: found?.translation ?? '',
    };
  }), [keys, contents]);

  // Toggling the active list's action removes the key (it is currently present),
  // so the row falls out of the list on the next render.
  const remove = (surah: number, ayah: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (tab === 'favorites' ? toggleFavorite : toggleBookmark)(surah, ayah);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <Stack.Screen options={{ title: s.savedTitle }} />
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(3) }}>
        {/* Segmented control — same pill treatment as the picker sheets. */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing(2) }}>
          {(['favorites', 'bookmarks'] as const).map(k => {
            const active = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
                  paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(2),
                  borderRadius: t.radius.pill,
                  backgroundColor: active ? t.accent.primary : 'transparent',
                  borderWidth: 1, borderColor: active ? t.accent.primary : t.colors.border,
                }}
              >
                <Ionicons
                  name={k === 'favorites' ? 'heart' : 'bookmark'}
                  size={16}
                  color={active ? t.accent.onPrimary : t.colors.textMuted}
                />
                <Text style={{ color: active ? t.accent.onPrimary : t.colors.textMuted, fontWeight: '700' }}>
                  {k === 'favorites' ? s.favorites : s.bookmarks}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: t.spacing(8), gap: t.spacing(3) }}>
            <Ionicons
              name={tab === 'favorites' ? 'heart-outline' : 'bookmark-outline'}
              size={40}
              color={t.colors.textMuted}
            />
            <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>
              {tab === 'favorites' ? s.savedEmptyFavorites : s.savedEmptyBookmarks}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => i.k}
            ItemSeparatorComponent={() => <View style={{ height: t.spacing(2) }} />}
            renderItem={({ item }) => (
              <Swipeable
                friction={2}
                rightThreshold={40}
                renderRightActions={() => (
                  <Pressable
                    onPress={() => remove(item.surah, item.ayah)}
                    style={{
                      justifyContent: 'center', alignItems: 'center',
                      width: 84, marginLeft: t.spacing(2),
                      backgroundColor: t.colors.danger, borderRadius: t.radius.md,
                    }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12, marginTop: 4 }}>
                      {s.remove}
                    </Text>
                  </Pressable>
                )}
              >
                <Pressable
                  onPress={() => router.push(`/read/${item.surah}?ayah=${item.ayah}&nosave=1`)}
                  style={({ pressed }) => ({
                    padding: t.spacing(4),
                    backgroundColor: t.colors.surface,
                    borderRadius: t.radius.md, gap: t.spacing(1),
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: t.colors.textMuted }}>
                    {item.meta?.number}. {item.meta?.englishName} • {item.ayah}
                  </Text>
                  {item.arabic ? (
                    <Text
                      style={{
                        color: t.colors.text, fontSize: 22, textAlign: 'right',
                        writingDirection: 'rtl', fontFamily: arabicFamily,
                      }}
                      numberOfLines={2}
                    >
                      {stripTajweed(item.arabic)}
                    </Text>
                  ) : null}
                  {item.translation ? (
                    <Text style={{ color: t.colors.textMuted }} numberOfLines={2}>{item.translation}</Text>
                  ) : null}
                </Pressable>
              </Swipeable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
