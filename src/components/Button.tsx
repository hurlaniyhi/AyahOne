import React from 'react';
import { Pressable, Text, ViewStyle, StyleProp, TextStyle, View } from 'react-native';
import * as Haptics from 'expo-haptics';
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
  haptic?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled, style, textStyle, left, right, children, haptic = true }: ButtonProps) {
  const t = useTheme();
  const bg = variant === 'primary'
    ? t.accent.primary
    : variant === 'secondary'
      ? t.colors.surfaceElevated
      : variant === 'outline'
        ? 'transparent'
        : 'transparent';
  const fg = variant === 'primary' ? t.accent.onPrimary : t.colors.text;
  const borderWidth = variant === 'outline' ? 1.25 : 0;
  const borderColor = variant === 'outline' ? t.colors.border : 'transparent';

  const handlePress = () => {
    if (disabled) return;
    if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [{
        backgroundColor: bg,
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: pressed && !disabled ? t.pressedScale : 1 }],
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
        <Text style={[{ color: fg, fontWeight: '700', fontSize: 16, letterSpacing: 0.2 }, textStyle]}>{label}</Text>
      )}
      {right}
    </Pressable>
  );
}

export function IconButton({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: StyleSheetHairlineWidth(),
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surface,
        transform: [{ scale: pressed ? t.pressedScale : 1 }],
      }, style]}
    >
      <View>{children}</View>
    </Pressable>
  );
}

function StyleSheetHairlineWidth() {
  // 0.75 reads as a sub-pixel hairline on @2x/@3x devices
  return 0.75;
}
