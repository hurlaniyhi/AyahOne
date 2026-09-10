// TEMPORARY diagnostic overlay for the iOS-standalone-PWA bottom-space bug.
// Shows real measured values (viewport height, safe-area insets, display
// mode) directly on screen so they can be screenshotted from an installed
// PWA — remove this file and its usage in app/_layout.tsx once the bug is
// found and fixed.
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

export function PwaDebugOverlay() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [webInfo, setWebInfo] = useState<Record<string, string | number>>({});

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const read = () => {
      const doc = document.documentElement;
      const bodyRect = document.body.getBoundingClientRect();
      const rootEl = document.getElementById('root');
      const rootRect = rootEl?.getBoundingClientRect();
      const tabBarEl = document.getElementById('pwa-debug-tabbar');
      const tabBarRect = tabBarEl?.getBoundingClientRect();
      const safeAreaEl = document.getElementById('pwa-debug-safearea');
      const safeAreaRect = safeAreaEl?.getBoundingClientRect();
      const scrollEl = document.getElementById('pwa-debug-scrollview');
      const scrollRect = scrollEl?.getBoundingClientRect();
      setWebInfo({
        innerHeight: window.innerHeight,
        bodyTop: Math.round(bodyRect.top),
        bodyBottom: Math.round(bodyRect.bottom),
        rootBottom: rootRect ? Math.round(rootRect.bottom) : -1,
        safeAreaTop: safeAreaRect ? Math.round(safeAreaRect.top) : -1,
        safeAreaBottom: safeAreaRect ? Math.round(safeAreaRect.bottom) : -1,
        scrollViewTop: scrollRect ? Math.round(scrollRect.top) : -1,
        scrollViewBottom: scrollRect ? Math.round(scrollRect.bottom) : -1,
        scrollContentHeight: scrollEl ? scrollEl.scrollHeight : -1,
        tabBarTop: tabBarRect ? Math.round(tabBarRect.top) : -1,
        tabBarBottom: tabBarRect ? Math.round(tabBarRect.bottom) : -1,
        gapAboveTabBar: tabBarRect && scrollRect ? Math.round(tabBarRect.top - scrollRect.bottom) : -1,
        gapBelowTabBar: tabBarRect ? Math.round(window.innerHeight - tabBarRect.bottom) : -1,
        standalone: window.matchMedia('(display-mode: standalone)').matches ? 1 : 0,
        screenHeight: window.screen?.height ?? -1,
      });
    };
    read();
    // This overlay mounts once, immediately, alongside the splash screen —
    // long before the tab bar exists in the DOM. Re-measuring on a fixed
    // delay isn't reliable (splash duration varies with font/store load
    // time), so poll continuously instead: whatever's on screen when this
    // is read/screenshotted is always current, regardless of which screen
    // (splash, onboarding, tab bar) is actually showing at the time.
    const interval = setInterval(read, 500);
    window.addEventListener('resize', read);
    window.addEventListener('pageshow', read);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', read);
      window.removeEventListener('pageshow', read);
    };
  }, []);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 40,
        left: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 8,
        borderRadius: 8,
        zIndex: 9999,
      }}
    >
      <Text style={{ color: '#0f0', fontSize: 10, fontFamily: 'monospace' }}>
        RN insets: t{insets.top} r{insets.right} b{insets.bottom} l{insets.left}{'\n'}
        RN window: {Math.round(width)}x{Math.round(height)}{'\n'}
        {Object.entries(webInfo).map(([k, v]) => `${k}: ${v}`).join('\n')}
      </Text>
    </View>
  );
}
