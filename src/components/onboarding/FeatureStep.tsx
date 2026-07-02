import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { useStrings } from '@/i18n/strings';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Halo, StepHeader, FeatureBullet, OnbFooter, type OnbNav } from './parts';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Declarative description of one feature slide. String keys are resolved
// against the active i18n dictionary at render time so copy stays translatable.
export interface FeatureConfig {
  icon: IoniconName;
  eyebrowKey: string;
  titleKey: string;
  subtitleKey: string;
  bullets: { icon: IoniconName; key: string }[];
}

// Renders a single illustrated feature slide (halo + heading + highlights).
// Reused for every "what AyahOne does" screen via a config array in the flow.
export function FeatureStep({ feature, nav }: { feature: FeatureConfig; nav: OnbNav }) {
  const t = useTheme();
  const s = useStrings();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing(6) }}>
        <View style={{ alignItems: 'center' }}>
          <Halo size={220} icon={feature.icon} />
        </View>

        <StepHeader
          eyebrow={s[feature.eyebrowKey]}
          title={s[feature.titleKey]}
          subtitle={s[feature.subtitleKey]}
        />

        <Card elevated watermark style={{ gap: t.spacing(3) }}>
          {feature.bullets.map((b, i) => (
            <FeatureBullet key={i} icon={b.icon} text={s[b.key]} />
          ))}
        </Card>
      </View>

      <OnbFooter>
        <Button label={s.onbNext} onPress={nav.next} right={<Ionicons name="arrow-forward" size={18} color={t.accent.onPrimary} />} />
      </OnbFooter>
    </View>
  );
}
