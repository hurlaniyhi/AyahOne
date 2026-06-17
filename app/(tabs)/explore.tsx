import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { Button } from '@/components/Button';
import { ArabesqueMark } from '@/components/ArabesqueMark';

export default function ExploreScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(4), justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 120, height: 120 }}>
          <View style={{ position: 'absolute', opacity: t.mode === 'dark' ? 0.18 : 0.15 }}>
            <ArabesqueMark size={120} color={t.colors.brass} />
          </View>
          <Ionicons name="search" size={36} color={t.accent.primary} />
        </View>
        <Text style={{ color: t.colors.text, fontSize: 24, fontWeight: '800' }}>{s.searchVerse}</Text>
        <Text style={{ color: t.colors.textMuted, textAlign: 'center', maxWidth: 280 }}>{s.searchPlaceholder}</Text>
        <Button label={s.search} onPress={() => router.push('/search')} style={{ paddingHorizontal: 40 }} />
      </View>
    </SafeAreaView>
  );
}
