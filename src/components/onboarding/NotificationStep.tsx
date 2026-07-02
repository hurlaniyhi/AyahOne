import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { useAppStore } from '@/store/appStore';
import { requestNotificationPermission, syncReminders } from '@/lib/notifications';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Halo, StepHeader, FeatureBullet, OnbFooter, type OnbNav } from './parts';

// Reminders step — the on-brand replacement for the OS boot prompt. "Yes"
// requests the OS permission then reflects the result in notificationsEnabled;
// "Not now" opts out silently. Either way we resync and advance.
export function NotificationStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  const setSetting = useAppStore(st => st.setSetting);
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    let granted = false;
    try {
      granted = await requestNotificationPermission();
    } catch {
      // The permission API can throw in some runtimes (notably Expo Go on
      // Android); treat any failure as "not granted" rather than stranding
      // the walkthrough on this step.
      granted = false;
    }
    setSetting('notificationsEnabled', granted);
    setBusy(false);
    nav.next();
    // Schedule/cancel in the background — never block navigation on the OS
    // scheduler (which can be slow on Android). This is also required because
    // granting leaves the flag at its default `true`, so the store's reminder
    // subscription alone wouldn't re-sync.
    void syncReminders();
  };

  const skip = () => {
    if (busy) return;
    setSetting('notificationsEnabled', false);
    nav.next();
    void syncReminders();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing(6) }}>
        <View style={{ alignItems: 'center' }}>
          <Halo size={200} icon="notifications-outline" />
        </View>

        <StepHeader eyebrow={s.onbNotifEyebrow} title={s.onbNotifTitle} subtitle={s.onbNotifSubtitle} />

        <Card elevated watermark style={{ gap: t.spacing(3) }}>
          <FeatureBullet icon="sunny-outline" text={s.onbNotifB1} />
          <FeatureBullet icon="moon-outline" text={s.onbNotifB2} />
          <FeatureBullet icon="flame-outline" text={s.onbNotifB3} />
        </Card>
      </View>

      <OnbFooter>
        <Button
          label={s.onbNotifEnable}
          onPress={enable}
          disabled={busy}
          left={<Ionicons name="notifications" size={18} color={t.accent.onPrimary} />}
        />
        <Pressable onPress={skip} hitSlop={8} disabled={busy} style={{ alignSelf: 'center', paddingVertical: t.spacing(2) }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 14, fontWeight: '600' }}>{s.onbNotifSkip}</Text>
        </Pressable>
      </OnbFooter>
    </View>
  );
}
