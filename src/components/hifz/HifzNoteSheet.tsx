import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, Animated, Easing } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { Button } from '@/components/Button';

interface Props {
  visible: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

// Bottom sheet for a per-ayah Hifz note ("similar to ayah 23", a
// pronunciation reminder, ...) — same fade/translateY technique as
// WordNoteSheet (src/components/recitation/WordNoteSheet.tsx), adapted for
// editing rather than read-only display.
export function HifzNoteSheet({ visible, initialText, onSave, onClose }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [text, setText] = useState(initialText);
  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!visible) return;
    setText(initialText);
    fade.setValue(0);
    translateY.setValue(24);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [visible, initialText, fade, translateY]);

  if (!visible) return null;

  const close = () => {
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => onClose());
  };
  const save = () => {
    onSave(text);
    close();
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
          <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
            {s.hifzNoteTitle}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={s.hifzNotePlaceholder}
            placeholderTextColor={t.colors.textMuted}
            multiline
            style={{
              minHeight: 100, textAlignVertical: 'top',
              borderWidth: 0.75, borderColor: t.colors.hairline, borderRadius: t.radius.md,
              paddingHorizontal: t.spacing(3), paddingVertical: t.spacing(3),
              color: t.colors.text, fontSize: 15, lineHeight: 21,
            }}
          />
          <Button label={s.hifzSaveNote} onPress={save} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
