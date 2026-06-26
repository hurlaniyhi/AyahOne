import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, FlatList, Image, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore, type AppLanguage } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { TRANSLATIONS } from '@/data/translations';
import { ToggleRow, SettingsRow, SettingsSection, SettingsGroup } from '@/components/SettingsRow';
import { TimePickerSheet } from '@/components/TimePickerSheet';
import { requestNotificationPermission } from '@/lib/notifications';

// Localised "8:00 PM" style formatter for the reminder time rows. If the user
// has not customised a time, render the current wall-clock so the row reads
// the way the picker will open — matching the brief that "current time is the
// default if not set by the user".
function formatTime(hhmm: string, lang: 'en' | 'ar' | 'fr'): string {
  const d = new Date();
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  const locale = lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : 'en-US';
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
  } catch {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}

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
  // Which time picker is open: 'goal', 'kahf', or null. One picker at a time
  // keeps the UI legible and lets us share a single sheet instance.
  const [timePicker, setTimePicker] = useState<'goal' | 'kahf' | null>(null);

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

  const onToggleNotifications = async (v: boolean) => {
    if (v) {
      // Opt-in: request OS permission first; if the user previously denied it,
      // point them at system Settings rather than silently flipping the switch
      // on with no underlying permission.
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(s.notifications, s.notifPermissionDenied, [
          { text: s.askCancel, style: 'cancel' },
          { text: s.settings, onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    setSetting('notificationsEnabled', v);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), paddingBottom: t.spacing(8), gap: t.spacing(3) }}>
        {/* Profile hero — photo + name preview, framed against the accent
            tint so the avatar reads as the focal point of the screen. */}
        <View style={{ alignItems: 'center', paddingVertical: t.spacing(2), gap: t.spacing(2) }}>
          <Pressable
            onPress={pickPhoto}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 116, height: 116, borderRadius: 58, overflow: 'hidden',
              backgroundColor: profile.photoUri ? 'transparent' : t.accent.primarySoft,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: t.accent.primary,
              shadowColor: t.accent.primary,
              shadowOpacity: t.mode === 'dark' ? 0.45 : 0.18,
              shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={{ width: 116, height: 116 }} />
            ) : (
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 42 }}>
                {(profile.name || 'F').trim().charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={{
              position: 'absolute', right: 2, bottom: 2,
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: t.accent.primary,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: t.colors.background,
            }}>
              <Ionicons name="camera" size={16} color={t.accent.onPrimary} />
            </View>
          </Pressable>
          {profile.name ? (
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 18 }} numberOfLines={1}>
              {profile.name}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(4) }}>
            <Pressable onPress={pickPhoto} hitSlop={6}>
              <Text style={{ color: t.accent.primary, fontWeight: '700' }}>
                {profile.photoUri ? s.changePhoto : s.addPhoto}
              </Text>
            </Pressable>
            {profile.photoUri ? (
              <>
                <View style={{ width: 1, height: 14, backgroundColor: t.colors.hairline }} />
                <Pressable onPress={() => setProfilePhoto(null)} hitSlop={6}>
                  <Text style={{ color: t.colors.textMuted, fontSize: 13, fontWeight: '600' }}>{s.removePhoto}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        {/* Language */}
        <SettingsSection title={s.appLanguage} />
        <SettingsGroup>
          <SettingsRow
            icon="globe-outline"
            label={s.appLanguage}
            value={languageLabel}
            onPress={() => setLangOpen(true)}
          />
        </SettingsGroup>

        {/* Reading — script + translation choices + per-verse toggles */}
        <SettingsSection title={s.reading} />
        <SettingsGroup>
          <SettingsRow
            icon="document-text-outline"
            label={s.quranScript}
            value={scriptLabel}
            onPress={() => router.push('/settings/quran-display')}
          />
          <SettingsRow
            icon="language-outline"
            label={s.translationLanguage}
            value={currentTrans ? `${currentTrans.label} (${currentTrans.language})` : settings.translationId}
            onPress={() => setPickerOpen(true)}
          />
          <ToggleRow
            icon="book-outline"
            label={s.translation}
            value={settings.showTranslation}
            onChange={v => setSetting('showTranslation', v)}
          />
          <ToggleRow
            icon="text-outline"
            label={s.transliteration}
            value={settings.showTransliteration}
            onChange={v => setSetting('showTransliteration', v)}
          />
          <ToggleRow
            icon="speedometer-outline"
            label={s.showReadingLevel}
            value={settings.showReadingLevel}
            onChange={v => setSetting('showReadingLevel', v)}
          />
          <ToggleRow
            icon="sparkles-outline"
            label={s.hideHasanat}
            value={settings.hideHasanat}
            onChange={v => setSetting('hideHasanat', v)}
          />
        </SettingsGroup>

        {/* Notifications — master switch, then time pickers slide in below */}
        <SettingsSection title={s.notifications} description={s.notificationsToggleHint} />
        <SettingsGroup>
          <ToggleRow
            icon="notifications-outline"
            label={s.notificationsToggle}
            value={settings.notificationsEnabled}
            onChange={onToggleNotifications}
          />
        </SettingsGroup>
        {settings.notificationsEnabled ? (
          <SettingsGroup>
            <SettingsRow
              icon="time-outline"
              label={s.notifGoalTimeLabel}
              value={formatTime(settings.goalReminderTime, settings.language)}
              onPress={() => setTimePicker('goal')}
            />
            <SettingsRow
              icon="moon-outline"
              label={s.notifKahfTimeLabel}
              value={formatTime(settings.kahfReminderTime, settings.language)}
              onPress={() => setTimePicker('kahf')}
            />
          </SettingsGroup>
        ) : null}

        {/* Daily goal — pill chooser without a duplicate inner heading */}
        <SettingsSection title={s.goal} description={s.dailyGoalDesc} />
        <View style={{
          padding: t.spacing(4),
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          gap: t.spacing(3),
        }}>
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
                    backgroundColor: active ? t.accent.primary : t.colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: active ? t.accent.primary : 'transparent',
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

      <TimePickerSheet
        visible={timePicker !== null}
        value={
          timePicker === 'goal' ? settings.goalReminderTime
          : timePicker === 'kahf' ? settings.kahfReminderTime
          : ''
        }
        title={
          timePicker === 'goal' ? s.notifGoalTimeLabel
          : timePicker === 'kahf' ? s.notifKahfTimeLabel
          : s.notifTimePickerTitle
        }
        onCancel={() => setTimePicker(null)}
        onConfirm={hhmm => {
          if (timePicker === 'goal') setSetting('goalReminderTime', hhmm);
          else if (timePicker === 'kahf') setSetting('kahfReminderTime', hhmm);
          setTimePicker(null);
        }}
      />
    </SafeAreaView>
  );
}
