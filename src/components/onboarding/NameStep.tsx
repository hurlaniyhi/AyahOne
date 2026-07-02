import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/Button';
import { StepHeader, OnbFooter, withAlpha, type OnbNav } from './parts';

// Personalisation step — captures the user's name (optional) so greetings and
// the finish screen can address them. Commits live to profile.name.
export function NameStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  const profileName = useAppStore(st => st.profile.name);
  const setProfileName = useAppStore(st => st.setProfileName);
  const [name, setName] = useState(profileName);

  const onChange = (v: string) => {
    setName(v);
    setProfileName(v.trim());
  };

  const initial = (name || '').trim().charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, gap: t.spacing(6), paddingTop: t.spacing(4) }}>
        <View style={{ alignItems: 'center', gap: t.spacing(4) }}>
          <View style={{
            width: 96, height: 96, borderRadius: 48,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: withAlpha(t.accent.primary, t.mode === 'dark' ? 0.20 : 0.14),
            borderWidth: 2, borderColor: t.accent.primary,
          }}>
            <Text style={{ color: t.accent.primary, fontSize: 40, fontWeight: '800' }}>
              {initial || '﷽'.charAt(0)}
            </Text>
          </View>
          <StepHeader title={s.onbNameTitle} subtitle={s.onbNameSubtitle} />
        </View>

        <View style={{ gap: t.spacing(2) }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 }}>
            {s.onbNameLabel}
          </Text>
          <TextInput
            value={name}
            onChangeText={onChange}
            placeholder={s.onbNamePlaceholder}
            placeholderTextColor={t.colors.textMuted}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={nav.next}
            style={{
              backgroundColor: t.colors.surface,
              borderWidth: 1, borderColor: name.trim() ? t.accent.primary : t.colors.hairline,
              borderRadius: t.radius.lg,
              paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(4),
              color: t.colors.text, fontSize: 16, fontWeight: '600',
            }}
          />
        </View>
      </View>

      <OnbFooter>
        <Button label={s.onbContinue} onPress={nav.next} />
        <Pressable onPress={nav.next} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: t.spacing(2) }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 14, fontWeight: '600' }}>{s.onbNameSkip}</Text>
        </Pressable>
      </OnbFooter>
    </KeyboardAvoidingView>
  );
}
