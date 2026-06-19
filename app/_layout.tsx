import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { ScheherazadeNew_400Regular, ScheherazadeNew_700Bold } from '@expo-google-fonts/scheherazade-new';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { hydrateAppStore, useAppStore } from '@/store/appStore';
import { isPrecached, precacheAllSurahs, warmMemoryCache } from '@/data/quranApi';

function RootStack() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.colors.background },
          headerTitleStyle: { color: t.colors.text },
          headerTintColor: t.colors.text,
          contentStyle: { backgroundColor: t.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="read/[surah]" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="search" options={{ presentation: 'modal', title: 'Search' }} />
        <Stack.Screen name="settings/account" options={{ title: 'Account' }} />
        <Stack.Screen name="settings/quran-display" options={{ title: 'Quran Display' }} />
        <Stack.Screen name="settings/themes" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

async function bootstrapQuranCache() {
  const { translationId: translation, arabicScript: script } = useAppStore.getState().settings;
  const setPrecache = useAppStore.getState().setPrecache;
  await warmMemoryCache(translation, script);
  if (await isPrecached(translation, script)) return;
  setPrecache({ running: true, loaded: 0, total: 114, error: null });
  try {
    await precacheAllSurahs(translation, (p) => {
      setPrecache({ loaded: p.loaded, total: p.total, running: !p.done, error: p.error ?? null });
    }, script);
  } catch (e) {
    setPrecache({ running: false, error: String((e as Error)?.message ?? e) });
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    AmiriQuran_400Regular,
    ScheherazadeNew_400Regular,
    ScheherazadeNew_700Bold,
  });
  useEffect(() => {
    hydrateAppStore().then(() => {
      setReady(true);
      void bootstrapQuranCache();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {ready && fontsLoaded ? <RootStack /> : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
            </View>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
