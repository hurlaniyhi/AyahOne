import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { searchCached, type SearchHit } from '@/data/quranApi';
import { getSurah } from '@/data/surahs';
import { useAppStore } from '@/store/appStore';
import { arabicFontFor } from '@/lib/quranText';

export default function SearchScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const arabicScript = useAppStore(st => st.settings.arabicScript);
  const arabicFamily = arabicFontFor(arabicScript);

  const onChange = (text: string) => {
    setQ(text);
    setHits(text.trim() ? searchCached(text) : []);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
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
              textAlign: 'right', writingDirection: 'rtl',
            }}
          />
        </View>

        {hits.length === 0 ? (
          <Text style={{ color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing(8) }}>
            {q.trim() ? s.noResults : s.searchPlaceholder}
          </Text>
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
                    router.back();
                    setTimeout(() => router.push(`/read/${item.surah}?ayah=${item.ayah}`), 0);
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
                    {item.arabic}
                  </Text>
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
