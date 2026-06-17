import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';

export default function LeaderboardScreen() {
  const t = useTheme();
  const s = useStrings();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <View style={{ flex: 1, padding: t.spacing(4), gap: t.spacing(4), justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="people" size={64} color={t.accent.primary} />
        <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '700' }}>{s.leaderboard}</Text>
        <Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>Coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}
