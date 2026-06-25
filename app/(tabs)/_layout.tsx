import React from 'react';
import { Tabs } from 'expo-router';
import { useStrings } from '@/i18n/strings';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function TabsLayout() {
  const s = useStrings();
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: s.home }} />
      <Tabs.Screen name="reading" options={{ title: s.reading }} />
      <Tabs.Screen name="explore" options={{ title: s.explore }} />
      <Tabs.Screen name="ask" options={{ title: s.ask }} />
      <Tabs.Screen name="settings" options={{ title: s.settings }} />
    </Tabs>
  );
}
