import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';

export default function TabsLayout() {
  const t = useTheme();
  const s = useStrings();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.colors.background,
          borderTopColor: t.colors.border,
        },
        tabBarActiveTintColor: t.accent.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: s.home,
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reading"
        options={{
          title: s.reading,
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: s.explore,
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: s.leaderboard,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: s.settings,
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
