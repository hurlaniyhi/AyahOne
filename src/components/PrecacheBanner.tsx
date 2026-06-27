import React, { useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { bootstrapQuranCache } from '@/lib/precacheBootstrap';

export function PrecacheBanner() {
  const t = useTheme();
  const precache = useAppStore(s => s.precache);
  const setPrecache = useAppStore(s => s.setPrecache);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (dismissed) return null;
  if (!precache.running && !precache.error) return null;

  const pct = precache.total ? Math.round((precache.loaded / precache.total) * 100) : 0;
  const isError = !!precache.error && !precache.running;

  const onRetry = async () => {
    setRetrying(true);
    try { await bootstrapQuranCache(); } finally { setRetrying(false); }
  };
  const onDismiss = () => {
    setPrecache({ error: null });
    setDismissed(true);
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: t.spacing(3),
      padding: t.spacing(3),
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surface,
      borderWidth: 0.75,
      borderColor: t.colors.hairline,
    }}>
      {isError ? (
        <Ionicons name="cloud-offline-outline" size={20} color={t.colors.textMuted} />
      ) : (
        <ActivityIndicator color={t.accent.primary} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.text, fontWeight: '700' }}>
          {isError ? 'Offline download paused' : 'Downloading the Qur’an for offline use'}
        </Text>
        <Text style={{ color: t.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          {isError
            ? 'Connect to the internet and tap Retry to finish.'
            : `${precache.loaded}/${precache.total} surahs · ${pct}%`}
        </Text>
      </View>
      {isError && (
        <View style={{ flexDirection: 'row', gap: t.spacing(1) }}>
          <Pressable
            onPress={onRetry}
            disabled={retrying}
            hitSlop={8}
            style={({ pressed }) => ({
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1.5),
              borderRadius: t.radius.pill,
              backgroundColor: t.accent.primarySoft,
              opacity: retrying ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            {retrying
              ? <ActivityIndicator size="small" color={t.accent.primary} />
              : <Text style={{ color: t.accent.primary, fontWeight: '700', fontSize: 12 }}>Retry</Text>}
          </Pressable>
          <Pressable onPress={onDismiss} hitSlop={8} style={{ padding: t.spacing(1) }}>
            <Ionicons name="close" size={18} color={t.colors.textMuted} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
