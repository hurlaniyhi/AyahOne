import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface RowProps {
  label: string;
  value?: string;
  description?: string;
  icon?: IoniconName;
  onPress?: () => void;
  trailing?: React.ReactNode;
  // Set when the row is rendered inside a SettingsGroup so the group can
  // own the surface chrome (radius, hairline separators) and the row stays
  // transparent. Standalone rows keep their own card surface as before.
  grouped?: boolean;
  // Hides the bottom hairline — used for the final row inside a group.
  last?: boolean;
}

export function SettingsRow({
  label, value, description, icon, onPress, trailing, grouped = false, last = false,
}: RowProps) {
  const t = useTheme();
  const content = (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: t.spacing(description ? 3 : 4),
      paddingHorizontal: grouped ? t.spacing(4) : t.spacing(4),
      gap: t.spacing(3),
      backgroundColor: grouped ? 'transparent' : t.colors.surface,
      borderRadius: grouped ? 0 : t.radius.md,
      borderBottomWidth: grouped && !last ? 0.5 : 0,
      borderBottomColor: t.colors.hairline,
    }}>
      {icon ? (
        <View style={{
          width: 32, height: 32, borderRadius: t.radius.sm,
          backgroundColor: t.accent.primarySoft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={18} color={t.accent.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: t.colors.text, fontWeight: '600', fontSize: 16 }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={{ color: t.colors.textMuted, flexShrink: 1, maxWidth: '45%' }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      ) : null}
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: t.colors.surfaceMuted }}>
      {content}
    </Pressable>
  );
}

export function ToggleRow({
  label, value, onChange, icon, description, grouped, last,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void;
  icon?: IoniconName; description?: string; grouped?: boolean; last?: boolean;
}) {
  const t = useTheme();
  return (
    <SettingsRow
      label={label}
      icon={icon}
      description={description}
      grouped={grouped}
      last={last}
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

// Section heading: uppercase eyebrow with optional supporting description.
// Sits above a SettingsGroup or a single row so users scan the screen by
// section title before reading the individual labels.
export function SettingsSection({ title, description }: { title: string; description?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4, marginTop: t.spacing(2), marginBottom: t.spacing(1) }}>
      <Text style={{
        color: t.colors.textMuted, fontSize: 12, fontWeight: '800',
        letterSpacing: 1.2, textTransform: 'uppercase',
      }}>
        {title}
      </Text>
      {description ? (
        <Text style={{ color: t.colors.textMuted, fontSize: 12, lineHeight: 16 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

// Card container that groups related rows. Owns the surface, border and
// rounded corners so the contained rows can render as a clean list with
// hairline separators. Children are cloned to inject `grouped` and to mark
// the last visible child with `last` (so its bottom hairline is hidden).
export function SettingsGroup({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const items = React.Children.toArray(children).filter(Boolean) as React.ReactElement[];
  return (
    <View style={{
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 0.75, borderColor: t.colors.hairline,
      overflow: 'hidden',
    }}>
      {items.map((child, i) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ grouped?: boolean; last?: boolean }>, {
              grouped: true,
              last: i === items.length - 1,
            })
          : child,
      )}
    </View>
  );
}
