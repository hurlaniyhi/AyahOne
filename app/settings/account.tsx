import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppStore } from '@/store/appStore';
import { useStrings } from '@/i18n/strings';
import { TRANSLATIONS } from '@/data/translations';
import { ToggleRow, SettingsRow } from '@/components/SettingsRow';

export default function AccountSettings() {
  const t = useTheme();
  const s = useStrings();
  const router = useRouter();
  const settings = useAppStore(st => st.settings);
  const setSetting = useAppStore(st => st.setSetting);
  const dailyGoal = useAppStore(st => st.dailyGoalVerses);
  const setDailyGoal = useAppStore(st => st.setDailyGoal);
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentTrans = TRANSLATIONS.find(x => x.id === settings.translationId);
  const scriptLabel = settings.arabicScript === 'uthmani' ? s.scriptUthmani : s.scriptIndopak;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3) }}>
        <Text style={{ color: t.colors.textMuted, fontWeight: '700' }}>Reading</Text>
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
    </SafeAreaView>
  );
}
