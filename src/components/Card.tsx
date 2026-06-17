import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { ArabesqueMark } from './ArabesqueMark';

interface CardProps extends ViewProps {
  borderColor?: string;
  padded?: boolean;
  rounded?: keyof ReturnType<typeof useTheme>['radius'];
  elevated?: boolean;
  watermark?: boolean;
}

export function Card({ borderColor, padded = true, rounded = 'lg', elevated = false, watermark = false, style, children, ...rest }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: elevated ? t.colors.surfaceElevated : t.colors.surface,
    borderRadius: t.radius[rounded],
    borderWidth: borderColor ? 1 : 0.75,
    borderColor: borderColor ?? t.colors.hairline,
    padding: padded ? t.spacing(4) : 0,
    overflow: 'hidden',
    ...(elevated ? {
      shadowColor: '#000',
      shadowOpacity: t.mode === 'dark' ? 0.35 : 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    } : null),
  };
  return (
    <View style={[base, style]} {...rest}>
      {watermark && (
        <View pointerEvents="none" style={{
          position: 'absolute', right: -28, bottom: -28, opacity: t.mode === 'dark' ? 0.10 : 0.06,
        }}>
          <ArabesqueMark size={150} color={t.colors.brass} />
        </View>
      )}
      {children}
    </View>
  );
}
