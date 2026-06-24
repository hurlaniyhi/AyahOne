import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassDock } from './GlassDock';

const TAB_ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index:       { on: 'home',         off: 'home-outline' },
  reading:     { on: 'book',         off: 'book-outline' },
  explore:     { on: 'search',       off: 'search-outline' },
  ask:         { on: 'chatbubble-ellipses', off: 'chatbubble-ellipses-outline' },
  settings:    { on: 'settings',     off: 'settings-outline' },
};

/**
 * Floating glass tab bar. Sits in normal layout flow (so screen content
 * naturally reserves space above it) but renders as a translucent pill
 * with hairline border and elevated shadow. Active tab gets the accent
 * color and a soft pill behind the icon; inactive tabs are muted.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingHorizontal: t.spacing(4),
        paddingBottom: Math.max(insets.bottom, t.spacing(2)) + t.spacing(2),
        paddingTop: t.spacing(2),
        backgroundColor: 'transparent',
      }}
    >
      <GlassDock radius={28} style={{ flexDirection: 'row', paddingHorizontal: t.spacing(2), paddingVertical: t.spacing(2) }}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
          const icons = TAB_ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' as const };
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              // navigation typing is intentionally loose here — Expo Router's
              // typed-routes layer makes the overloads picky; cast to any to
              // forward the tab name as-is.
              (navigation as any).navigate(route.name, route.params);
            }
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              // Disable Android's default rectangular ripple so the only
              // visible active-state cue is the circular pill behind the
              // icon \u2014 not a square tint bleeding through the tab.
              android_ripple={null}
              style={({ pressed }) => ({
                flex: 1, alignItems: 'center', justifyContent: 'center',
                paddingVertical: t.spacing(2),
                transform: [{ scale: pressed ? t.pressedScale : 1 }],
              })}
            >
              <View style={{
                // True circle so the active state reads the same on Android
                // and iOS. `overflow: hidden` forces Android to clip the
                // background fill to the rounded corners \u2014 without it some
                // Android builds render the fill on a square layer behind
                // the rounded view, which looks like a square highlight.
                width: 36, height: 36, borderRadius: 18,
                overflow: 'hidden',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: focused ? t.accent.primarySoft : 'transparent',
              }}>
                <Ionicons
                  name={focused ? icons.on : icons.off}
                  size={focused ? 22 : 21}
                  color={focused ? t.accent.primary : t.colors.textMuted}
                />
              </View>
              <Text style={{
                color: focused ? t.accent.primary : t.colors.textMuted,
                fontSize: 10, fontWeight: focused ? '700' : '500', marginTop: 2,
                letterSpacing: 0.2,
              }} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </GlassDock>
    </View>
  );
}
