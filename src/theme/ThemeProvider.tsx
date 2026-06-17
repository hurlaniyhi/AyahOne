import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
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

  const mode: ColorMode =
    themePref === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themePref;

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

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { ACCENTS };
