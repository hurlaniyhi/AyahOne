import React from 'react';
import { View, ViewProps, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme/ThemeProvider';

interface Props extends ViewProps {
  /** Visual intensity of blur, 0..100. Default 60. */
  intensity?: number;
  /** Override corner radius. Default 28 (pill-ish on a wide dock). */
  radius?: number;
}

/**
 * Floating translucent container — used by the tab bar and the
 * reader's quick-jump dock. Falls back to a solid tinted surface on
 * platforms where BlurView is unsupported (older Android, web).
 */
export function GlassDock({ intensity = 60, radius = 28, style, children, ...rest }: Props) {
  const t = useTheme();
  const tint = t.mode === 'dark' ? 'dark' : 'light';
  const fallbackBg = t.mode === 'dark'
    ? 'rgba(18, 26, 32, 0.92)'
    : 'rgba(255, 252, 245, 0.92)';
  // expo-blur on Android samples inconsistently and tends to render as a
  // soft rectangular tint instead of a uniform blur, which leaks a visible
  // box around the tab bar and reader dock. Use the solid tinted fallback
  // on Android; iOS keeps the real BlurView.
  const useBlur = Platform.OS === 'ios';
  const container = {
    borderRadius: radius,
    overflow: 'hidden' as const,
    borderWidth: 0.75,
    borderColor: t.colors.hairline,
    shadowColor: '#000',
    shadowOpacity: t.mode === 'dark' ? 0.45 : 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    backgroundColor: useBlur ? 'transparent' : fallbackBg,
  };
  return (
    <View style={[container, style]} {...rest}>
      {useBlur ? (
        <BlurView intensity={intensity} tint={tint} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      ) : null}
      {children}
    </View>
  );
}
