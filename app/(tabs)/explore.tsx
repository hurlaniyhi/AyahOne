import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { Button } from '@/components/Button';

export default function ExploreScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(4), justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="search" size={64} color={t.accent.primary} />
        <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700' }}>{s.searchVerse}</Text>
        <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>{s.searchPlaceholder}</Text>
        <Button label={s.search} onPress={() => router.push('/search')} style={{ paddingHorizontal: 40 }} />
      </View>
    </SafeAreaView>
  );
}
