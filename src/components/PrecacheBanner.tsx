import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';

export function PrecacheBanner() {
  const t = useTheme();
  const precache = useAppStore(s => s.precache);
  if (!precache.running && !precache.error) return null;

  const pct = precache.total ? Math.round((precache.loaded / precache.total) * 100) : 0;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
      padding: t.spacing(3),
      borderRadius: t.radius.md,
      backgroundColor: precache.error ? '#FEF2F2' : t.accent.primarySoft,
    }}>
      {precache.error ? (
        <Ionicons name="cloud-offline" size={20} color={t.colors.danger} />
      ) : (
        <ActivityIndicator color={t.accent.primary} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{
          color: precache.error ? t.colors.danger : t.colors.textInverse,
          fontWeight: '700',
        }}>
          {precache.error ? 'Offline Quran cache failed' : 'Downloading the Qur’an for offline use'}
        </Text>
        {!precache.error && (
          <Text style={{ color: t.colors.textInverse, opacity: 0.85, fontSize: 12 }}>
            {precache.loaded}/{precache.total} surahs · {pct}%
          </Text>
        )}
        {precache.error && (
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {precache.error}
          </Text>
        )}
      </View>
    </View>
  );
}
