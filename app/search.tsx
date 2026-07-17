import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { searchCached, type SearchHit } from '@/data/quranApi';
import { getSurah } from '@/data/surahs';
import { useAppStore } from '@/store/appStore';
import { arabicFontFor } from '@/lib/quranText';
import { stripTajweed } from '@/lib/tajweed';

export default function SearchScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const arabicScript = useAppStore(st => st.settings.arabicScript);
  const arabicFamily = arabicFontFor(arabicScript);
  // Restore the last query so that returning from the reader (via
  // router.replace('/search')) re-opens this modal with the same results
  // the user had before tapping a hit.
  const lastQuery = useAppStore.getState().lastSearchQuery;
  const setLastSearchQuery = useAppStore(st => st.setLastSearchQuery);
  const [q, setQ] = useState(lastQuery);
  const [hits, setHits] = useState<SearchHit[]>(() => lastQuery.trim() ? searchCached(lastQuery) : []);

  const onChange = (text: string) => {
    setQ(text);
    setLastSearchQuery(text);
    setHits(text.trim() ? searchCached(text) : []);
  };

  // Arabic is the default; the input flips to LTR only once the user starts
  // typing Latin characters (transliteration search).
  const isLatinQuery = q.trim().length > 0 && !/[\u0600-\u06FF]/.test(q);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingHorizontal: t.spacing(1) }}>
              <Ionicons name="close" size={26} color={t.colors.text} />
            </Pressable>
          ),
        }}
      />
      <View style={{ padding: t.spacing(4), gap: t.spacing(3), flex: 1 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
          borderWidth: 1, borderColor: t.colors.border,
          borderRadius: t.radius.pill,
          paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
        }}>
          <Ionicons name="search-outline" size={18} color={t.colors.textMuted} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={onChange}
            placeholder={s.searchPlaceholder}
            placeholderTextColor={t.colors.textMuted}
            style={{
              flex: 1, color: t.colors.text, fontSize: 16,
              textAlign: isLatinQuery ? 'left' : 'right',
              writingDirection: isLatinQuery ? 'ltr' : 'rtl',
            }}
          />
        </View>

        {hits.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: t.spacing(8) }}>
            <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>
              {q.trim() ? s.noResults : s.searchPlaceholder}
            </Text>
          </View>
        ) : (
          <FlatList
            data={hits}
            keyExtractor={h => `${h.surah}:${h.ayah}`}
            ItemSeparatorComponent={() => <View style={{ height: t.spacing(2) }} />}
            renderItem={({ item }) => {
              const meta = getSurah(item.surah);
              return (
                <Pressable
                  onPress={() => {
                    // Replace this modal with the reader so it visually
                    // closes. `fromSearch=1` tells the reader to re-open the
                    // Search modal (which restores the saved query + hits
                    // from the store) when the user presses Back. `nosave=1`
                    // keeps this an ephemeral session: the reader will not
                    // move the resume pointer used by the Reading menu's
                    // "Start Reading Quran" card.
                    router.replace(`/read/${item.surah}?ayah=${item.ayah}&nosave=1&fromSearch=1`);
                  }}
                  style={({ pressed }) => ({
                    padding: t.spacing(4),
                    backgroundColor: t.colors.surface,
                    borderRadius: t.radius.md, gap: t.spacing(1),
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: t.colors.textMuted }}>
                    {meta?.number}. {meta?.englishName} • {item.ayah}
                  </Text>
                  <Text
                    style={{
                      color: t.colors.text, fontSize: 22, textAlign: 'right',
                      writingDirection: 'rtl', fontFamily: arabicFamily,
                    }}
                    numberOfLines={2}
                  >
                    {stripTajweed(item.arabic)}
                  </Text>
                  {isLatinQuery && item.transliteration ? (
                    <Text style={{ color: t.colors.textMuted, fontStyle: 'italic' }} numberOfLines={2}>
                      {item.transliteration}
                    </Text>
                  ) : null}
                  {item.translation ? (
                    <Text style={{ color: t.colors.textMuted }} numberOfLines={2}>{item.translation}</Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
