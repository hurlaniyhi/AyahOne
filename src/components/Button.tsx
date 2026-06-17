import React from 'react';
import { Pressable, Text, ViewStyle, StyleProp, TextStyle, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

interface ButtonProps {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

export function Button({ label, onPress, variant = 'primary', disabled, style, textStyle, left, right, children }: ButtonProps) {
  const t = useTheme();
  const bg = variant === 'primary'
    ? t.accent.primary
    : variant === 'secondary'
      ? t.colors.surfaceElevated
      : variant === 'outline'
        ? 'transparent'
        : 'transparent';
  const fg = variant === 'primary' ? t.accent.onPrimary : t.colors.text;
  const borderWidth = variant === 'outline' ? 1 : 0;
  const borderColor = variant === 'outline' ? t.colors.border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [{
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.spacing(5),
        paddingVertical: t.spacing(4),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.spacing(2),
        borderWidth,
        borderColor,
      }, style]}
    >
      {left}
      {children ?? (
        <Text style={[{ color: fg, fontWeight: '700', fontSize: 16 }, textStyle]}>{label}</Text>
      )}
      {right}
    </Pressable>
  );
}

export function IconButton({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      opacity: pressed ? 0.7 : 1,
    }, style]}>
      <View>{children}</View>
    </Pressable>
  );
}
