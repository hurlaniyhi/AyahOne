import React, { useState } from 'react';
import { Modal, View, Text, FlatList, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { SURAHS, getSurah } from '@/data/surahs';
import { JUZ_STARTS } from '@/data/juz';

interface Props {
  visible: boolean;
  selectedSurah: number;
  onClose: () => void;
  onSelectSurah: (n: number) => void;
  // Juz tab is only offered when this is provided — callers with no juz
  // concept (e.g. goal-setting surah pickers) simply omit it and get the
  // chapter-only picker exactly as before.
  onSelectJuz?: (juz: number) => void;
}

export function SurahPickerSheet({ visible, selectedSurah, onClose, onSelectSurah, onSelectJuz }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [tab, setTab] = useState<'juz' | 'chapter'>('chapter');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <View style={{ padding: t.spacing(4), gap: t.spacing(4), flex: 1 }}>
          <View style={{ height: 32, justifyContent: 'center' }}>
            <View style={{
              alignSelf: 'center', width: 48, height: 5, borderRadius: 3,
              backgroundColor: t.mode === 'dark' ? '#6B7280' : '#9CA3AF',
            }} />
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={{
                position: 'absolute', right: 0, top: 0,
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.surface,
                borderWidth: 1, borderColor: t.colors.border,
              }}
            >
              <Ionicons name="close" size={20} color={t.colors.text} />
            </Pressable>
          </View>
          {onSelectJuz && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              {(['juz', 'chapter'] as const).map(k => {
                const active = tab === k;
                return (
                  <Pressable key={k} onPress={() => setTab(k)} style={{
                    paddingHorizontal: t.spacing(6), paddingVertical: t.spacing(2),
                    borderRadius: t.radius.pill,
                    backgroundColor: active ? t.accent.primary : 'transparent',
                  }}>
                    <Text style={{ color: active ? t.accent.onPrimary : t.colors.textMuted, fontWeight: '700', fontSize: 18 }}>
                      {k === 'juz' ? s.juz : s.chapter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {onSelectJuz && tab === 'juz' ? (
            <FlatList
              data={JUZ_STARTS}
              keyExtractor={item => String(item.juz)}
              ItemSeparatorComponent={() => <View style={{ height: t.spacing(2) }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { onSelectJuz(item.juz); onClose(); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: t.spacing(4),
                    borderRadius: t.radius.lg,
                    backgroundColor: t.colors.surface,
                  }}
                >
                  <View>
                    <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>
                      {s.juz} {item.juz}
                    </Text>
                    <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>
                      {getSurah(item.surah)?.englishName} · {item.ayah}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              data={SURAHS}
              keyExtractor={item => String(item.number)}
              ItemSeparatorComponent={() => <View style={{ height: t.spacing(2) }} />}
              renderItem={({ item }) => {
                const active = item.number === selectedSurah;
                return (
                  <Pressable
                    onPress={() => { onSelectSurah(item.number); onClose(); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      padding: t.spacing(4),
                      borderRadius: t.radius.lg,
                      backgroundColor: t.colors.surface,
                      borderWidth: active ? 1.5 : 0,
                      borderColor: active ? t.accent.primary : 'transparent',
                    }}
                  >
                    <View>
                      <Text style={{ color: active ? t.accent.primary : t.colors.text, fontWeight: '700', fontSize: 16 }}>
                        {item.number}. {item.englishName}
                      </Text>
                      <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>{item.englishTranslation}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
                      <Text style={{ color: t.colors.textMuted }}>{item.numberOfAyahs} Verses</Text>
                      <Ionicons name="cloud-download-outline" size={20} color={t.accent.primary} />
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
