import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { ArabesqueMark } from '@/components/ArabesqueMark';

export default function LeaderboardScreen() {
  const t = useTheme();
  const s = useStrings();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(4), justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 120, height: 120 }}>
          <View style={{ position: 'absolute', opacity: t.mode === 'dark' ? 0.18 : 0.15 }}>
            <ArabesqueMark size={120} color={t.colors.brass} />
          </View>
          <Ionicons name="people-outline" size={36} color={t.accent.primary} />
        </View>
        <Text style={{ color: t.colors.text, fontSize: 24, fontWeight: '800' }}>{s.leaderboard}</Text>
        <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>Coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}
