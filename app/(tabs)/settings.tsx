import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, ACCENTS } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore, type ThemeMode, type AppLanguage } from '@/store/appStore';
import { SettingsRow } from '@/components/SettingsRow';

export default function SettingsScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);
  const profile = useAppStore(st => st.profile);
  const setProfileName = useAppStore(st => st.setProfileName);
  const [nameDraft, setNameDraft] = useState(profile.name);

  const modes: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: s.modeSystem },
    { id: 'light', label: s.modeLight },
    { id: 'dark', label: s.modeDark },
  ];
  const langs: { id: AppLanguage; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ar', label: 'العربية' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(4) }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 24 }}>{s.settings}</Text>

        {/* Profile */}
        <View style={{
          backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          padding: t.spacing(4), gap: t.spacing(2),
        }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12, letterSpacing: 0.8, fontWeight: '700', textTransform: 'uppercase' }}>{s.profileName}</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            onEndEditing={() => setProfileName(nameDraft.trim())}
            placeholder="Your name"
            placeholderTextColor={t.colors.textMuted}
            style={{ color: t.colors.text, fontSize: 18, fontWeight: '600', paddingVertical: t.spacing(2) }}
          />
        </View>

        {/* Appearance */}
        <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: t.spacing(2) }}>{s.appearance}</Text>
        <View style={{ gap: t.spacing(2) }}>
          <Pressable
            onPress={() => router.push('/settings/themes')}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              padding: t.spacing(4), gap: t.spacing(3),
              backgroundColor: t.colors.surface, borderRadius: t.radius.md,
              borderWidth: 0.75, borderColor: t.colors.hairline,
            }}
          >
            <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 16 }}>{s.theme}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(3) }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: t.accent.primary,
                borderWidth: 2, borderColor: t.colors.surface,
                shadowColor: '#000', shadowOpacity: t.mode === 'dark' ? 0.4 : 0.10,
                shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
              }} />
              <Text style={{ color: t.colors.textMuted, fontWeight: '600' }} numberOfLines={1}>
                {ACCENTS.find(a => a.id === settings.accent)?.label ?? settings.accent}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
            </View>
          </Pressable>

          <View style={{ padding: t.spacing(4), backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 0.75, borderColor: t.colors.hairline, gap: t.spacing(3) }}>
            <Text style={{ color: t.colors.text, fontWeight: '600' }}>{s.mode}</Text>
            <View style={{ flexDirection: 'row', gap: t.spacing(2) }}>
              {modes.map(m => {
                const active = settings.themeMode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setSetting('themeMode', m.id)}
                    style={{
                      flex: 1, paddingVertical: t.spacing(3),
                      borderRadius: t.radius.pill,
                      backgroundColor: active ? t.accent.primary : 'transparent',
                      borderWidth: 1, borderColor: active ? t.accent.primary : t.colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700' }}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ padding: t.spacing(4), backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 0.75, borderColor: t.colors.hairline, gap: t.spacing(3) }}>
            <Text style={{ color: t.colors.text, fontWeight: '600' }}>{s.language}</Text>
            <View style={{ flexDirection: 'row', gap: t.spacing(2) }}>
              {langs.map(l => {
                const active = settings.language === l.id;
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setSetting('language', l.id)}
                    style={{
                      flex: 1, paddingVertical: t.spacing(3),
                      borderRadius: t.radius.pill,
                      backgroundColor: active ? t.accent.primary : 'transparent',
                      borderWidth: 1, borderColor: active ? t.accent.primary : t.colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700' }}>{l.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Account */}
        <Text style={{ color: t.colors.textMuted, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: t.spacing(2) }}>{s.account}</Text>
        <SettingsRow label={s.account} onPress={() => router.push('/settings/account')} />
      </ScrollView>
    </SafeAreaView>
  );
}
