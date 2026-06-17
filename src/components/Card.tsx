import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface CardProps extends ViewProps {
  borderColor?: string;
  padded?: boolean;
  rounded?: keyof ReturnType<typeof useTheme>['radius'];
}

export function Card({ borderColor, padded = true, rounded = 'lg', style, children, ...rest }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius[rounded],
    borderWidth: borderColor ? 1 : 0,
    borderColor: borderColor,
    padding: padded ? t.spacing(4) : 0,
  };
  return <View style={[base, style]} {...rest}>{children}</View>;
}
