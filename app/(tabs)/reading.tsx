import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
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

  const [surahNumber, setSurahNumber] = useState<number>(18);
  const [verse, setVerse] = useState<number>(1);
  const [showSurah, setShowSurah] = useState(false);
  const [showVerse, setShowVerse] = useState(false);

  const surah = getSurah(surahNumber)!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(4) }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#7DD3C0' }} />
          <Text style={{
            position: 'absolute', left: 0, right: 0, textAlign: 'center',
            color: t.colors.text, fontWeight: '700', fontSize: 20,
          }}>{s.reading}</Text>
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

        {/* Favourites + Bookmarks */}
        <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
          <View style={{ flex: 1 }}>
            <Card borderColor="#FB7185" style={{ alignItems: 'center', gap: t.spacing(2) }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#F43F5E', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="heart" size={32} color="#FFFFFF" />
              </View>
              <Text style={{ color: t.colors.text, fontWeight: '600' }}>{s.favorites}</Text>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 22 }}>{favorites.length}</Text>
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card borderColor={t.accent.primary} style={{ alignItems: 'center', gap: t.spacing(2) }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: t.accent.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="bookmark" size={32} color="#FFFFFF" />
              </View>
              <Text style={{ color: t.colors.text, fontWeight: '600' }}>{s.bookmarks}</Text>
              <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 22 }}>{bookmarks.length}</Text>
            </Card>
          </View>
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
