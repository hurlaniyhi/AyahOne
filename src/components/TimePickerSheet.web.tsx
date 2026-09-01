import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';

interface Props {
  visible: boolean;
  // Stored "HH:MM" or '' (uncustomised → picker opens at current wall-clock).
  value: string;
  title: string;
  onCancel: () => void;
  onConfirm: (hhmm: string) => void;
}

function currentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Web build of TimePickerSheet (Metro/Expo picks this file over the plain
// .tsx automatically on web, native picks the other — this file is never
// bundled for iOS/Android). @react-native-community/datetimepicker has no
// web implementation at all: it resolves to the package's own no-op stub
// there, which is why the reminder time rows previously did nothing when
// tapped. The browser's native <input type="time"> is the closest
// equivalent — same bottom-sheet shell and Cancel/Done affordance as the
// native version, just the picker control itself swapped for one that
// actually exists on web.
export function TimePickerSheet({ visible, value, title, onCancel, onConfirm }: Props) {
  const t = useTheme();
  const s = useStrings();
  const [draft, setDraft] = useState(value || currentHHMM());

  useEffect(() => {
    if (visible) setDraft(value || currentHHMM());
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radius.lg,
            borderTopRightRadius: t.radius.lg,
            paddingBottom: t.spacing(4),
            paddingTop: t.spacing(2),
            paddingHorizontal: t.spacing(3),
            gap: t.spacing(2),
          }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: t.spacing(2), paddingVertical: t.spacing(2),
          }}>
            <Pressable hitSlop={10} onPress={onCancel}>
              <Text style={{ color: t.colors.textMuted, fontSize: 16 }}>
                {s.notifTimePickerCancel}
              </Text>
            </Pressable>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16 }}>
              {title}
            </Text>
            <Pressable hitSlop={10} onPress={() => onConfirm(draft)}>
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 16 }}>
                {s.notifTimePickerDone}
              </Text>
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', paddingVertical: t.spacing(4) }}>
            {/* A real DOM element — this file only ever renders on web, so
                there's no cross-platform JSX concern. `colorScheme` makes the
                browser render the control's own chrome (spinner arrows, the
                native OS time-wheel on mobile browsers) in the right theme. */}
            <input
              type="time"
              value={draft}
              onChange={e => setDraft(e.target.value || draft)}
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: t.colors.text,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                colorScheme: t.mode,
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
