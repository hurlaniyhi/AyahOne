import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, ACCENTS } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore, type ThemeMode, type AppLanguage } from '@/store/appStore';
import { SettingsRow, SettingsGroup, SettingsSection } from '@/components/SettingsRow';

export default function SettingsScreen() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);
  const profile = useAppStore(st => st.profile);
  const setProfileName = useAppStore(st => st.setProfileName);
  const [nameDraft, setNameDraft] = useState(profile.name);

  const modes: { id: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'system', label: s.modeSystem, icon: 'phone-portrait-outline' },
    { id: 'light', label: s.modeLight, icon: 'sunny-outline' },
    { id: 'dark', label: s.modeDark, icon: 'moon-outline' },
  ];
  const langs: { id: AppLanguage; label: string }[] = [
    { id: 'en', label: s.langEnglish },
    { id: 'ar', label: s.langArabic },
    { id: 'fr', label: s.langFrench },
  ];
  const activeAccent = ACCENTS.find(a => a.id === settings.accent);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), paddingBottom: t.spacing(8), gap: t.spacing(3) }}>
        <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 28, marginBottom: t.spacing(1) }}>
          {s.settings}
        </Text>

        {/* Profile — avatar + name input + entry to the full account screen */}
        <Pressable
          onPress={() => router.push('/settings/account')}
          style={{
            backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
            borderWidth: 0.75, borderColor: t.colors.hairline,
            padding: t.spacing(4), flexDirection: 'row', alignItems: 'center',
            gap: t.spacing(4),
          }}
        >
          <View style={{
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: profile.photoUri ? 'transparent' : t.accent.primarySoft,
            borderWidth: 1.5, borderColor: t.accent.primary,
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={{ width: 60, height: 60 }} />
            ) : (
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 22 }}>
                {(profile.name || 'F').trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              {s.profileName}
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              onEndEditing={() => setProfileName(nameDraft.trim())}
              placeholder={s.profileName}
              placeholderTextColor={t.colors.textMuted}
              style={{ color: t.colors.text, fontSize: 18, fontWeight: '700', paddingVertical: 2 }}
            />
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
        </Pressable>

        {/* Appearance */}
        <SettingsSection title={s.appearance} />
        <SettingsGroup>
          <SettingsRow
            icon="color-palette-outline"
            label={s.theme}
            onPress={() => router.push('/settings/themes')}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: t.accent.primary,
                  borderWidth: 2, borderColor: t.colors.surface,
                  shadowColor: '#000', shadowOpacity: t.mode === 'dark' ? 0.4 : 0.10,
                  shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                }} />
                <Text style={{ color: t.colors.textMuted, fontWeight: '600' }} numberOfLines={1}>
                  {activeAccent?.label ?? settings.accent}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
              </View>
            }
          />
        </SettingsGroup>

        {/* Mode — segmented with icons so the choices read at a glance */}
        <View style={{
          padding: t.spacing(4), backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg, borderWidth: 0.75, borderColor: t.colors.hairline,
          gap: t.spacing(3),
        }}>
          <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 15 }}>{s.mode}</Text>
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
                    backgroundColor: active ? t.accent.primary : t.colors.surfaceMuted,
                    borderWidth: 1, borderColor: active ? t.accent.primary : 'transparent',
                    alignItems: 'center', flexDirection: 'row',
                    justifyContent: 'center', gap: t.spacing(1),
                  }}
                >
                  <Ionicons
                    name={m.icon}
                    size={15}
                    color={active ? t.accent.onPrimary : t.colors.text}
                  />
                  <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700', fontSize: 13 }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* App language — three-way segmented including French */}
        <View style={{
          padding: t.spacing(4), backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg, borderWidth: 0.75, borderColor: t.colors.hairline,
          gap: t.spacing(3),
        }}>
          <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 15 }}>{s.language}</Text>
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
                    backgroundColor: active ? t.accent.primary : t.colors.surfaceMuted,
                    borderWidth: 1, borderColor: active ? t.accent.primary : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700', fontSize: 13 }}>
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Account — link into the full account screen with a preview of
            what's inside so the entry doesn't read as a dead-end row. */}
        <SettingsSection title={s.account} />
        <SettingsGroup>
          <SettingsRow
            icon="person-circle-outline"
            label={s.account}
            description={`${s.reading} · ${s.notifications} · ${s.goal}`}
            onPress={() => router.push('/settings/account')}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
