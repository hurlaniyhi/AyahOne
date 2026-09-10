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
      setWebInfo({
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        vvHeight: window.visualViewport?.height ?? -1,
        clientHeight: doc.clientHeight,
        scrollHeight: doc.scrollHeight,
        bodyOffsetHeight: document.body.offsetHeight,
        standalone: window.matchMedia('(display-mode: standalone)').matches ? 1 : 0,
        navStandalone: (window.navigator as any).standalone ? 1 : 0,
        appHeightVar: getComputedStyle(doc).getPropertyValue('--app-height') || 'unset',
        devicePixelRatio: window.devicePixelRatio,
        screenHeight: window.screen?.height ?? -1,
      });
    };
    read();
    window.addEventListener('resize', read);
    window.addEventListener('pageshow', read);
    return () => {
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
