import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}

export function SettingsRow({ label, value, onPress, trailing }: RowProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: t.spacing(4),
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.md,
        gap: t.spacing(3),
      }}
    >
      <Text
        style={{ color: t.colors.text, fontWeight: '600', fontSize: 16, flexShrink: 0 }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-end', gap: t.spacing(2),
      }}>
        {value ? (
          <Text
            style={{ color: t.colors.textMuted, flexShrink: 1 }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {value}
          </Text>
        ) : null}
        {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} /> : null)}
      </View>
    </Pressable>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <SettingsRow
      label={label}
      trailing={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: t.colors.border, true: t.accent.primary }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
}
