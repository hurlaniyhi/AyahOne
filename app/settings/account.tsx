import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, FlatList, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore, type AppLanguage } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { TRANSLATIONS } from '@/data/translations';
import { ToggleRow, SettingsRow } from '@/components/SettingsRow';

const SCRIPT_LABEL_KEY = {
  uthmani: 'scriptUthmani',
  indopak: 'scriptIndopak',
  tajweed: 'scriptTajweed',
} as const;

const LANG_OPTIONS: { id: AppLanguage; labelKey: 'langEnglish' | 'langArabic' | 'langFrench' }[] = [
  { id: 'en', labelKey: 'langEnglish' },
  { id: 'ar', labelKey: 'langArabic' },
  { id: 'fr', labelKey: 'langFrench' },
];

export default function AccountSettings() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);
  const profile = useAppStore(st => st.profile);
  const setProfilePhoto = useAppStore(st => st.setProfilePhoto);
  const dailyGoal = useAppStore(st => st.dailyGoalVerses);
  const setDailyGoal = useAppStore(st => st.setDailyGoal);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const currentTrans = TRANSLATIONS.find(x => x.id === settings.translationId);
  const scriptLabel = s[SCRIPT_LABEL_KEY[settings.arabicScript]];
  const languageLabel =
    settings.language === 'ar' ? s.langArabic
    : settings.language === 'fr' ? s.langFrench
    : s.langEnglish;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(s.profilePicture, perm.canAskAgain ? 'Permission required' : 'Enable photo access in Settings');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      allowsMultipleSelection: false,
      selectionLimit: 1,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setProfilePhoto(res.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3) }}>
        <View style={{ alignItems: 'center', paddingVertical: t.spacing(3), gap: t.spacing(2) }}>
          <Pressable
            onPress={pickPhoto}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 112, height: 112, borderRadius: 56, overflow: 'hidden',
              backgroundColor: profile.photoUri ? 'transparent' : t.accent.primarySoft,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: t.accent.primary,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={{ width: 112, height: 112 }} />
            ) : (
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 40 }}>
                {(profile.name || 'F').trim().charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={{
              position: 'absolute', right: 2, bottom: 2,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: t.accent.primary,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: t.colors.background,
            }}>
              <Ionicons name="camera" size={16} color={t.accent.onPrimary} />
            </View>
          </Pressable>
          <Pressable onPress={pickPhoto} hitSlop={6}>
            <Text style={{ color: t.accent.primary, fontWeight: '700' }}>
              {profile.photoUri ? s.changePhoto : s.addPhoto}
            </Text>
          </Pressable>
          {profile.photoUri ? (
            <Pressable onPress={() => setProfilePhoto(null)} hitSlop={6}>
              <Text style={{ color: t.colors.textMuted, fontSize: 13 }}>{s.removePhoto}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={{ color: t.colors.textMuted, fontWeight: '700' }}>{s.appLanguage}</Text>
        <SettingsRow
          label={s.appLanguage}
          value={languageLabel}
          onPress={() => setLangOpen(true)}
        />

        <Text style={{ color: t.colors.textMuted, fontWeight: '700', marginTop: t.spacing(3) }}>Reading</Text>
        <ToggleRow label={s.translation} value={settings.showTranslation} onChange={v => setSetting('showTranslation', v)} />
        <ToggleRow label={s.transliteration} value={settings.showTransliteration} onChange={v => setSetting('showTransliteration', v)} />
        <ToggleRow label={s.hideHasanat} value={settings.hideHasanat} onChange={v => setSetting('hideHasanat', v)} />
        <ToggleRow label={s.showReadingLevel} value={settings.showReadingLevel} onChange={v => setSetting('showReadingLevel', v)} />

        <SettingsRow
          label={s.translationLanguage}
          value={currentTrans ? `${currentTrans.label} (${currentTrans.language})` : settings.translationId}
          onPress={() => setPickerOpen(true)}
        />

        <Text style={{ color: t.colors.textMuted, fontWeight: '700', marginTop: t.spacing(3) }}>{s.quranDisplay}</Text>
        <SettingsRow
          label={s.quranScript}
          value={scriptLabel}
          onPress={() => router.push('/settings/quran-display')}
        />

        <Text style={{ color: t.colors.textMuted, fontWeight: '700', marginTop: t.spacing(3) }}>Goals</Text>
        <View style={{
          padding: t.spacing(4), backgroundColor: t.colors.surface,
          borderRadius: t.radius.md, gap: t.spacing(3),
        }}>
          <Text style={{ color: t.colors.text, fontWeight: '600' }}>Daily goal</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2) }}>
            {[5, 10, 20, 50, 100].map(n => {
              const active = dailyGoal === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setDailyGoal(n)}
                  style={{
                    paddingHorizontal: t.spacing(4), paddingVertical: t.spacing(2),
                    borderRadius: t.radius.pill,
                    backgroundColor: active ? t.accent.primary : 'transparent',
                    borderWidth: 1, borderColor: active ? t.accent.primary : t.colors.border,
                  }}
                >
                  <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700' }}>
                    {n} {s.versesPerDay}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
          <View style={{ padding: t.spacing(4), gap: t.spacing(3), flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20 }}>{s.translationLanguage}</Text>
            <FlatList
              data={TRANSLATIONS}
              keyExtractor={x => x.id}
              ItemSeparatorComponent={() => <View style={{ height: t.spacing(2) }} />}
              renderItem={({ item }) => {
                const active = settings.translationId === item.id;
                return (
                  <Pressable
                    onPress={() => { setSetting('translationId', item.id); setPickerOpen(false); }}
                    style={{
                      padding: t.spacing(4),
                      backgroundColor: t.colors.surface,
                      borderRadius: t.radius.md,
                      borderWidth: active ? 1.5 : 0,
                      borderColor: active ? t.accent.primary : 'transparent',
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <View>
                      <Text style={{ color: t.colors.text, fontWeight: '600' }}>{item.label}</Text>
                      <Text style={{ color: t.colors.textMuted }}>{item.language}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" color={t.accent.primary} size={22} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={langOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLangOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
          <View style={{ padding: t.spacing(4), gap: t.spacing(3), flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20 }}>{s.appLanguage}</Text>
            <FlatList
              data={LANG_OPTIONS}
              keyExtractor={x => x.id}
              ItemSeparatorComponent={() => <View style={{ height: t.spacing(2) }} />}
              renderItem={({ item }) => {
                const active = settings.language === item.id;
                return (
                  <Pressable
                    onPress={() => { setSetting('language', item.id); setLangOpen(false); }}
                    style={{
                      padding: t.spacing(4),
                      backgroundColor: t.colors.surface,
                      borderRadius: t.radius.md,
                      borderWidth: active ? 1.5 : 0,
                      borderColor: active ? t.accent.primary : 'transparent',
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: t.colors.text, fontWeight: '600' }}>{s[item.labelKey]}</Text>
                    {active && <Ionicons name="checkmark-circle" color={t.accent.primary} size={22} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
