import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useAppStore } from '@/store/appStore';
import { ACCENTS, DARK, LIGHT, getAccent, type AccentPalette, type ThemeColors } from './palettes';

export type ColorMode = 'light' | 'dark';

export interface Theme {
  mode: ColorMode;
  colors: ThemeColors;
  accent: AccentPalette;
  // Common reusable values
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  font: {
    arabic: string | undefined;
    ui: string | undefined;
    heading: string | undefined;
  };
  motion: { fast: number; base: number; slow: number };
  pressedScale: number;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const themePref = useAppStore(s => s.settings.themeMode);
  const accentId = useAppStore(s => s.settings.accent);

  // `useColorScheme()` can report `null` (not just 'light'/'dark') — briefly
  // on some platforms before the native side reports the real value, and
  // persistently on others (some Android OEM skins, certain Expo Go
  // configs). Treating anything non-'light' as dark meant those users saw
  // the app locked into dark mode even on a light-mode phone. Only an
  // explicit 'dark' report should produce dark; everything else falls back
  // to light, which is the safer default when the OS preference is unknown.
  const mode: ColorMode =
    themePref === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themePref;

  const value = useMemo<Theme>(() => ({
    mode,
    colors: mode === 'dark' ? DARK : LIGHT,
    accent: getAccent(accentId),
    spacing: (n: number) => n * 4,
    radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
    font: { arabic: undefined, ui: undefined, heading: undefined },
    motion: { fast: 120, base: 220, slow: 360 },
    pressedScale: 0.97,
  }), [mode, accentId]);

  // public/index.html only has a static `prefers-color-scheme` guess for
  // html/body's background (used as the backstop that shows through the
  // safe-area strips iOS exposes via viewport-fit=cover — the status bar and
  // home-indicator regions). That guess is wrong whenever the user has
  // overridden the in-app theme away from their OS setting, showing a
  // mismatched strip at the screen edges. Keeping the real DOM background in
  // sync with the live theme here closes that gap; native has no DOM at all,
  // so this is a no-op there.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = value.colors.background;
    document.body.style.backgroundColor = value.colors.background;
    // iOS paints the standalone-PWA status bar using this tag's value — keep
    // it matched to the real background too, not just html/body, or the
    // status bar reads as a separate-colored band from the app underneath it.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', value.colors.background);
  }, [value.colors.background]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { ACCENTS };
