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
      setWebInfo({
        innerHeight: window.innerHeight,
        bodyTop: Math.round(bodyRect.top),
        bodyBottom: Math.round(bodyRect.bottom),
        bodyHeight: Math.round(bodyRect.height),
        rootTop: rootRect ? Math.round(rootRect.top) : -1,
        rootBottom: rootRect ? Math.round(rootRect.bottom) : -1,
        rootHeight: rootRect ? Math.round(rootRect.height) : -1,
        tabBarTop: tabBarRect ? Math.round(tabBarRect.top) : -1,
        tabBarBottom: tabBarRect ? Math.round(tabBarRect.bottom) : -1,
        tabBarHeight: tabBarRect ? Math.round(tabBarRect.height) : -1,
        gapBelowTabBar: tabBarRect ? Math.round(window.innerHeight - tabBarRect.bottom) : -1,
        standalone: window.matchMedia('(display-mode: standalone)').matches ? 1 : 0,
        devicePixelRatio: window.devicePixelRatio,
        screenHeight: window.screen?.height ?? -1,
      });
    };
    read();
    // Layout can settle a moment after mount (fonts, async content), so
    // re-measure shortly after too, not just on resize/pageshow.
    const t1 = setTimeout(read, 300);
    const t2 = setTimeout(read, 1200);
    window.addEventListener('resize', read);
    window.addEventListener('pageshow', read);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
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
