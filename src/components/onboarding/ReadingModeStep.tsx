import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StepHeader, OnbFooter, withAlpha, type OnbNav } from './parts';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Introduces the two reading surfaces (verse-by-verse vs. continuous mushaf
// page) as a plain icon + description pair — same language as the feature
// slides earlier in the flow — rather than a mocked-up screen preview. It
// never touches `settings.readingMode`: onboarding always starts a new user
// in Ayah mode, and the real toggle lives in the reader header / Settings
// once they're in the app.
function ModeRow({
  icon, title, description, badge,
}: { icon: IoniconName; title: string; description: string; badge?: string }) {
  const t = useTheme();
  return (
    <Card elevated style={{ flexDirection: 'row', gap: t.spacing(3), alignItems: 'flex-start' }}>
      <View style={{
        width: 44, height: 44, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: withAlpha(t.accent.primary, t.mode === 'dark' ? 0.20 : 0.14),
      }}>
        <Ionicons name={icon} size={22} color={t.accent.primary} />
      </View>
      <View style={{ flex: 1, gap: t.spacing(1) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) }}>
          <Text style={{ color: t.colors.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
          {badge ? (
            <View style={{
              paddingHorizontal: t.spacing(2), paddingVertical: 2,
              borderRadius: t.radius.pill, backgroundColor: t.accent.primarySoft,
            }}>
              <Text style={{ color: t.accent.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 }}>
                {badge.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: t.colors.textMuted, fontSize: 13, lineHeight: 19 }}>{description}</Text>
      </View>
    </Card>
  );
}

export function ReadingModeStep({ nav }: { nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, gap: t.spacing(5) }}>
        <StepHeader eyebrow={s.onbReadingModeEyebrow} title={s.onbReadingModeTitle} subtitle={s.onbReadingModeSubtitle} align="left" />

        <View style={{ gap: t.spacing(3) }}>
          <ModeRow
            icon="list-outline"
            title={s.readingModeAyah}
            description={s.onbReadingModeAyahDesc}
            badge={s.onbReadingModeDefault}
          />
          <ModeRow
            icon="reader-outline"
            title={s.readingModePage}
            description={s.onbReadingModePageDesc}
          />
        </View>
      </View>

      <OnbFooter>
        <Button label={s.onbContinue} onPress={nav.next} right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />} />
      </OnbFooter>
    </View>
  );
}
