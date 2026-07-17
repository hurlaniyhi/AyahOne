import React, { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, SafeAreaView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';

interface Props {
  visible: boolean;
  totalVerses: number;
  selectedVerse: number;
  onClose: () => void;
  onSelect: (n: number) => void;
}

export function VersePickerSheet({ visible, totalVerses, selectedVerse, onClose, onSelect }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [q, setQ] = useState('');

  const verses = useMemo(() => {
    const all = Array.from({ length: totalVerses }, (_, i) => i + 1);
    if (!q.trim()) return all;
    return all.filter(n => String(n).includes(q.trim()));
  }, [q, totalVerses]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
        <View style={{ padding: t.spacing(4), gap: t.spacing(3), flex: 1 }}>
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
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 20, textAlign: 'center' }}>{s.selectVerse}</Text>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: t.spacing(2),
            borderWidth: 1, borderColor: t.colors.border,
            borderRadius: t.radius.pill,
            paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(2),
          }}>
            <Ionicons name="search-outline" size={18} color={t.colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={s.search}
              placeholderTextColor={t.colors.textMuted}
              keyboardType="number-pad"
              style={{ flex: 1, color: t.colors.text }}
            />
          </View>

          <FlatList
            data={verses}
            keyExtractor={n => String(n)}
            numColumns={5}
            columnWrapperStyle={{ gap: t.spacing(2) }}
            contentContainerStyle={{ gap: t.spacing(2), paddingBottom: t.spacing(8) }}
            renderItem={({ item }) => {
              const active = item === selectedVerse;
              return (
                <Pressable
                  onPress={() => { onSelect(item); onClose(); }}
                  style={{
                    flex: 1, aspectRatio: 1,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: t.radius.md,
                    backgroundColor: active ? t.accent.primary : t.colors.surface,
                  }}
                >
                  <Text style={{ color: active ? t.accent.onPrimary : t.colors.text, fontWeight: '700', fontSize: 18 }}>
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
