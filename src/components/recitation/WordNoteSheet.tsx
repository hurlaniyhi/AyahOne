import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import type { WordFeedback } from '@/lib/recitationAi';

interface Props {
  word: WordFeedback | null;
  arabicFontFamily?: string;
  onClose: () => void;
}

export function WordNoteSheet({ word, arabicFontFamily, onClose }: Props) {
  const t = useTheme();
  const s = useStrings();
  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!word) return;
    fade.setValue(0);
    translateY.setValue(24);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [word, fade, translateY]);

  if (!word) return null;

  const statusLabel = word.status === 'mispronounced' ? s.reciteWordMispronounced
    : word.status === 'missed' ? s.reciteWordMissed
    : word.status === 'unclear' ? s.reciteWordUnclear
    : s.reciteWordCorrect;
  const statusColor = word.status === 'mispronounced' ? t.colors.brass
    : word.status === 'missed' ? t.colors.danger
    : word.status === 'unclear' ? t.accent.primary
    : t.colors.success;

  const close = () => {
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => onClose());
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: fade, backgroundColor: 'rgba(6, 47, 42, 0.5)', justifyContent: 'flex-end' }}>
        <Pressable onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={{
          transform: [{ translateY }],
          backgroundColor: t.colors.surfaceElevated,
          borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl,
          borderWidth: 0.75, borderColor: t.colors.hairline,
          paddingHorizontal: t.spacing(5), paddingTop: t.spacing(4), paddingBottom: t.spacing(8),
          gap: t.spacing(3),
        }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.hairline }} />
          <Text
            style={{ color: t.colors.text, fontSize: 30, textAlign: 'center', writingDirection: 'rtl', fontFamily: arabicFontFamily }}
          >
            {word.word}
          </Text>
          <View style={{ alignSelf: 'center', paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(1), borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted }}>
            <Text style={{ color: statusColor, fontWeight: '700', fontSize: 12 }}>{statusLabel}</Text>
          </View>
          {word.note ? (
            <Text style={{ color: t.colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{word.note}</Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
