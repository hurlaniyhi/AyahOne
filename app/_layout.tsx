import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { ScheherazadeNew_400Regular, ScheherazadeNew_700Bold } from '@expo-google-fonts/scheherazade-new';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { hydrateAppStore, useAppStore } from '@/store/appStore';
import { clearPrecacheFlag, isPrecached, precacheAllSurahs, warmMemoryCache } from '@/data/quranApi';
import { AnimatedSplash } from '@/components/AnimatedSplash';

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

// Treat a flagged-but-undersized cache as stale and trigger a re-download.
// Anything under this threshold means an earlier precache crashed mid-write
// (or AsyncStorage was partially cleared) and search would silently miss
// most surahs without ever recovering.
const PRECACHE_MIN_OK = 110;

async function bootstrapQuranCache() {
  const { translationId: translation, arabicScript: script } = useAppStore.getState().settings;
  const setPrecache = useAppStore.getState().setPrecache;
  const warmed = await warmMemoryCache(translation, script);
  const flagged = await isPrecached(translation, script);
  // Healthy cache: flag set AND payload count looks complete. Sync the
  // Settings card to reality (post-restart precache state is zeroed by default).
  if (flagged && warmed >= PRECACHE_MIN_OK) {
    setPrecache({ loaded: warmed, total: 114, running: false, error: null });
    return;
  }
  // Flag claims "cached" but the underlying data is gone/short — purge the
  // flag so the bulk download below isn't short-circuited again next time.
  if (flagged) await clearPrecacheFlag(translation, script);
  setPrecache({ running: true, loaded: warmed, total: 114, error: null });
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
  // Splash stays on screen until BOTH the entrance animation has finished
  // AND the async boot work has settled. If fonts/store land first the
  // splash holds at its end-frame; if the animation lands first we wait
  // here until ready === true, then transition to the app.
  const [splashDone, setSplashDone] = useState(false);
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

  const bootReady = ready && fontsLoaded;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {bootReady && splashDone ? (
            <RootStack />
          ) : (
            <AnimatedSplash onAnimationDone={() => setSplashDone(true)} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
