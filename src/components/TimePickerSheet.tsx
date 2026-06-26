import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
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

function toDate(hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  const d = new Date();
  if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}

function toHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Cross-platform time picker.
// - Android uses the imperative DateTimePickerAndroid dialog (native modal) so
//   we never render our own modal — the OS-supplied dialog is the experience
//   users already know. The parent only needs to flip `visible` to true.
// - iOS embeds the wheel spinner inside our own bottom sheet with explicit
//   Cancel / Done buttons (the native iOS picker has no built-in confirm row).
export function TimePickerSheet({ visible, value, title, onCancel, onConfirm }: Props) {
  const t = useTheme();
  const s = useStrings();
  const initial = useMemo(() => toDate(value), [value, visible]);
  const [draft, setDraft] = useState<Date>(initial);

  useEffect(() => {
    if (visible) setDraft(toDate(value));
  }, [visible, value]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          onConfirm(toHHMM(date));
        } else {
          onCancel();
        }
      },
    });
  }, [visible]);

  if (Platform.OS === 'android') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
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
            <Pressable hitSlop={10} onPress={() => onConfirm(toHHMM(draft))}>
              <Text style={{ color: t.accent.primary, fontWeight: '800', fontSize: 16 }}>
                {s.notifTimePickerDone}
              </Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            onChange={(_, d) => { if (d) setDraft(d); }}
            themeVariant={t.mode}
            textColor={t.colors.text}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
