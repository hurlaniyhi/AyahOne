import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { useHifzOverallStats } from '@/store/selectors';
import { getSurah } from '@/data/surahs';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SurahPickerSheet } from '@/components/SurahPickerSheet';
import { VersePickerSheet } from '@/components/VersePickerSheet';

export default function ReadingScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const favorites = useAppStore(st => st.favorites);
  const bookmarks = useAppStore(st => st.bookmarks);
  const lastRead = useAppStore(st => st.lastRead);
  const profile = useAppStore(st => st.profile);
  const hifzStats = useHifzOverallStats();

  const [surahNumber, setSurahNumber] = useState<number>(lastRead?.surah ?? 18);
  const [verse, setVerse] = useState<number>(lastRead?.ayah ?? 1);
  const [showSurah, setShowSurah] = useState(false);
  const [showVerse, setShowVerse] = useState(false);

  // Re-sync from lastRead whenever the tab regains focus so the
  // "Start from verse" reflects where the user actually stopped.
  useFocusEffect(useCallback(() => {
    if (lastRead) {
      setSurahNumber(lastRead.surah);
      setVerse(lastRead.ayah);
    }
  }, [lastRead]));

  const surah = getSurah(surahNumber)!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(4) }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}
          >
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20 }}>
              {s.reading}
            </Text>
          </View>
        </View>

        <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>
          {s.separateQuranNote}
        </Text>

        {/* Surah selector */}
        <Pressable onPress={() => setShowSurah(true)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20 }}>{surah.englishName}</Text>
              <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>
                {surah.englishTranslation} | {surah.numberOfAyahs} Verses
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={t.colors.textMuted} />
          </Card>
        </Pressable>

        {/* Verse selector */}
        <Pressable onPress={() => setShowVerse(true)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20 }}>{s.startFromVerse}</Text>
              <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>{verse} Verse</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={t.colors.textMuted} />
          </Card>
        </Pressable>

        <Button
          variant="outline"
          label={s.startReadingQuran}
          onPress={() => router.push(`/read/${surahNumber}?ayah=${verse}`)}
        />

        {/* Hifz entry — full-width tile so memorization reads as a distinct
            mode from casual reading, not just another stat. */}
        <Pressable onPress={() => router.push('/hifz')}>
          <Card watermark style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: t.accent.primarySoft,
            }}>
              <Ionicons name="layers-outline" size={22} color={t.accent.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>{s.hifzTitle}</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {hifzStats.totalMemorized > 0
                  ? s.hifzTileSummary
                      .replace('{count}', String(hifzStats.totalMemorized))
                      .replace('{due}', String(hifzStats.dueToday))
                  : s.hifzTileEmpty}
              </Text>
            </View>
            {hifzStats.dueToday > 0 && (
              <View style={{ paddingHorizontal: t.spacing(2), paddingVertical: 3, borderRadius: t.radius.pill, backgroundColor: t.accent.primary }}>
                <Text style={{ color: t.accent.onPrimary, fontWeight: '800', fontSize: 11 }}>{hifzStats.dueToday}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
          </Card>
        </Pressable>

        {/* Favourites + Bookmarks — restful editorial tiles. Tapping opens the
            Saved list scoped to the matching tab. */}
        <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/saved?tab=favorites')}>
            <Card watermark style={{ gap: t.spacing(2) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                <Ionicons name="heart-outline" size={18} color={t.colors.danger} />
                <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {s.favorites}
                </Text>
              </View>
              <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 32 }}>{favorites.length}</Text>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/saved?tab=bookmarks')}>
            <Card watermark style={{ gap: t.spacing(2) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                <Ionicons name="bookmark-outline" size={18} color={t.accent.primary} />
                <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {s.bookmarks}
                </Text>
              </View>
              <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 32 }}>{bookmarks.length}</Text>
            </Card>
          </Pressable>
        </View>
      </View>

      <SurahPickerSheet
        visible={showSurah}
        selectedSurah={surahNumber}
        onClose={() => setShowSurah(false)}
        onSelect={n => { setSurahNumber(n); setVerse(1); }}
      />
      <VersePickerSheet
        visible={showVerse}
        totalVerses={surah.numberOfAyahs}
        selectedVerse={verse}
        onClose={() => setShowVerse(false)}
        onSelect={setVerse}
      />
    </SafeAreaView>
  );
}
