import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { ScheherazadeNew_400Regular, ScheherazadeNew_700Bold } from '@expo-google-fonts/scheherazade-new';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { hydrateAppStore, useAppStore } from '@/store/appStore';
import { bootstrapQuranCache } from '@/lib/precacheBootstrap';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { GoalCelebrationModal } from '@/components/GoalCelebrationModal';
import { KahfCelebrationModal } from '@/components/KahfCelebrationModal';
import { attachReminderTriggers, ensureBootPermission, initNotifications, syncReminders } from '@/lib/notifications';

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
      <GoalCelebrationModal />
      <KahfCelebrationModal />
    </>
  );
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
      // Install the notification handler, prompt for OS permission on first
      // launch (since notificationsEnabled defaults to true), then schedule
      // the reminders. ensureBootPermission is a no-op on subsequent launches.
      void initNotifications()
        .then(() => ensureBootPermission())
        .then(() => syncReminders());
    });
    // Re-sync on every foreground: if the user crossed midnight or completed
    // their goal in another session, the scheduled bodies should be refreshed.
    // Also re-attempt the offline Quran cache when it's currently in an error
    // state — the user may have come back with working network.
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void syncReminders();
      if (useAppStore.getState().precache.error) void bootstrapQuranCache();
    });
    // Resync whenever the store slices that influence reminder copy change
    // (verses read today, daily goal, Kahf progress, language, toggle).
    const unsubStore = attachReminderTriggers();
    return () => { sub.remove(); unsubStore(); };
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
